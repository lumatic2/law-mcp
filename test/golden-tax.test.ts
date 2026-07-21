import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * TV1 step-1 — 세법 평가 세트 `bench/golden-tax.json` 의 계약 테스트.
 *
 * 이 세트는 horizon `tax-vertical` 의 **판정 정본**이다. 여기서 지키는 것은 세트의 "품질"이
 * 아니라 **오염 방지와 대표성**이다:
 *   ① 구 세트(golden·golden-v2)와 쿼리가 겹치면 소진된 튜닝이 새 수치로 새어 들어온다 → 중복 금지
 *   ② 근거 없는 라벨은 추측이다 → source 필수
 *   ③ 유형이 한쪽으로 쏠리면 "세법을 대표한다"는 말이 거짓이 된다 → 유형당 ≥5
 *   ④ dev/holdout 이 섞이면 홀드아웃이 blind 가 아니다 → 분할 중복 금지 + 30/20 고정
 *   ⑤ 2026-07-21 실측 실패 2건은 **반드시 남아 있어야 한다** — 도구가 못 하는 것을 담는 게
 *      이 세트의 존재 이유다(프리모템 ①: 세트가 도구를 닮으면 개선할 게 없어 보인다).
 */

type Item = {
  query: string;
  domain: string;
  type: string;
  tax_year: string | null;
  expected_laws: string[];
  expected_article?: string;
  split: string;
  source: string;
};

function load(name: string): { items: Item[]; types?: string[] } {
  return JSON.parse(readFileSync(new URL(`../bench/${name}.json`, import.meta.url), "utf8"));
}

const tax = load("golden-tax");

test("세트 크기와 분할이 선언대로다 — dev 30 / holdout 20", () => {
  assert.equal(tax.items.length, 50);
  assert.equal(tax.items.filter((i) => i.split === "dev").length, 30);
  assert.equal(tax.items.filter((i) => i.split === "holdout").length, 20);
});

// 오염 방지의 핵심. 구 세트 쿼리가 하나라도 섞이면 그 항목은 이미 튜닝에 노출된 값이다.
test("구 골든셋(golden·golden-v2)과 쿼리가 하나도 겹치지 않는다", () => {
  const old = new Set([...load("golden").items, ...load("golden-v2").items].map((i) => i.query));
  const overlap = tax.items.filter((i) => old.has(i.query)).map((i) => i.query);
  assert.deepEqual(overlap, [], `구 세트와 중복: ${overlap.join(", ")}`);
});

test("dev 와 holdout 사이에 같은 쿼리가 없다 — 홀드아웃이 blind 여야 한다", () => {
  const dev = new Set(tax.items.filter((i) => i.split === "dev").map((i) => i.query));
  const leaked = tax.items
    .filter((i) => i.split === "holdout" && dev.has(i.query))
    .map((i) => i.query);
  assert.deepEqual(leaked, [], `분할 누수: ${leaked.join(", ")}`);
});

test("모든 항목에 정답 근거(source)와 정답 조문이 있다", () => {
  for (const item of tax.items) {
    assert.ok(item.source?.trim(), `source 없음: ${item.query}`);
    assert.ok(item.expected_article?.trim(), `expected_article 없음: ${item.query}`);
    assert.ok(item.expected_laws?.length, `expected_laws 없음: ${item.query}`);
  }
});

// 조문 라벨은 `<법령명> 제N조[의M]` 형식이어야 verify-labels 가 실재를 확인할 수 있다.
test("정답 조문 라벨이 검증 가능한 형식이다", () => {
  for (const item of tax.items) {
    assert.match(
      item.expected_article!,
      /^.+\s제\d+조(?:의\d+)?$/,
      `형식 불량(verify-labels 가 파싱 못 함): ${item.expected_article}`,
    );
  }
});

test("선언한 6유형이 전부 쓰이고, 유형당 최소 5건이다 — 대표성", () => {
  const declared = tax.types ?? [];
  assert.equal(declared.length, 6);
  for (const t of declared) {
    const n = tax.items.filter((i) => i.type === t).length;
    assert.ok(n >= 5, `유형 '${t}' 이 ${n}건 — 최소 5건 필요`);
  }
  const undeclared = tax.items.filter((i) => !declared.includes(i.type)).map((i) => i.type);
  assert.deepEqual([...new Set(undeclared)], [], `선언되지 않은 유형: ${undeclared.join(", ")}`);
});

// 프리모템 ① 예방장치. 이 두 건은 2026-07-21 실측에서 도구가 못 찾은 질의다.
// 세트에서 빠지면 "우리가 잘하는 것만 담은 세트"가 된다.
test("2026-07-21 실측 실패 2건이 세트에 남아 있다", () => {
  const required = [
    { query: "과세표준 신고 후 경정청구 기한", article: "국세기본법 제45조의2" },
    { query: "세금계산서 지연발급 가산세", article: "부가가치세법 제60조" },
  ];
  for (const r of required) {
    const hit = tax.items.find((i) => i.query === r.query);
    assert.ok(hit, `필수 포함 질의가 없다: ${r.query}`);
    assert.equal(hit!.expected_article, r.article);
    assert.equal(hit!.split, "dev", `${r.query} 는 dev 여야 한다(수리 대상이므로)`);
  }
});

// TV3 이 채울 자리. 지금 값이 들어 있으면 측정 축이 조용히 켜진 것이다.
test("tax_year 필드가 전 항목에 존재한다 — TV3 이 채울 자리", () => {
  for (const item of tax.items) {
    assert.ok("tax_year" in item, `tax_year 필드 없음: ${item.query}`);
  }
});
