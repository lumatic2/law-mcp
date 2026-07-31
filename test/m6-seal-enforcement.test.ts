/**
 * 봉인 개봉 강제 장치 (M6 step-4).
 *
 * 봉인이 실효 없으면 이후의 과적합 판정 전체가 무의미해진다. 그래서 "막는다"만 보지 않고
 * **정당한 개봉 경로가 이력을 실제로 요구하는지**까지 본다.
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { assertSealOpening, readSealLedger, SEAL_LEDGER_PATH } from "../bench/seal-ledger.js";
import { loadAgenticSet } from "../bench/agentic-set.js";

function ledgerFile(entry: Record<string, unknown>): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "m6-seal-"));
  const path = join(dir, "seal-ledger.json");
  writeFileSync(path, JSON.stringify({ entries: [entry] }), "utf8");
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const SEALED_ENTRY = { batch: "t", status: "sealed", case_ids: ["exp-01", "exp-03"] };

test("sealed 가 아니거나 개봉 플래그가 없으면 이력을 보지 않는다", () => {
  // 이 함수는 개봉 경로 전용이다 — 평상시 dev 실행에 이력 파일을 요구하면 안 된다.
  assert.doesNotThrow(() => assertSealOpening("dev", false, "없는-파일.json"));
  assert.doesNotThrow(() => assertSealOpening("sealed", false, "없는-파일.json"));
});

test("이력 파일이 없으면 개봉이 실패한다 — 흔적 없는 개봉 금지", () => {
  assert.throws(
    () => assertSealOpening("sealed", true, "없는-파일.json"),
    /개봉 이력 파일이 없다/,
  );
});

test("이력에 개봉 기록이 없으면 개봉이 실패하고, 무엇을 적어야 하는지 알려 준다", () => {
  const f = ledgerFile(SEALED_ENTRY);
  try {
    assert.throws(() => assertSealOpening("sealed", true, f.path), (e: Error) => {
      assert.match(e.message, /개봉 이력이 기록되지 않았다/);
      assert.match(e.message, /status="opened"/);
      assert.match(e.message, /opened_reason/);
      // 자동 기록하지 않는 이유를 사람에게 설명해야 한다(안 그러면 다음 사람이 코드를 고친다).
      assert.match(e.message, /코드가 대신 적어 주지 않는다/);
      return true;
    });
  } finally {
    f.cleanup();
  }
});

test("이력에 개봉을 먼저 적으면 통과한다 — 상시 차단이 아님을 양방향 확인", () => {
  const f = ledgerFile({
    ...SEALED_ENTRY,
    status: "opened",
    opened_at: "2026-09-01",
    opened_by: "user",
    opened_reason: "과적합 판정 1회",
  });
  try {
    assert.doesNotThrow(() => assertSealOpening("sealed", true, f.path));
  } finally {
    f.cleanup();
  }
});

test("status 만 opened 이고 사유·일시가 비면 통과하지 않는다", () => {
  // 형식만 채우고 내용을 비우는 우회를 막는다.
  const f = ledgerFile({ ...SEALED_ENTRY, status: "opened", opened_at: null, opened_reason: null });
  try {
    assert.throws(() => assertSealOpening("sealed", true, f.path), /개봉 이력이 기록되지 않았다/);
  } finally {
    f.cleanup();
  }
});

test("실물 ledger 에 봉인 20건이 미개봉 상태로 등재돼 있다", () => {
  const ledger = readSealLedger(SEAL_LEDGER_PATH);
  assert.ok(ledger, `실물 ledger 가 있어야 한다: ${SEAL_LEDGER_PATH}`);
  const entry = ledger!.entries.find((e) => e.batch === "expansion-2026-08-01");
  assert.ok(entry, "확장 배치가 등재되어야 한다");
  assert.equal(entry!.status, "sealed");
  assert.equal(entry!.case_ids?.length, 20);
});

test("실물 봉인 20건이 코퍼스의 sealed 와 정확히 일치한다", () => {
  const corpus = JSON.parse(readFileSync("bench/corpus.json", "utf8")) as {
    items: Array<{ case_id: string; split: string }>;
  };
  const inCorpus = corpus.items.filter((i) => i.split === "sealed").map((i) => i.case_id).sort();
  const inLedger = [...(readSealLedger(SEAL_LEDGER_PATH)!.entries[0].case_ids ?? [])].sort();
  assert.deepEqual(inLedger, inCorpus, "ledger 와 코퍼스가 어긋나면 무엇이 봉인인지 아무도 못 읽는다");
});

test("에이전트 세트 로더도 개봉 이력 없이는 sealed 를 열지 않는다", () => {
  // 봉인 구현이 러너마다 다르면 하나만 고쳐지고 다른 하나로 샌다.
  assert.throws(() => loadAgenticSet("sealed", false), /봉인 문항\(sealed\)은 열지 않는다/);
  assert.throws(() => loadAgenticSet("sealed", true), /개봉 이력이 기록되지 않았다/);
});
