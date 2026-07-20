/**
 * LB5 step-2 — 용어 연계 부스트 A/B 스윕.
 *
 * 같은 dev 쿼리에 부스트 설정만 바꿔 돌려 blind recall@1/@3 을 비교한다.
 * 기준선(off)이 44.0%/40.0% 와 일치하는지 먼저 확인해 측정 자체의 정합성을 검증한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isHitAtK } from "./scoring.js";
import { LawGoProvider, type TermBoostConfig } from "../src/providers/lawgo-provider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, "golden.json"), "utf-8")) as {
  items: Array<{ query: string; domain: string; split: string; expected_laws: string[] }>;
};
const items = golden.items.filter((item) => item.split === "dev");

const VARIANTS: Array<{ label: string; config: TermBoostConfig }> = [
  { label: "off (기준선)", config: { enabled: false } },
  { label: "maxLaws=1 minLinks=1", config: { maxLaws: 1, minLinks: 1, maxTerms: 1 } },
  { label: "maxLaws=2 minLinks=1", config: { maxLaws: 2, minLinks: 1, maxTerms: 1 } },
  { label: "maxLaws=1 minLinks=2", config: { maxLaws: 1, minLinks: 2, maxTerms: 1 } },
  { label: "maxLaws=2 minLinks=2", config: { maxLaws: 2, minLinks: 2, maxTerms: 1 } },
  { label: "maxLaws=2 minLinks=1 maxTerms=2", config: { maxLaws: 2, minLinks: 1, maxTerms: 2 } },
];

type Row = { label: string; r1: number; r3: number; changed: number; broke: string[]; fixed: string[] };
const rows: Row[] = [];
const baselineHits = new Map<string, boolean>();

for (const variant of VARIANTS) {
  const provider = new LawGoProvider();
  let hit1 = 0;
  let hit3 = 0;
  let changed = 0;
  const broke: string[] = [];
  const fixed: string[] = [];

  for (const item of items) {
    let returned: string[] = [];
    try {
      const result = await provider.searchLaw(item.query, { limit: 3, termBoost: variant.config });
      returned = result.items.map((entry) => entry.law_name);
      if ((result.warnings ?? []).some((w) => w.includes("법령용어 연계"))) changed += 1;
    } catch (error) {
      console.error(`  ! ${item.query}: ${(error as Error).message.slice(0, 80)}`);
    }
    const at1 = isHitAtK(returned, item.expected_laws, 1);
    const at3 = isHitAtK(returned, item.expected_laws, 3);
    if (at1) hit1 += 1;
    if (at3) hit3 += 1;

    if (variant.config.enabled === false) {
      baselineHits.set(item.query, at3);
    } else {
      const was = baselineHits.get(item.query) ?? false;
      if (was && !at3) broke.push(item.query);
      if (!was && at3) fixed.push(item.query);
    }
  }

  const pct = (n: number) => (n / items.length) * 100;
  rows.push({ label: variant.label, r1: pct(hit1), r3: pct(hit3), changed, broke, fixed });
  console.error(`done: ${variant.label} — recall@3 ${pct(hit3).toFixed(1)}%`);
}

const out: string[] = [];
out.push(`# LB5 step-2 — 용어 연계 부스트 A/B (dev ${items.length}건, blind)`);
out.push("");
out.push("| 설정 | recall@1 | recall@3 | 부스트 발동 | 새로 맞힘 | 새로 틀림 |");
out.push("|---|---|---|---|---|---|");
for (const row of rows) {
  out.push(
    `| ${row.label} | ${row.r1.toFixed(1)}% | ${row.r3.toFixed(1)}% | ${row.changed}건 | `
    + `${row.fixed.length} | ${row.broke.length} |`,
  );
}
out.push("");
for (const row of rows.filter((r) => r.fixed.length || r.broke.length)) {
  out.push(`### ${row.label}`);
  if (row.fixed.length) out.push(`- 새로 맞힘: ${row.fixed.join(" / ")}`);
  if (row.broke.length) out.push(`- **새로 틀림**: ${row.broke.join(" / ")}`);
  out.push("");
}

const target = path.resolve(__dirname, "../evidence/bench/2026-07-21-lb5-boost-sweep.md");
fs.writeFileSync(target, out.join("\n"), "utf-8");
console.log(out.join("\n"));
