/**
 * M9 step-2 — 질의 정규화만으로 풀리는 건수(상한). **도구를 고치지 않는다.**
 *
 * 재는 것: 질의를 오프라인에서 변형(동의어 치환 · 공백·표기 정규화)해 **현행 검색 경로**에
 * 그대로 넣었을 때 조문 top-k 도달이 몇 건 늘어나나. 구현은 판정 후 별건(계획 D6).
 *
 * ⚠ **사전을 정답을 보고 키우면 상한이 부풀어 무의미해진다.** 사전 항목은 실패 세트에서 유도된
 * 최소 집합으로 고정하고, 항목 수와 근거를 산출물에 남긴다(계획 step-2 Verify).
 *
 * 읽기 전용 — `src/` 를 건드리지 않는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { measure, type Row } from "./current-baseline.js";

/**
 * 동의어 소사전 — **실패 세트에서 유도된 최소 집합**.
 *
 * 각 항목은 "어느 실패 건이 이걸 요구했나"를 근거로 갖는다. 근거 없는 항목은 넣지 않는다.
 */
export const SYNONYMS: Array<{ from: RegExp; to: string; why: string }> = [
  { from: /미국/g, to: "미합중국", why: "cand-P — 조약명은 '미합중국', 사용자는 '미국'" },
  { from: /농업용\s*기름|농기계용\s*기름|농업용\s*석유/g, to: "면세유류", why: "exp-42·43 — 조문 용어는 '면세유류'" },
  { from: /공공기관\s*직원/g, to: "위탁", why: "exp-39 — 조문 용어는 '징수 위탁'" },
  { from: /해지할?\s*때\s*돌려줄\s*돈|해지\s*대비\s*적립액/g, to: "해약환급금준비금", why: "exp-06 — 조문 용어" },
];

/** 공백·표기 정규화 — 조약명·복합어의 띄어쓰기 민감 매칭 대응. */
export function normalizeSpacing(q: string): string {
  return q
    .replace(/\s*[·ㆍ]\s*/g, "")
    .replace(/\s*—\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function applySynonyms(q: string): { out: string; applied: string[] } {
  let out = q;
  const applied: string[] = [];
  for (const s of SYNONYMS) {
    if (s.from.test(out)) {
      out = out.replace(s.from, s.to);
      applied.push(s.why);
    }
    s.from.lastIndex = 0;
  }
  return { out, applied };
}

/**
 * 확장 모드 — 원문을 **지우지 않고** 법률 용어를 덧붙인다.
 *
 * 왜 두 모드인가: 치환 모드는 구를 통째로 갈아 문장을 망가뜨린다(실측: "공공기관 직원이 체납
 * 연락" → "위탁이 체납 연락"). 실제 구현은 원문을 보존하며 용어를 더하는 쪽일 가능성이 높으므로
 * 상한을 두 방식 모두에서 재고 더 좋은 쪽을 상한으로 삼는다.
 */
export function expandSynonyms(q: string): { out: string; applied: string[] } {
  const adds: string[] = [];
  const applied: string[] = [];
  for (const s of SYNONYMS) {
    if (s.from.test(q)) {
      if (!q.includes(s.to)) adds.push(s.to);
      applied.push(s.why);
    }
    s.from.lastIndex = 0;
  }
  return { out: adds.length ? `${q} ${adds.join(" ")}` : q, applied };
}

export type Mode = "replace" | "expand";

export function transform(q: string, mode: Mode = "replace"): { out: string; applied: string[]; changed: boolean } {
  const syn = mode === "replace" ? applySynonyms(q) : expandSynonyms(q);
  const out = normalizeSpacing(syn.out);
  const spacingChanged = out !== normalizeSpacing(q);
  const applied = [...syn.applied];
  if (spacingChanged && syn.applied.length === 0) applied.push("공백·표기 정규화");
  return { out, applied, changed: out !== q };
}

type Task = { case_id: string; query: string; expected: string };

async function main(): Promise<void> {
  const outPath = process.argv[2];
  const tasksPath = process.argv[3];
  const mode: Mode = process.argv.includes("--expand") ? "expand" : "replace";
  if (!outPath || !tasksPath) throw new Error("사용법: normalize-probe.ts <out.json> <tasks.json> [--expand]");
  const { tasks } = JSON.parse(readFileSync(tasksPath, "utf-8")) as { tasks: Task[] };

  const rows: Array<{ before: Row; after: Row; applied: string[]; verdict: string }> = [];
  for (const t of tasks) {
    const before = await measure(t.case_id, t.query, t.expected);
    const tr = transform(t.query, mode);
    const after = tr.changed ? await measure(t.case_id, tr.out, t.expected) : before;
    let verdict = "변화 없음";
    if (!tr.changed) verdict = "변형 대상 아님";
    else if (!before.in_top3 && after.in_top3) verdict = "해결(top3 진입)";
    else if (before.in_top3 && !after.in_top3) verdict = "손실(top3 이탈)";
    else if (before.rank && after.rank && after.rank < before.rank) verdict = "순위 개선";
    else if (before.rank && after.rank && after.rank > before.rank) verdict = "순위 악화";
    rows.push({ before, after, applied: tr.applied, verdict });
    process.stderr.write(
      `${t.case_id}: ${before.rank ?? "-"} → ${after.rank ?? "-"}  ${verdict}  [${tr.applied.join(" / ") || "-"}]\n`,
    );
  }
  const summary = {
    mode,
    n: rows.length,
    dictionary_entries: SYNONYMS.length,
    solved: rows.filter((r) => r.verdict === "해결(top3 진입)").length,
    lost: rows.filter((r) => r.verdict === "손실(top3 이탈)").length,
    improved: rows.filter((r) => r.verdict === "순위 개선").length,
    worsened: rows.filter((r) => r.verdict === "순위 악화").length,
    untouched: rows.filter((r) => r.verdict === "변형 대상 아님").length,
  };
  writeFileSync(outPath, `${JSON.stringify({ summary, dictionary: SYNONYMS.map((s) => s.why), rows }, null, 1)}\n`, "utf-8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && /normalize-probe\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(`normalize-probe 실패: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
