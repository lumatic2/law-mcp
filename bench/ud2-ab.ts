/**
 * UD2 step-2 — `aiSearch` 병합 교차 A/B.
 *
 * UD1 이 밝힌 것: 이 벤치의 문제는 노이즈가 아니라 **드리프트**다(60% 6회 → 48% 10회, 안 돌아옴).
 * 그래서 배치 A 전체 → 배치 B 전체로 재면 드리프트가 통째로 **나중에 잰 쪽의 불이익**이 된다.
 *
 * 이 러너는 그래서 **쿼리마다 모든 배치를 연달아** 잰다. 같은 시점·같은 쿼리에서 어느 쪽이
 * 맞았는지만 세므로 드리프트에 영향받지 않는다.
 *
 * 채택 조건(F13): **새로 깨지는 쿼리 0 AND 순 이득 ≥3건**.
 *
 *   npx tsx bench/ud2-ab.ts [--split dev] [--limit n]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { isHitAtK } from "./scoring.js";
import type { AiMergeConfig } from "../src/ai-search.js";

type Item = { query: string; domain: string; expected_laws: string[]; split: string };

type Variant = {
  key: string;
  label: string;
  options: { limit: number; termBoost?: { enabled: boolean }; aiSearch?: AiMergeConfig };
};

const VARIANTS: Variant[] = [
  { key: "control", label: "기존 단독 (LB5)", options: { limit: 3 } },
  { key: "ai_only", label: "aiSearch 단독", options: { limit: 3, termBoost: { enabled: false }, aiSearch: { enabled: true, maxLaws: 3 } } },
  { key: "merge_ai", label: "병합·aiSearch 우선", options: { limit: 3, aiSearch: { enabled: true, priority: "ai" } } },
  { key: "merge_boost", label: "병합·부스트 우선", options: { limit: 3, aiSearch: { enabled: true, priority: "boost" } } },
];

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    split: get("--split") ?? "dev",
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    date: get("--date") ?? "2026-07-21",
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.split === "holdout") {
    throw new Error("홀드아웃은 봉인돼 있다 — A/B 는 dev 로만 잰다.");
  }

  const root = resolve(process.cwd(), "bench/golden-v2.json");
  const all = JSON.parse(readFileSync(root, "utf8")).items as Item[];
  const items = all.filter((item) => item.split === args.split).slice(0, args.limit ?? Infinity);

  // 배치마다 새 provider — 캐시 공유가 A/B 를 오염시키지 않게 한다(UD1 σ=0 사고).
  const providers = new Map(VARIANTS.map((v) => [v.key, new LawGoProvider()]));
  const rows: Array<Record<string, unknown>> = [];

  for (const [index, item] of items.entries()) {
    const outcome: Record<string, { hit3: boolean; returned: string[] }> = {};

    // ★ 교차 측정 — 한 쿼리 안에서 모든 배치를 연달아 잰다.
    for (const variant of VARIANTS) {
      try {
        const result = await providers.get(variant.key)!.searchLaw(item.query, variant.options);
        const returned = result.items.map((i) => i.law_name);
        outcome[variant.key] = { hit3: isHitAtK(returned, item.expected_laws, 3), returned };
      } catch (error) {
        outcome[variant.key] = { hit3: false, returned: [`ERR ${(error as Error).message.slice(0, 40)}`] };
      }
    }

    rows.push({ query: item.query, domain: item.domain, expected: item.expected_laws, outcome });
    const marks = VARIANTS.map((v) => `${v.key}=${outcome[v.key].hit3 ? "O" : "X"}`).join(" ");
    console.log(`[${index + 1}/${items.length}] ${item.query} — ${marks}`);
  }

  console.log("\n=== 배치별 recall@3 (참고 수치 — 판정 근거 아님) ===");
  for (const variant of VARIANTS) {
    const hits = rows.filter((row) => (row.outcome as Record<string, { hit3: boolean }>)[variant.key].hit3).length;
    console.log(`  ${variant.label.padEnd(22)} ${((hits / rows.length) * 100).toFixed(1)}%  (${hits}/${rows.length})`);
  }

  console.log("\n=== 쿼리 단위 승패 (control 대비 — 이게 판정 근거다) ===");
  const verdicts: Record<string, { won: string[]; broke: string[] }> = {};
  for (const variant of VARIANTS.filter((v) => v.key !== "control")) {
    const won: string[] = [];
    const broke: string[] = [];
    for (const row of rows) {
      const o = row.outcome as Record<string, { hit3: boolean }>;
      if (!o.control.hit3 && o[variant.key].hit3) won.push(row.query as string);
      if (o.control.hit3 && !o[variant.key].hit3) broke.push(row.query as string);
    }
    verdicts[variant.key] = { won, broke };
    const net = won.length - broke.length;
    const pass = broke.length === 0 && net >= 3;
    console.log(`\n  ${variant.label} — 이득 ${won.length} / 손실 ${broke.length} / 순 ${net >= 0 ? "+" : ""}${net}  → ${pass ? "**채택 가능**" : "채택 불가"}`);
    if (won.length) console.log(`    이득: ${won.join(" · ")}`);
    if (broke.length) console.log(`    손실: ${broke.join(" · ")}`);
  }

  const out = resolve(process.cwd(), `evidence/bench/${args.date}-ud2-ab.json`);
  mkdirSync(resolve(process.cwd(), "evidence/bench"), { recursive: true });
  writeFileSync(out, JSON.stringify({ split: args.split, variants: VARIANTS, rows, verdicts }, null, 2), "utf8");
  console.log(`\n  → ${out}`);
}

main();
