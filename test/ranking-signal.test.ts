import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractAiSearch, type AiSearchResult } from "../src/ai-search.js";
import { rerankByAiSignal } from "../src/ranking-signal.js";

const source = readFileSync(new URL("../src/ranking-signal.ts", import.meta.url), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const 후보 = (law_id: string, law_name: string) => ({ law_id, law_name });

/** aiSearch 응답을 만들어 정규화까지 태운다 — 실제 경로와 같은 모양으로 시험한다. */
function ai(
  query: string,
  rows: Array<{ law: string; id?: string; no: number; title?: string; content?: string }>,
): AiSearchResult {
  return extractAiSearch(
    {
      aiSearch: {
        법령조문: rows.map((row, index) => ({
          id: String(index + 1),
          법령명: row.law,
          법령ID: row.id ?? row.law,
          조문번호: String(row.no).padStart(4, "0"),
          조문제목: row.title ?? "",
          조문내용: row.content ?? "",
        })),
      },
    },
    query,
  );
}

describe("과적합 방어 (F5)", () => {
  it("규칙에 법령명·한글 토큰이 하드코딩돼 있지 않다", () => {
    const hangul = code.match(/"[^"]*[가-힣][^"]*"|'[^']*[가-힣][^']*'/g) ?? [];
    // 정규화용 문자 클래스(공백·가운뎃점)는 법령명이 아니다.
    const offenders = hangul.filter((literal) => /[가-힣]{2,}/.test(literal));
    assert.deepEqual(offenders, [], `한글 리터럴: ${offenders.join(", ")}`);
  });

  it("새 채점기를 발명하지 않고 검증된 채점기를 재사용한다", () => {
    assert.match(code, /scoreArticles/, "LB2 채점기 재사용");
  });
});

describe("신호가 없으면 순서를 흔들지 않는다", () => {
  const candidates = [후보("1", "가법"), 후보("2", "나법"), 후보("3", "다법")];

  it("aiSearch 결과가 비면 원본 그대로", () => {
    const outcome = rerankByAiSignal(candidates, "가산세", ai("가산세", []));
    assert.equal(outcome.items, candidates);
    assert.equal(outcome.unchanged, true);
  });

  it("aiSearch 가 null 이면(실패) 원본 그대로", () => {
    const outcome = rerankByAiSignal(candidates, "가산세", null);
    assert.equal(outcome.items, candidates);
    assert.equal(outcome.unchanged, true);
  });

  it("어떤 후보도 점수를 못 얻으면 원본 그대로", () => {
    // aiSearch 는 답했지만 우리 후보와 겹치는 법이 없다.
    const signal = ai("가산세", [{ law: "라법", no: 1, title: "가산세" }]);
    const outcome = rerankByAiSignal(candidates, "가산세", signal);
    assert.equal(outcome.items, candidates);
    assert.equal(outcome.unchanged, true);
  });
});

describe("재정렬", () => {
  it("이름이 안 걸리는 정답을 위로 올린다 — 이 milestone 의 존재 이유", () => {
    // `세금계산서 지연발급 가산세` 는 정답 법 이름과 한 글자도 안 겹친다.
    const candidates = [후보("1", "가법"), 후보("2", "나법"), 후보("3", "다법")];
    const signal = ai("세금계산서 지연발급 가산세", [
      { law: "가법", no: 1, title: "목적", content: "이 법은" },
      { law: "다법", no: 60, title: "가산세", content: "세금계산서를 지연발급 한 경우 가산세" },
    ]);
    const outcome = rerankByAiSignal(candidates, "세금계산서 지연발급 가산세", signal);
    assert.equal(outcome.items[0].law_name, "다법");
    assert.equal(outcome.unchanged, false);
  });

  it("aiSearch 순위를 그대로 따르지 않는다 — 자체 순서는 우리보다 나빴다", () => {
    // aiSearch 1위(가법)는 쟁점이 다르고, 3위(다법)가 본문에 쿼리를 담고 있다.
    const candidates = [후보("1", "가법"), 후보("2", "다법")];
    const signal = ai("지연발급 가산세", [
      { law: "가법", no: 1, title: "목적", content: "무관한 내용" },
      { law: "다법", no: 60, title: "가산세", content: "지연발급 가산세" },
    ]);
    const outcome = rerankByAiSignal(candidates, "지연발급 가산세", signal);
    assert.equal(outcome.items[0].law_name, "다법", "순위가 아니라 채점이 정한다");
  });

  it("점수가 같으면 aiSearch 순위 → 원래 순서로 떨어진다", () => {
    const candidates = [후보("1", "가법"), 후보("2", "나법")];
    const signal = ai("가산세", [
      { law: "나법", no: 1, title: "가산세" },
      { law: "가법", no: 1, title: "가산세" },
    ]);
    const outcome = rerankByAiSignal(candidates, "가산세", signal);
    assert.equal(outcome.items[0].law_name, "나법", "동점이면 aiSearch 순위가 가른다");
  });

  it("후보 풀 밖의 법을 새로 끼워 넣지 않는다", () => {
    const candidates = [후보("1", "가법"), 후보("2", "나법")];
    const signal = ai("가산세", [
      { law: "마법", no: 1, title: "가산세", content: "가산세" },
      { law: "나법", no: 2, title: "가산세" },
    ]);
    const outcome = rerankByAiSignal(candidates, "가산세", signal);
    assert.deepEqual(outcome.items.map((c) => c.law_name).sort(), ["가법", "나법"]);
  });

  it("법령명 표기가 달라도(공백·가운뎃점) 신호를 놓치지 않는다", () => {
    const candidates = [후보("1", "가법"), 후보("2", "남녀고용평등과 일·가정 양립 지원에 관한 법률")];
    const signal = ai("가산세", [
      { law: "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률", no: 60, title: "가산세", content: "가산세" },
    ]);
    const outcome = rerankByAiSignal(candidates, "가산세", signal);
    assert.equal(outcome.items[0].law_id, "2");
  });
});

describe("파이프라인 배선", () => {
  const provider = readFileSync(new URL("../src/providers/lawgo-provider.ts", import.meta.url), "utf8");

  it("채택 판정을 통과한 뒤 기본이 켜졌다", () => {
    // 2026-07-22 교차 A/B(세법 dev): 이득 2 · 손실 0 · 순 +2, 2회 동일.
    // 판정 전에는 false 였다 — 미검증 코드가 제품 경로로 새지 않게 하는 UD2 규율.
    assert.match(provider, /options\.rankingSignal\?\.enabled \?\? true/);
  });

  it("추가 호출 없이 이미 떠 있는 aiSearch 를 쓴다", () => {
    // 여기서 lookupAiSearch 를 새로 부르면 이 milestone 의 전제(추가 호출 0)가 깨진다.
    const fn = provider.slice(provider.indexOf("private async applyRankingSignal"));
    const body = fn.slice(0, fn.indexOf("\n  /**", 10));
    assert.match(body, /await aiPending/);
    assert.doesNotMatch(body, /lookupAiSearch/);
  });

  it("연혁 부착보다 먼저 재정렬한다 — 연혁은 1위에 붙는다", () => {
    // 변수명이 아니라 **호출 순서**를 본다 — 전에는 `attachHistory(resignaled)` 라는 리터럴을
    // 찾다가 뒤에 단계가 하나 끼자(AR3 어휘 공백) 의도와 무관하게 깨졌다.
    const order = provider.indexOf("applyRankingSignal(") < provider.lastIndexOf("this.attachHistory(");
    assert.ok(order, "재정렬 → 연혁 순서");
  });
});
