import assert from "node:assert/strict";
import test from "node:test";
import { aggregateRepeats } from "../bench/scoring.js";
import { assertHoldoutSeal } from "../bench/run.js";

/**
 * UD1 step-2 — 반복 측정 집계와 홀드아웃 봉인의 계약 테스트.
 *
 * 두 기능 다 "규약을 문서가 아니라 코드로 옮긴" 것이다:
 *   ① 노이즈 정량화 — LB5 는 같은 코드 2회 실행이 72.0%/76.0% 로 갈렸는데 그걸 판정할 수단이
 *      없어 4%p 이하 차이를 전부 눈대중으로 처리했다.
 *   ② 홀드아웃 봉인 — 규약이 bench/README.md 에만 있어서 세트가 소진됐다.
 */

test("반복 집계는 평균·표본표준편차·범위를 낸다", () => {
  const stats = aggregateRepeats([0.72, 0.76, 0.74]);

  assert.equal(stats.n, 3);
  assert.ok(Math.abs(stats.mean - 0.74) < 1e-9);
  assert.ok(Math.abs(stats.sd! - 0.02) < 1e-9, `sd=${stats.sd}`);
  assert.equal(stats.min, 0.72);
  assert.equal(stats.max, 0.76);
  assert.ok(Math.abs(stats.threshold_2sd! - 0.04) < 1e-9, "채택 문턱은 2σ");
});

// n=1 에서 sd=0 은 "흔들리지 않았다"는 거짓 주장이다. 판정 불가를 판정 불가라고 말해야 한다.
test("1회 측정은 표준편차를 0 이 아니라 null 로 낸다", () => {
  const stats = aggregateRepeats([0.76]);

  assert.equal(stats.sd, null);
  assert.equal(stats.threshold_2sd, null, "문턱을 계산할 수 없으면 판정도 불가");
  assert.equal(stats.mean, 0.76);
});

test("모든 회차가 같으면 표준편차가 0 이다", () => {
  const stats = aggregateRepeats([0.8, 0.8, 0.8]);

  assert.ok(Math.abs(stats.sd!) < 1e-12, `sd=${stats.sd}`);
  assert.ok(Math.abs(stats.threshold_2sd!) < 1e-12);
});

test("빈 입력은 조용히 넘어가지 않는다", () => {
  assert.throws(() => aggregateRepeats([]), /비어 있다/);
});

// 봉인 — LB5 에서 세트를 태운 실수를 코드로 막는다.
test("홀드아웃은 플래그 없이 열 수 없다", () => {
  assert.throws(() => assertHoldoutSeal("holdout", false), /봉인/);
});

test("horizon 을 닫는 시점에만 홀드아웃이 열린다", () => {
  assert.doesNotThrow(() => assertHoldoutSeal("holdout", true));
});

test("dev 는 봉인과 무관하게 언제나 열린다", () => {
  assert.doesNotThrow(() => assertHoldoutSeal("dev", false));
});
