import assert from "node:assert/strict";
import test from "node:test";
import {
  EFFECTIVE_LAW_TARGET,
  EffectiveDateTargetError,
  assertEffectiveDateTarget,
  pickVersionAsOf,
  resolveAsOf,
} from "../src/effective-law.js";

/**
 * TV3 step-1 — 시점 조회 경로의 계약 테스트.
 *
 * 이 milestone 이 막으려는 것은 **무경고 오답**이다. `target=law&efYd=20230101` 은 인자를
 * 조용히 무시하고 현행을 준다(2026-07-21 실측: 시행일 20260101·조문 393개). 그걸 모르고 짜면
 * "2023년 지정했는데 2026년 조문"이 아무 경고 없이 나간다.
 */

test("시점 조회 타깃은 eflaw 하나다", () => {
  assert.equal(EFFECTIVE_LAW_TARGET, "eflaw");
});

// 핵심 가드. 조용한 현행 반환을 시끄러운 실패로 바꾼다.
test("efYd 를 무시하는 타깃으로 시점 조회하면 즉시 실패한다", () => {
  for (const target of ["law", "elaw", "lsDelegated"]) {
    assert.throws(
      () => assertEffectiveDateTarget(target),
      EffectiveDateTargetError,
      `${target}: 조용히 현행을 주는 타깃은 막아야 한다`,
    );
  }
});

test("실패 메시지가 왜 안 되는지와 무엇을 써야 하는지를 말한다", () => {
  try {
    assertEffectiveDateTarget("law");
    assert.fail("던졌어야 한다");
  } catch (e) {
    const msg = (e as Error).message;
    assert.match(msg, /조용히 무시/, "왜 안 되는지");
    assert.match(msg, /eflaw/, "무엇을 써야 하는지");
  }
});

test("eflaw 는 막지 않는다 — 과잉 차단 방지", () => {
  assert.doesNotThrow(() => assertEffectiveDateTarget("eflaw"));
  assert.doesNotThrow(() => assertEffectiveDateTarget("prec"));
});

test("연도만 주면 그 해 12월 31일 시점으로 해석한다", () => {
  const r = resolveAsOf("2023");
  assert.equal(r?.asOfDate, "20231231");
  assert.match(r!.rule, /2023년 귀속/);
});

test("'2023년' 처럼 한글이 붙어도 받는다", () => {
  assert.equal(resolveAsOf("2023년")?.asOfDate, "20231231");
});

/**
 * 우리가 추정한 규칙을 사용자가 검증할 수 있어야 한다. 특히 법인세는 사업연도가 역년과
 * 다를 수 있어 12/31 가정이 틀릴 수 있다 — 그 사실을 규칙에 적어 둔다.
 */
test("연도 해석 규칙이 역년 가정과 그 한계를 밝힌다", () => {
  const rule = resolveAsOf("2023")!.rule;
  assert.match(rule, /역년 과세/);
  assert.match(rule, /법인세/, "사업연도가 다를 수 있다는 경고");
});

test("정확한 날짜를 주면 그대로 쓴다 — 구분자는 흡수한다", () => {
  assert.equal(resolveAsOf("2023-01-01")?.asOfDate, "20230101");
  assert.equal(resolveAsOf("2023.01.01")?.asOfDate, "20230101");
  assert.equal(resolveAsOf("20230101")?.asOfDate, "20230101");
});

/**
 * 가장 중요한 계약. 해석할 수 없으면 **null 이고, 호출자는 현행으로 대체하면 안 된다.**
 * 닫는 기준 3 의 "조용한 현행 반환 0건"이 여기서 시작된다.
 */
test("해석할 수 없는 시점은 null 이다 — 현행으로 대체하지 않는다", () => {
  for (const bad of ["작년", "최근", "", "  ", "23", "2023년 1기", "abcd", "2023-13-01", "2023-01-32"]) {
    assert.equal(resolveAsOf(bad), null, `'${bad}' 는 해석 불가여야 한다`);
  }
});

test("법제처 연혁이 닿지 않는 범위는 거절한다", () => {
  assert.equal(resolveAsOf("1900"), null, "제헌 이전");
  assert.equal(resolveAsOf("2200"), null, "과도한 미래");
  assert.equal(resolveAsOf("19000101"), null);
  // 경계는 살려 둔다.
  assert.ok(resolveAsOf("1948"));
  assert.ok(resolveAsOf("2100"));
});

/**
 * 2026-07-21 실측이 뒤집은 가정. `efYd` 는 "이 날짜 시점"이 아니라 **"시행일자가 정확히 이 날인
 * 판"** 이다 — `efYd=20231231` 은 0 조문을 반환했다. 그래서 기준일을 그대로 넘기면 안 되고,
 * 연혁 목록에서 기준일 이하의 가장 최근 판을 골라야 한다.
 */
const VERSIONS = [
  { 시행일자: "20280101", 현행연혁코드: "시행예정" },
  { 시행일자: "20260101", 현행연혁코드: "현행" },
  { 시행일자: "20250101", 현행연혁코드: "연혁" },
  { 시행일자: "20230101", 현행연혁코드: "연혁" },
  { 시행일자: "20220101", 현행연혁코드: "연혁" },
];

test("기준일 이하의 가장 최근 시행판을 고른다", () => {
  assert.equal(pickVersionAsOf(VERSIONS, "20231231")?.시행일자, "20230101");
  assert.equal(pickVersionAsOf(VERSIONS, "20230101")?.시행일자, "20230101", "당일 시행판을 포함한다");
  assert.equal(pickVersionAsOf(VERSIONS, "20221231")?.시행일자, "20220101");
  assert.equal(pickVersionAsOf(VERSIONS, "20261231")?.시행일자, "20260101");
});

test("기준일 이후 시행예정판을 미리 주지 않는다", () => {
  assert.notEqual(pickVersionAsOf(VERSIONS, "20231231")?.시행일자, "20280101");
});

test("요청 시점에 아직 없던 법은 null 이다 — 가장 오래된 판으로 대체하지 않는다", () => {
  assert.equal(pickVersionAsOf(VERSIONS, "20211231"), null);
  assert.equal(pickVersionAsOf([], "20231231"), null);
});

test("시행일자 형식이 깨진 항목은 후보에서 뺀다", () => {
  const dirty = [{ 시행일자: "" }, { 시행일자: "2023" }, { 시행일자: "20230101" }];
  assert.equal(pickVersionAsOf(dirty, "20231231")?.시행일자, "20230101");
});
