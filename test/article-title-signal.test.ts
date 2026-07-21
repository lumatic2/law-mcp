import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { IndexedArticle } from "../src/article-index.js";
import {
  TITLE_SIGNAL_FETCH_BUDGET,
  nameSignal,
  rerankByArticleTitle,
  scoreArticleTitles,
  shouldRunTitleSignal,
} from "../src/article-title-signal.js";

const source = readFileSync(new URL("../src/article-title-signal.ts", import.meta.url), "utf8");
/** 주석을 뺀 코드 본문 — 규칙에 하드코딩이 있는지는 코드에서만 판정한다. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function article(no: string, title: string | null, text = "본문"): IndexedArticle {
  return { article_no: no, display: `제${no}조`, title, text };
}

const 후보 = (law_id: string, law_name: string) => ({ law_id, law_name });

describe("과적합 방어 (F5)", () => {
  it("규칙에 법령명이 하드코딩돼 있지 않다", () => {
    // 문자열 리터럴 안에 `…법`·`…법률` 같은 법령명이 있으면 그건 평가 세트에 맞춘 것이다.
    const literals = code.match(/"[^"]*"|'[^']*'|`[^`]*`/g) ?? [];
    const lawNames = literals.filter((literal) => /(법|법률|규칙|시행령)(”|"|'|`|\s|$)/.test(literal));
    assert.deepEqual(lawNames, [], `법령명 하드코딩: ${lawNames.join(", ")}`);
  });

  it("도메인·쿼리 토큰이 하드코딩돼 있지 않다", () => {
    // 한글 낱말 리터럴 자체가 없어야 한다 — 토큰 목록을 넣는 순간 특정 쿼리에 맞춘 규칙이 된다.
    const hangul = code.match(/"[^"]*[가-힣][^"]*"|'[^']*[가-힣][^']*'/g) ?? [];
    assert.deepEqual(hangul, [], `한글 리터럴: ${hangul.join(", ")}`);
  });
});

describe("비용 예산", () => {
  it("추가 조회 상한은 3건이다", () => {
    assert.equal(TITLE_SIGNAL_FETCH_BUDGET, 3);
  });

  it("예산을 넘겨 조회하지 않는다", async () => {
    const opened: string[] = [];
    await rerankByArticleTitle(
      [후보("1", "가"), 후보("2", "나"), 후보("3", "다"), 후보("4", "라"), 후보("5", "마")],
      "지연발급 가산세",
      async (id) => {
        opened.push(id);
        return [article("60", "가산세")];
      },
    );
    assert.equal(opened.length, TITLE_SIGNAL_FETCH_BUDGET);
  });
});

describe("값어치 게이트 — 이름이 이미 답을 알면 전문을 열지 않는다", () => {
  const query = "지연발급 가산세";

  it("단독 1위가 이름으로 정해져 있으면 돌리지 않는다", () => {
    assert.equal(
      shouldRunTitleSignal([후보("1", "가산세 관리에 관한 규정"), 후보("2", "아무 이름")], query),
      false,
    );
  });

  it("이름이 아무것도 못 가르면 돌린다", () => {
    assert.equal(shouldRunTitleSignal([후보("1", "이름 하나"), 후보("2", "이름 둘")], query), true);
  });

  it("이름 최고점이 동점이면 돌린다", () => {
    assert.equal(
      shouldRunTitleSignal([후보("1", "가산세 하나"), 후보("2", "가산세 둘")], query),
      true,
    );
  });

  it("이름 단독 1위가 맨 앞이 아니면 돌린다", () => {
    assert.equal(
      shouldRunTitleSignal([후보("1", "아무 이름"), 후보("2", "가산세 규정")], query),
      true,
    );
  });

  it("게이트에 걸리면 조회를 한 건도 하지 않는다", async () => {
    let opened = 0;
    const candidates = [후보("1", "가산세 규정"), 후보("2", "아무 이름")];
    const outcome = await rerankByArticleTitle(candidates, query, async () => {
      opened += 1;
      return [];
    });
    assert.equal(opened, 0);
    assert.equal(outcome.fetched, 0);
    assert.equal(outcome.unchanged, true);
    assert.equal(outcome.items, candidates);
  });
});

describe("제목 채점", () => {
  it("한 조문이 담은 토큰 수의 최대값이다 — 합이 아니다", () => {
    // 조문이 많은 법이 흩어진 매칭만으로 이기면 안 된다(이름 길이 편향 → 조문 수 편향).
    const 흩어짐 = [article("1", "지연발급"), article("2", "가산세"), article("3", "지연발급")];
    const 한곳 = [article("60", "지연발급 가산세")];
    assert.equal(scoreArticleTitles(흩어짐, "지연발급 가산세").score, 1);
    assert.equal(scoreArticleTitles(한곳, "지연발급 가산세").score, 2);
  });

  it("제목의 띄어쓰기를 무시한다", () => {
    const { score, best } = scoreArticleTitles([article("60", "지연 발급 가산세")], "지연발급 가산세");
    assert.ok(score > 0);
    assert.equal(best?.article_no, "60");
  });

  it("제목이 없는 조문은 점수에 기여하지 않는다", () => {
    assert.equal(scoreArticleTitles([article("1", null, "지연발급 가산세")], "지연발급 가산세").score, 0);
  });
});

describe("재정렬", () => {
  const query = "지연발급 가산세";
  const candidates = [후보("1", "이름 하나"), 후보("2", "이름 둘"), 후보("3", "이름 셋")];

  it("제목이 맞는 후보를 앞으로 올린다", async () => {
    const outcome = await rerankByArticleTitle(candidates, query, async (id) =>
      id === "3" ? [article("60", "지연발급 가산세")] : [article("1", "목적")],
    );
    assert.equal(outcome.items[0].law_id, "3");
    assert.equal(outcome.unchanged, false);
  });

  it("점수가 같으면 원래 순서를 지킨다", async () => {
    const outcome = await rerankByArticleTitle(candidates, query, async () => [article("1", "가산세")]);
    assert.deepEqual(outcome.items.map((c) => c.law_id), ["1", "2", "3"]);
  });

  it("전부 0점이면 순서를 흔들지 않는다", async () => {
    const outcome = await rerankByArticleTitle(candidates, query, async () => [article("1", "목적")]);
    assert.equal(outcome.items, candidates);
    assert.equal(outcome.unchanged, true);
  });

  it("창 밖 후보는 건드리지 않는다", async () => {
    const many = [...candidates, 후보("4", "이름 넷"), 후보("5", "이름 다섯")];
    const outcome = await rerankByArticleTitle(many, query, async (id) =>
      id === "3" ? [article("60", "지연발급 가산세")] : [article("1", "목적")],
    );
    assert.deepEqual(outcome.items.map((c) => c.law_id), ["3", "1", "2", "4", "5"]);
  });
});

describe("실패 프로브 — 상류가 죽어도 조용히 나빠지지 않는다", () => {
  const query = "지연발급 가산세";
  const candidates = [후보("1", "이름 하나"), 후보("2", "이름 둘"), 후보("3", "이름 셋")];

  it("전문 조회가 던지면 기존 순위 그대로다", async () => {
    const outcome = await rerankByArticleTitle(candidates, query, async () => {
      throw Object.assign(new Error("503"), { status: 503 });
    });
    assert.equal(outcome.items, candidates);
    assert.equal(outcome.unchanged, true);
  });

  it("한 건만 실패해도 재정렬하지 않는다 — 실패한 후보가 조용히 밀리면 안 된다", async () => {
    const outcome = await rerankByArticleTitle(candidates, query, async (id) => {
      if (id === "1") return null;
      return [article("60", "지연발급 가산세")];
    });
    assert.deepEqual(outcome.items.map((c) => c.law_id), ["1", "2", "3"]);
    assert.equal(outcome.unchanged, true);
  });
});
