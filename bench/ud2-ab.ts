/**
 * UD2 step-2 — `aiSearch` 병합 교차 A/B.
 *
 * UD1 이 밝힌 것: 이 벤치의 문제는 노이즈가 아니라 **드리프트**다(60% 6회 → 48% 10회, 안 돌아옴).
 * 그래서 배치 A 전체 → 배치 B 전체로 재면 드리프트가 통째로 **나중에 잰 쪽의 불이익**이 된다.
 *
 * 이 러너는 그래서 **쿼리마다 모든 배치를 연달아** 잰다. 같은 시점·같은 쿼리에서 어느 쪽이
 * 맞았는지만 세므로 드리프트에 영향받지 않는다.
 *
 * 채택 조건(F13): **새로 깨지는 쿼리 0 AND 순 이득 ≥N건**. N 은 겨냥한 결함 유형이 dev 에
 * 몇 건 있느냐로 정한다 — 유형이 2건뿐인데 ≥3 을 요구하면 달성 불가능한 문턱이다(UD4).
 * **손실 0 은 어떤 경우에도 낮추지 않는다.**
 *
 *   npx tsx bench/ud2-ab.ts [--split dev] [--limit n] [--min-net 2]
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
  options: {
    limit: number;
    termBoost?: { enabled: boolean };
    aiSearch?: AiMergeConfig;
    parentLaw?: { enabled: boolean };
    titleSignal?: { enabled: boolean; window?: number };
  };
};

// UD4: control = UD2 출하 상태(본법 승격 off), 후보 = 본법 승격 on.
const UD4_VARIANTS: Variant[] = [
  { key: "control", label: "UD2 상태 (본법 승격 off)", options: { limit: 3, parentLaw: { enabled: false } } },
  { key: "parent", label: "본법 승격 on", options: { limit: 3, parentLaw: { enabled: true } } },
];

/**
 * TV4: control = 현 출하 상태(조문제목 신호 off). 후보는 **창 크기를 달리한 둘**이다.
 *
 * 창이 metric 의 k(=3) 이하면 재정렬해도 상위 3의 **구성이 안 바뀌어** recall@3 는 원리상
 * 못 움직인다(recall@1 만 움직인다). 그래서 창을 변수로 두고 값과 비용을 함께 잰다 —
 * 창 6은 plan 의 비용 예산(≤3)을 **넘는다**. 넘는 쪽은 측정만 하고, 채택은 step-3 이 정한다.
 */
// limit 은 도구 기본값과 같은 10 이다 — 창이 출력(3)보다 길어야 재정렬이 상위 3의 **구성**을
// 바꿀 수 있다. 판정은 반환 목록의 앞 3건(recall@3)으로 한다.
const TV4_VARIANTS: Variant[] = [
  { key: "control", label: "현 출하 상태 (신호 off)", options: { limit: 10 } },
  { key: "title3", label: "조문제목 신호 창3 (예산 내)", options: { limit: 10, titleSignal: { enabled: true, window: 3 } } },
  { key: "title6", label: "조문제목 신호 창6 (예산 초과)", options: { limit: 10, titleSignal: { enabled: true, window: 6 } } },
];

const VARIANT_SETS: Record<string, Variant[]> = { ud4: UD4_VARIANTS, tv4: TV4_VARIANTS };

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    split: get("--split") ?? "dev",
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    date: get("--date") ?? "2026-07-21",
    minNet: get("--min-net") ? Number(get("--min-net")) : 3,
    set: get("--set") ?? "golden-v2",
    variants: get("--variants") ?? "ud4",
    out: get("--out"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.split === "holdout") {
    throw new Error("홀드아웃은 봉인돼 있다 — A/B 는 dev 로만 잰다.");
  }

  const VARIANTS = VARIANT_SETS[args.variants];
  if (!VARIANTS) throw new Error(`알 수 없는 배치 묶음: ${args.variants} (${Object.keys(VARIANT_SETS).join("·")})`);

  const root = resolve(process.cwd(), `bench/${args.set}.json`);
  const all = JSON.parse(readFileSync(root, "utf8")).items as Item[];
  const items = all.filter((item) => item.split === args.split).slice(0, args.limit ?? Infinity);

  // 배치마다 새 provider — 캐시 공유가 A/B 를 오염시키지 않게 한다(UD1 σ=0 사고).
  const providers = new Map(VARIANTS.map((v) => [v.key, new LawGoProvider()]));
  const rows: Array<Record<string, unknown>> = [];

  for (const [index, item] of items.entries()) {
    const outcome: Record<string, { hit3: boolean; returned: string[]; ms: number }> = {};

    // ★ 교차 측정 — 한 쿼리 안에서 모든 배치를 연달아 잰다.
    for (const variant of VARIANTS) {
      const started = Date.now();
      try {
        const result = await providers.get(variant.key)!.searchLaw(item.query, variant.options);
        const returned = result.items.map((i) => i.law_name);
        outcome[variant.key] = {
          hit3: isHitAtK(returned, item.expected_laws, 3),
          returned,
          ms: Date.now() - started,
        };
      } catch (error) {
        outcome[variant.key] = {
          hit3: false,
          returned: [`ERR ${(error as Error).message.slice(0, 40)}`],
          ms: Date.now() - started,
        };
      }
    }

    rows.push({ query: item.query, domain: item.domain, expected: item.expected_laws, outcome });
    const marks = VARIANTS.map((v) => `${v.key}=${outcome[v.key].hit3 ? "O" : "X"}`).join(" ");
    console.log(`[${index + 1}/${items.length}] ${item.query} — ${marks}`);
  }

  console.log("\n=== 배치별 recall@3 · 지연 (참고 수치 — 판정 근거 아님) ===");
  for (const variant of VARIANTS) {
    const cells = rows.map((row) => (row.outcome as Record<string, { hit3: boolean; ms: number }>)[variant.key]);
    const hits = cells.filter((cell) => cell.hit3).length;
    const times = cells.map((cell) => cell.ms).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    console.log(
      `  ${variant.label.padEnd(28)} ${((hits / rows.length) * 100).toFixed(1)}%  (${hits}/${rows.length})` +
      `  · 중앙 ${median}ms · p90 ${times[Math.floor(times.length * 0.9)]}ms`,
    );
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
    const pass = broke.length === 0 && net >= args.minNet;
    console.log(`\n  ${variant.label} — 이득 ${won.length} / 손실 ${broke.length} / 순 ${net >= 0 ? "+" : ""}${net}  → ${pass ? "**채택 가능**" : "채택 불가"}`);
    if (won.length) console.log(`    이득: ${won.join(" · ")}`);
    if (broke.length) console.log(`    손실: ${broke.join(" · ")}`);
  }

  const out = resolve(process.cwd(), args.out ?? `evidence/bench/${args.date}-ud2-ab.json`);
  mkdirSync(resolve(process.cwd(), "evidence/bench"), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ set: args.set, split: args.split, variants: VARIANTS, rows, verdicts }, null, 2),
    "utf8",
  );
  console.log(`\n  → ${out}`);
}

main();
