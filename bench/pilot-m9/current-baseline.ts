/**
 * M9 step-3 — 현행 경로의 **조문 단위** top-k 도달 기준선. 손실축의 기준이 되는 값이다.
 *
 * ⚠ **M8 의 에이전틱 지표로 이걸 대체할 수 없다.** M8 은 다회 재질의·본문 확인·6호출 예산을
 * 가진 에이전트가 낸 값이고, 여기는 **단발 검색의 top-k** 다. 단위가 다른 두 값을 빼면 손실이
 * 체계적으로 과소 산출된다(승인 전 검증자 S3).
 *
 * 계획 D2 로 고정된 비교 단위: 조문 단위 · k=3,10 · 질의 필드 `query` · "현행" = `searchLaw`
 * 최종 응답(aiSearch 병합·재정렬 후).
 *
 * 읽기 전용 — `src/` 를 건드리지 않는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { LawGoProvider } from "../../src/providers/lawgo-provider.js";
import type { SearchLawResult } from "../../src/types.js";

const provider = new LawGoProvider();

export type ArticleHit = { law_name: string; article: string; source: "ai" | "linked" };

/**
 * 검색 응답에서 **조문 후보 목록**을 응답 순서대로 뽑는다.
 *
 * 순서 규칙: 법령 항목 순서를 유지하면서 각 항목의 `ai_articles`(관련도 신호)를 먼저,
 * `linked_articles`(용어 연계)를 뒤에 놓는다. 두 신호는 출처가 달라 섞지 않는다(types.ts).
 */
export function extractArticleCandidates(res: SearchLawResult): ArticleHit[] {
  const out: ArticleHit[] = [];
  const seen = new Set<string>();
  const push = (law_name: string, article: string, source: "ai" | "linked") => {
    const key = `${law_name}|${article}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ law_name, article, source });
  };
  for (const item of res.items ?? []) {
    for (const a of item.ai_articles ?? []) push(item.law_name, a.article, "ai");
  }
  for (const item of res.items ?? []) {
    for (const a of item.linked_articles ?? []) push(item.law_name, a, "linked");
  }
  return out;
}

/** "국제조세조정에 관한 법률 제19조" → { law: "국제조세조정에 관한 법률", article: "제19조" } */
export function splitExpected(expected: string): { law: string; article: string } {
  const m = /^(.*?)\s*(제\d+조(?:의\d+)?)\s*$/.exec(expected);
  if (!m) throw new Error(`정답 표기를 못 갈랐다: ${expected}`);
  return { law: m[1].trim(), article: m[2] };
}

export type Row = {
  case_id: string;
  query: string;
  expected: string;
  rank: number | null;
  in_top3: boolean;
  in_top10: boolean;
  candidates: number;
  top3: string[];
};

export async function measure(caseId: string, query: string, expected: string): Promise<Row> {
  const want = splitExpected(expected);
  const res = (await provider.searchLaw(query, { limit: 10 })) as SearchLawResult;
  const cands = extractArticleCandidates(res);
  const idx = cands.findIndex((c) => c.law_name === want.law && c.article === want.article);
  return {
    case_id: caseId,
    query,
    expected,
    rank: idx < 0 ? null : idx + 1,
    in_top3: idx >= 0 && idx < 3,
    in_top10: idx >= 0 && idx < 10,
    candidates: cands.length,
    top3: cands.slice(0, 3).map((c) => `${c.law_name} ${c.article}`),
  };
}

type Task = { case_id: string; query: string; expected: string };

function tasksFromCorpus(provenance: string): Task[] {
  const corpus = JSON.parse(readFileSync("bench/corpus.json", "utf-8")) as {
    items: Array<{
      case_id: string;
      provenance?: string;
      split: string;
      query?: string;
      expected_article?: string;
    }>;
  };
  return corpus.items
    .filter((i) => i.provenance === provenance && i.split === "dev" && i.query && i.expected_article)
    .map((i) => ({ case_id: i.case_id, query: i.query as string, expected: i.expected_article as string }));
}

async function main(): Promise<void> {
  const outPath = process.argv[2];
  if (!outPath) throw new Error("사용법: current-baseline.ts <out.json> [--tasks <file>]");
  const tasksFlag = process.argv.indexOf("--tasks");
  const tasks: Task[] =
    tasksFlag > 0
      ? (JSON.parse(readFileSync(process.argv[tasksFlag + 1], "utf-8")) as { tasks: Task[] }).tasks
      : tasksFromCorpus("expansion-2026-08-01");

  const rows: Row[] = [];
  for (const t of tasks) {
    try {
      const r = await measure(t.case_id, t.query, t.expected);
      rows.push(r);
      process.stderr.write(
        `${r.case_id} rank=${r.rank ?? "-"} cands=${r.candidates} ${r.in_top3 ? "TOP3" : ""}\n`,
      );
    } catch (e) {
      process.stderr.write(`${t.case_id} 실패: ${e instanceof Error ? e.message : String(e)}\n`);
      rows.push({
        case_id: t.case_id,
        query: t.query,
        expected: t.expected,
        rank: null,
        in_top3: false,
        in_top10: false,
        candidates: 0,
        top3: [],
      });
    }
  }
  const top3 = rows.filter((r) => r.in_top3).length;
  const top10 = rows.filter((r) => r.in_top10).length;
  const summary = {
    n: rows.length,
    top3,
    top10,
    top3_rate: Number(((top3 / rows.length) * 100).toFixed(1)),
    top10_rate: Number(((top10 / rows.length) * 100).toFixed(1)),
    unit: "조문 단위 · 질의=query · 현행 searchLaw 최종 응답(aiSearch 병합 후)",
  };
  writeFileSync(outPath, `${JSON.stringify({ summary, rows }, null, 1)}\n`, "utf-8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && /current-baseline\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(`current-baseline 실패: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
