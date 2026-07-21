import assert from "node:assert/strict";
import test from "node:test";
import { summarize, isSameArticle, type ItemOutcome } from "../bench/scoring.js";

/**
 * TV1 step-2 — 세법 채점축(유형 분해 · 시점 정확도 자리)의 계약 테스트.
 *
 * 핵심 규율: **켜지지 않은 축은 0 이 아니라 null 이다.** 0% 로 내면 "시점을 전부 틀렸다"는
 * 거짓 주장이 되고, 그 상태로 기준선을 찍으면 TV3 의 개선폭이 부풀려진다.
 */

function outcome(over: Partial<ItemOutcome>): ItemOutcome {
  return {
    query: "q",
    domain: "세법",
    split: "dev",
    hit1: false,
    hit3: false,
    precHit: false,
    articleChecked: false,
    articleCorrect: false,
    returned: [],
    ...over,
  };
}

test("유형별로 recall@3 과 조문 정확도를 따로 낸다", () => {
  const s = summarize([
    outcome({ type: "비과세", hit3: true, articleChecked: true, articleCorrect: true }),
    outcome({ type: "비과세", hit3: false, articleChecked: true, articleCorrect: false }),
    outcome({ type: "가산세", hit3: true, articleChecked: true, articleCorrect: false }),
  ]);
  assert.equal(s.by_type["비과세"].total, 2);
  assert.equal(s.by_type["비과세"].recall_at_3, 0.5);
  assert.equal(s.by_type["비과세"].article_accuracy, 0.5);
  assert.equal(s.by_type["가산세"].recall_at_3, 1);
  assert.equal(s.by_type["가산세"].article_accuracy, 0);
});

// 구 세트(golden·golden-v2)는 type 라벨이 없다. 유형 축이 조용히 끼어들면 안 된다.
test("유형 라벨이 없는 구 세트에서는 유형 분해가 비어 있다", () => {
  const s = summarize([outcome({ hit3: true }), outcome({ hit3: false })]);
  assert.deepEqual(s.by_type, {});
  assert.equal(s.recall_at_3, 0.5);
});

test("조문 정확도는 유형 안에서 '조문을 확인한 항목'만 분모로 쓴다", () => {
  const s = summarize([
    outcome({ type: "비과세", hit3: true, articleChecked: true, articleCorrect: true }),
    outcome({ type: "비과세", hit3: true, articleChecked: false }),
  ]);
  // 2건 중 조문 확인은 1건 → 100% (분모에 미확인 항목을 넣어 희석하지 않는다)
  assert.equal(s.by_type["비과세"].article_accuracy, 1);
  assert.equal(s.by_type["비과세"].total, 2);
});

test("조문을 하나도 확인하지 않은 유형의 정확도는 0 이 아니라 null 이다", () => {
  const s = summarize([outcome({ type: "절차", hit3: true })]);
  assert.equal(s.by_type["절차"].article_accuracy, null);
});

// TV1 의 핵심 계약. TV3 가 asOfChecked 를 켜기 전까지 이 값은 항상 null 이어야 한다.
test("시점 정확도는 측정 전에는 n/a(null) 다 — 0% 로 내지 않는다", () => {
  const s = summarize([outcome({ type: "비과세", hit3: true })]);
  assert.equal(s.as_of_accuracy, null);
  assert.equal(s.as_of_checked, 0);
});

test("시점을 측정하기 시작하면 그때부터 비율이 나온다 (TV3 대비)", () => {
  const s = summarize([
    outcome({ asOfChecked: true, asOfCorrect: true }),
    outcome({ asOfChecked: true, asOfCorrect: false }),
    outcome({}), // 시점 미측정 항목은 분모에서 빠진다
  ]);
  assert.equal(s.as_of_checked, 2);
  assert.equal(s.as_of_accuracy, 0.5);
});

// 세법 라벨은 가지번호(제45조의2)와 항 표기가 잦다.
test("조문 번호 비교가 가지번호와 표기 차이를 흡수한다", () => {
  assert.ok(isSameArticle("제45조의2", "제45조의2"));
  assert.ok(isSameArticle("제60조", "60"));
  assert.ok(isSameArticle(" 제 60 조 ", "제60조"));
  assert.ok(!isSameArticle("제45조", "제45조의2"), "가지번호는 다른 조문이다");
  assert.ok(!isSameArticle("제60조", "제61조"));
});
