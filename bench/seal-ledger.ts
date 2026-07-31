/**
 * 봉인 개봉 강제 장치 (M6 step-4).
 *
 * ADR 0002 §4 는 "봉인 코드는 미개봉 문제가 실제로 생길 때 만든다"고 했다. 2026-08-01 확장이
 * `sealed` 20건을 만들었으므로 지금 만든다.
 *
 * **설계 요점 — 자동 append 하지 않는다.** 개봉할 때 코드가 이력을 알아서 써 주면, 그 장치는
 * 자기 자신을 만족시키므로 아무것도 막지 못한다("놀고 있는 장치"). 그래서 순서를 뒤집었다:
 * 사람이 ledger 에 개봉 사실을 **먼저** 적어야 러너가 돈다. 적지 않았으면 무엇을 적어야 하는지
 * 알려 주고 멈춘다.
 */
import { existsSync, readFileSync } from "node:fs";

export const SEAL_LEDGER_PATH = "bench/expansion/seal-ledger.json";

type Entry = {
  batch: string;
  status: string;
  opened_at?: string | null;
  opened_by?: string | null;
  opened_reason?: string | null;
  case_ids?: string[];
};

export type SealLedger = { entries: Entry[] };

export function readSealLedger(path = SEAL_LEDGER_PATH): SealLedger | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as SealLedger;
}

/**
 * `sealed` 를 개봉 플래그와 함께 열려고 할 때만 호출된다. 이력이 준비돼 있지 않으면 던진다.
 *
 * @param split 러너가 받은 split
 * @param sealBroken 개봉 플래그(`--i-am-closing-the-horizon`)
 */
export function assertSealOpening(split: string, sealBroken: boolean, path = SEAL_LEDGER_PATH): void {
  if (split !== "sealed" || !sealBroken) return;

  const ledger = readSealLedger(path);
  if (!ledger) {
    // 파일이 없을 때 조용히 진행하면 개봉이 흔적 없이 일어난다 — 그게 봉인이 죽는 방식이다.
    throw new Error(
      `개봉 이력 파일이 없다: ${path}\n`
        + "  봉인을 열려면 이력 파일이 있어야 한다 — 흔적 없는 개봉은 허용하지 않는다.",
    );
  }
  const sealedEntries = ledger.entries.filter((e) => (e.case_ids?.length ?? 0) > 0);
  const opened = sealedEntries.filter(
    (e) => e.status === "opened" && e.opened_at && e.opened_reason,
  );
  if (opened.length === 0) {
    throw new Error(
      "개봉 이력이 기록되지 않았다 — 봉인을 열기 전에 먼저 적어야 한다.\n"
        + `  ${path} 의 해당 항목에 status="opened", opened_at, opened_by, opened_reason 을 채워라.\n`
        + "  코드가 대신 적어 주지 않는다(자동 기록은 장치가 자기 자신을 만족시키는 것이라 아무것도 막지 못한다).\n"
        + "  ⚠ 개봉은 되돌릴 수 없다 — 열면 그 문항은 과적합 판정 근거로 다시 쓸 수 없다.",
    );
  }
}
