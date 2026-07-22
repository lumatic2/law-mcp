import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { VOCAB_GAP_THRESHOLD, vocabCoverage, vocabGapWarning } from "../src/vocab-gap.js";

const 후보 = (law_name: string, titles: string[] = []) => ({
  law_name,
  ai_articles: titles.map((title, i) => ({ article: `제${i + 1}조`, title })),
});

describe("어휘 공백 신호 (AR3)", () => {
  it("일상어 질의 — 결과 어디에도 안 보이면 경고한다", () => {
    // 실측 재현: "세금을 잘못 매겼을 때 다투는 절차" → 부가가치세법·세무사법이 상위,
    // 정답 국세기본법 제55조는 후보에 없었다.
    const items = [후보("부가가치세법"), 후보("세무사법")];
    const warning = vocabGapWarning("세금을 잘못 매겼을 때 다투는 절차", items);
    assert.ok(warning, "일상어 질의에서 경고가 나와야 한다");
    assert.match(warning, /법률 용어로 바꿔/);
  });

  it("좁히라고 하지 않고 **바꾸라**고 한다", () => {
    // 좁히기는 같은 어휘 안에서 도는 일이라 이 실패를 못 푼다. 실측으로 복구시킨 행동은 번역이다.
    const warning = vocabGapWarning("돈을 준 사람이 세무서에 내는 서류", [후보("세무사법")]);
    assert.ok(warning);
    assert.match(warning, /좁히지 말고/);
  });

  it("법률어 질의 — 결과에 어휘가 보이면 경고하지 않는다", () => {
    const items = [후보("부가가치세법", ["간이과세의 적용 범위"])];
    assert.equal(vocabGapWarning("부가가치세 간이과세자 적용 범위", items), null);
  });

  it("긴 법률 복합어가 짧은 조문제목을 포함하는 경우도 적중으로 센다", () => {
    // 한 방향만 보면 `기한후과세표준신고서` 와 `기한 후 신고` 가 안 겹친 것으로 세어
    // **성공한 검색에 경고가 붙는다** — 2026-07-23 실측 오탐의 원인.
    const items = [후보("국세기본법", ["기한 후 신고", "수정신고"])];
    const { covered } = vocabCoverage("기한후과세표준신고서 수정신고", items);
    assert.ok(covered >= 1, "토큰이 제목을 포함하는 방향도 적중이어야 한다");
  });

  it("공백 표기가 달라도 적중으로 센다", () => {
    const items = [후보("국세 기본법", ["기한 후 신고"])];
    const { ratio } = vocabCoverage("국세기본법 기한후신고", items);
    assert.equal(ratio, 1);
  });

  it("후보가 비면 경고한다 — 아무것도 못 찾은 것도 어휘 공백이다", () => {
    assert.ok(vocabGapWarning("세금을 잘못 매겼을 때 다투는 절차", [후보("")]));
  });

  it("토큰이 없는 질의는 경고하지 않는다 — 판단 근거가 없다", () => {
    assert.equal(vocabGapWarning("의", [후보("부가가치세법")]), null);
  });

  it("문턱 경계에서 정확히 갈린다", () => {
    // 절반 **미만**일 때만 켜진다. 정확히 절반이면 끄는 쪽이다(경고 남발 방지).
    assert.equal(VOCAB_GAP_THRESHOLD, 0.5);
    const items = [후보("가산세")];
    const { ratio } = vocabCoverage("가산세 손금산입", items);
    assert.equal(ratio, 0.5);
    assert.equal(vocabGapWarning("가산세 손금산입", items), null);
  });
});

describe("어휘 공백 — 배선과 과적합 방어", () => {
  const provider = readFileSync(
    new URL("../src/providers/lawgo-provider.ts", import.meta.url),
    "utf8",
  );
  const module = readFileSync(new URL("../src/vocab-gap.ts", import.meta.url), "utf8");

  it("기본이 켜져 있다 — 순위를 안 바꾸므로 손실 0 이 구조적이다", () => {
    assert.match(provider, /options\.vocabGap\?\.enabled \?\? true/);
  });

  it("순서를 건드리지 않는다 — warnings 에만 더한다", () => {
    const fn = provider.slice(provider.indexOf("private applyVocabGap"));
    const body = fn.slice(0, fn.indexOf("\n  /**", 10));
    assert.match(body, /warnings:/);
    // items 를 재배치하면 "손실 0" 전제가 깨진다.
    assert.doesNotMatch(body, /\.sort\(|items:\s*\[\.\.\.reordered/);
  });

  it("상류가 이상해도 검색을 죽이지 않는다", () => {
    const fn = provider.slice(provider.indexOf("private applyVocabGap"));
    assert.match(fn.slice(0, 600), /catch\s*\{\s*return base;/);
  });

  it("법명·도메인·용어 사전이 하나도 없다 (과적합 방어)", () => {
    // TV4·TV7 DoD 답습 — 세법에서만 듣는 규칙은 이 horizon 의 취지에 반한다.
    for (const banned of ["국세기본법", "소득세법", "법인세", "부가가치세", "세금", "신고"]) {
      assert.ok(
        !module.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
          .join("\n").includes(banned),
        `코드에 도메인 어휘 '${banned}' 가 박혀 있다`,
      );
    }
  });
});
