import assert from "node:assert/strict";
import test from "node:test";
import { SOURCE_DESCRIPTORS, CGM_EXPC_DESCRIPTORS } from "../src/providers/source-adapter.js";

/**
 * TV2 step-3 — 구속력 등급의 계약 테스트.
 *
 * 왜 이게 부가 기능이 아니라 게이트인가: 예규는 **법원(法院)을 구속하지 않는 "자료"** 이고
 * (대법원 1998.9.8 취지), 예규문 자체에 "사실관계가 다르면 답변이 달라질 수 있다"는 단서가
 * 붙는다. 그런데 우리가 조문과 같은 모양으로 출하하면 소비 LLM 은 그걸 근거로 인용한다 —
 * F20(이름이 우연히 겹친 법을 준 것)과 **같은 부류의 함정**이다.
 */

test("모든 법원(法源)에 구속력 등급이 있다 — 등급 없는 자료원은 존재할 수 없다", () => {
  const keys = Object.keys(SOURCE_DESCRIPTORS);
  assert.ok(keys.length >= 19, `자료원이 ${keys.length}종`);
  for (const key of keys) {
    const a = SOURCE_DESCRIPTORS[key].authority;
    assert.ok(a, `${key}: authority 없음`);
    assert.ok(a.grade, `${key}: grade 없음`);
    assert.ok(a.note?.trim().length > 10, `${key}: note 가 비었거나 너무 짧다`);
  }
});

test("예규는 참고자료다 — 법령이 아니라고 명시한다", () => {
  for (const [key, d] of Object.entries(CGM_EXPC_DESCRIPTORS)) {
    assert.equal(d.authority.grade, "reference_only", `${key}`);
    assert.match(d.authority.note, /법령이 아니라/, `${key}: 무엇이 아닌지 말해야 한다`);
    assert.match(d.authority.note, /구속하지 않/, `${key}: 구속력 없음을 말해야 한다`);
  }
});

// 법제처 법령해석례도 행정해석이라 같은 등급이다.
test("법제처 법령해석례도 참고자료 등급이다", () => {
  assert.equal(SOURCE_DESCRIPTORS.expc.authority.grade, "reference_only");
});

test("심판례·위원회 판정은 재결 등급이다 — 그 사건을 종결시킨 판단", () => {
  for (const key of ["ttDecc", "acrDecc", "adapDecc", "decc", "nlrc", "ppc", "ftc"]) {
    assert.equal(SOURCE_DESCRIPTORS[key].authority.grade, "adjudication", key);
  }
});

test("헌재결정·자치법규·용어는 각자의 등급을 갖는다 — 전부 adjudication 으로 뭉개지 않는다", () => {
  assert.equal(SOURCE_DESCRIPTORS.detc.authority.grade, "constitutional");
  assert.equal(SOURCE_DESCRIPTORS.ordin.authority.grade, "statute");
  assert.equal(SOURCE_DESCRIPTORS.lstrm.authority.grade, "dictionary");
});

/**
 * 보수 판정 규율. 등급을 못 정하는 자료원이 생기면 "모르면 구속력 있다"로 새는 게 아니라
 * 참고자료로 떨어져야 한다. 여기서는 **구속력이 강한 등급이 함부로 늘지 않는 것**으로 지킨다.
 */
test("구속력이 강한 등급은 근거가 확인된 자료원에만 붙는다", () => {
  const strong = Object.entries(SOURCE_DESCRIPTORS)
    .filter(([, d]) => d.authority.grade === "constitutional" || d.authority.grade === "statute")
    .map(([k]) => k)
    .sort();
  assert.deepEqual(strong, ["detc", "ordin"], `강한 등급이 늘었다: ${strong.join(", ")}`);
});

// 예규는 전문도 없고 구속력도 없다 — 두 사실이 함께 붙어야 오용을 막는다.
test("예규는 전문 없음과 참고자료 등급을 함께 갖는다", () => {
  for (const [key, d] of Object.entries(CGM_EXPC_DESCRIPTORS)) {
    assert.ok(d.detailUnavailable, `${key}: 전문 없음`);
    assert.equal(d.authority.grade, "reference_only", `${key}: 등급`);
  }
});
