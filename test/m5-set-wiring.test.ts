/**
 * 세트 배선 — `sealed` 봉인 어휘 + 고정 표본 재현 (M5 step-3).
 *
 * 두 가지가 조용히 깨지면 모든 측정이 무의미해진다:
 *   ① 새 봉인 어휘(`sealed`)가 봉인 검사에서 빠지면 **태어날 때부터 열린 봉인**이 된다.
 *   ② 고정 표본에서 case_id 가 빠지면 분모가 몰래 줄어든 채 "같은 세트"로 보고된다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assertHoldoutSeal } from "../bench/run.js";
import { loadAgenticSet } from "../bench/agentic-set.js";

test("sealed 는 플래그 없이 거절된다 — holdout 과 같은 무게", () => {
  assert.throws(() => assertHoldoutSeal("sealed", false), /봉인 문항\(sealed\)은 열지 않는다/);
  assert.throws(() => assertHoldoutSeal("holdout", false), /홀드아웃은 봉인돼 있다/);
});

test("sealed 도 플래그가 있으면 열린다 — 상시 차단이 아님을 양방향 확인", () => {
  assert.doesNotThrow(() => assertHoldoutSeal("sealed", true));
  assert.doesNotThrow(() => assertHoldoutSeal("dev", false));
});

test("sealed 거절 메시지가 개봉 이력 기록 의무를 알려 준다", () => {
  // 막는 것만으로는 부족하다 — 정당하게 열어야 하는 사람이 무엇을 해야 하는지 알아야 한다.
  try {
    assertHoldoutSeal("sealed", false);
    assert.fail("던져야 한다");
  } catch (e) {
    assert.match((e as Error).message, /seal-ledger\.json/);
  }
});

test("고정 표본(caseIds)이 목록대로 정확히 선택된다", () => {
  const spec = JSON.parse(
    readFileSync("evidence/bench/2026-07-31-m4-after/tasks.json", "utf8"),
  ) as { cases: Array<{ case_id: string }> };
  const ids = spec.cases.map((c) => c.case_id);
  const picked = loadAgenticSet("dev", false, { caseIds: ids });
  assert.equal(picked.length, ids.length, "M4 고정 세트 43건이 그대로 재현되어야 한다");
  assert.equal(new Set(picked.map((p) => p.case_id)).size, ids.length);
});

test("고정 표본에 없는 case_id 를 섞으면 조용히 건너뛰지 않고 실패한다", () => {
  // 분모가 몰래 줄어드는 것이 가장 나쁜 실패라서, 누락은 예외로 만든다.
  assert.throws(
    () => loadAgenticSet("dev", false, { caseIds: ["ag-d02", "존재하지-않는-케이스"] }),
    /요청한 case_id 1건이 split=dev 에 없다/,
  );
});

test("caseIds 를 주지 않으면 기존 동작이 그대로다", () => {
  const all = loadAgenticSet("dev");
  assert.ok(all.length > 43, `필터 없이는 dev 전건이 와야 한다 (실측 ${all.length}건)`);
});
