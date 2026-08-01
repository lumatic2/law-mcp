/**
 * M9 step-4 — 세법 12종의 현행 조문 전량을 scratchpad 에 수집한다.
 *
 * 레포에는 수집 manifest 만 남기고 조문 본문은 커밋하지 않는다. 법령명 완전일치가 깨지면
 * 다른 법으로 폴백하지 않고 즉시 중단한다(M5 지방세법 오선택 재발 방지).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { extractArticles } from "../../src/article-index.js";

type LawSpec = { law: string; mst: string; total: number };
type TopicFile = { laws: LawSpec[] };
type Corpus = {
  items: Array<{
    case_id: string;
    provenance?: string;
    split: string;
    expected_article?: string;
  }>;
};

type CollectedArticle = {
  law_name: string;
  law_id: string;
  mst: string;
  article_no: string;
  display: string;
  title: string;
  text: string;
};

type LawResult = {
  law: string;
  mst: string;
  law_id: string;
  expected_count: number;
  collected_count: number;
  difference: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function splitExpected(expected: string): { law: string; article: string } {
  const match = /^(.*?)\s*(제\d+조(?:의\d+)?)\s*$/.exec(expected);
  if (!match) throw new Error(`정답 표기를 못 갈랐다: ${expected}`);
  return { law: match[1].trim(), article: match[2] };
}

async function fetchLaw(spec: LawSpec, oc: string): Promise<Record<string, unknown>> {
  const url = new URL("https://www.law.go.kr/DRF/lawService.do");
  url.searchParams.set("OC", oc);
  url.searchParams.set("target", "law");
  url.searchParams.set("type", "JSON");
  url.searchParams.set("MST", spec.mst);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${spec.law}: upstream HTTP ${response.status}`);
  const root = (await response.json()) as Record<string, unknown>;
  const law = asRecord(root.법령 ?? asRecord(root.LawService).법령);
  const basic = asRecord(law.기본정보 ?? law.법령기본정보);
  const actualName = text(basic.법령명_한글 ?? basic.법령명한글 ?? basic.법령명);
  if (actualName !== spec.law) {
    throw new Error(
      `${spec.law}: 법령명 완전일치 실패(request MST=${spec.mst}, response="${actualName}") — 폴백 금지`,
    );
  }
  return root;
}

function manifestMarkdown(args: {
  collectedAt: string;
  dumpPath: string;
  dumpSha256: string;
  laws: LawResult[];
  totalExpected: number;
  totalCollected: number;
  devMissing: string[];
}): string {
  const rows = args.laws.map((law) =>
    `| ${law.law} | ${law.mst} | ${law.law_id} | ${law.expected_count} | ${law.collected_count} | ${law.difference >= 0 ? "+" : ""}${law.difference} |`,
  );
  return `# M9 세법 12종 조문 수집 manifest\n\n`
    + `- 조회 시각: ${args.collectedAt}\n`
    + `- 조회 경로: 법제처 DRF \`lawService.do?target=law&type=JSON&MST=<승인 MST>\`, 법당 1회(총 12회)\n`
    + `- scratchpad 덤프: \`${args.dumpPath.replace(/\\/g, "/")}\` (레포 밖, 커밋 금지)\n`
    + `- 덤프 SHA-256: \`${args.dumpSha256}\`\n`
    + `- 조문 수: 계획 기준 ${args.totalExpected.toLocaleString("ko-KR")} / 수집 ${args.totalCollected.toLocaleString("ko-KR")}\n`
    + `- MST 검증: 요청에는 승인 MST를 직접 사용했다. DRF 전문 응답은 MST를 되돌려 주지 않아 응답 법령명 완전일치와 법령ID를 검증했다. 불일치 폴백은 없다.\n`
    + `- 수리 후 dev 40 정답 조문 존재: ${args.devMissing.length === 0 ? "PASS (40/40)" : `FAIL (${40 - args.devMissing.length}/40)`}\n\n`
    + `| 법령 | 요청 MST | 응답 법령ID | 계획 조문 수 | 수집 조문 수 | 차이 |\n`
    + `|---|---:|---:|---:|---:|---:|\n`
    + `${rows.join("\n")}\n\n`
    + `## 실패 프로브\n\n`
    + `- 법령명 완전일치 실패: 발생하지 않음. 발생 시 즉시 예외를 던지고 다른 검색 결과로 폴백하지 않는 코드 경로를 유지한다.\n`
    + `- 계획 조문 수 불일치: ${args.laws.some((law) => law.difference !== 0) ? "발생 — 위 표의 차이는 상류 개정 가능성으로 기록하며 임의 보정하지 않았다." : "발생하지 않음."}\n`
    + `- dev 정답 누락: ${args.devMissing.length === 0 ? "없음." : args.devMissing.join(", ")}\n`;
}

async function main(): Promise<void> {
  const oc = process.env.LAW_API_OC;
  if (!oc) throw new Error("LAW_API_OC 미설정");
  const dumpPath = resolve(
    process.argv[2] ?? process.env.LAW_MCP_M9_SCRATCH ?? join(tmpdir(), "law-mcp-m9-mapping-probe", "articles.json"),
  );
  const manifestPath = resolve(
    process.argv[3] ?? "evidence/bench/2026-08-01-m9-taxonomy/collection-manifest.md",
  );
  const topicFile = JSON.parse(readFileSync("bench/expansion/topics-2026-08-01.json", "utf-8")) as TopicFile;
  if (topicFile.laws.length !== 12) throw new Error(`세법 목록이 12종이 아니다: ${topicFile.laws.length}`);

  const articles: CollectedArticle[] = [];
  const laws: LawResult[] = [];
  for (const spec of topicFile.laws) {
    const root = await fetchLaw(spec, oc);
    const law = asRecord(root.법령 ?? asRecord(root.LawService).법령);
    const basic = asRecord(law.기본정보 ?? law.법령기본정보);
    const lawId = text(basic.법령ID ?? basic.법령아이디);
    if (!lawId) throw new Error(`${spec.law}: 응답 법령ID 없음`);
    // M5 `expand-topics.ts` 와 같은 실체 조문 정의: 제목이 있는 조문만 센다.
    // 법제처 응답에는 제목이 빈 폐지·자리표시 조문도 `조문여부: "조문"` 으로 들어온다.
    const extracted = extractArticles(root).filter(
      (article) => typeof article.title === "string" && article.title.trim().length > 0,
    );
    articles.push(...extracted.map((article) => ({
      law_name: spec.law,
      law_id: lawId,
      mst: spec.mst,
      article_no: article.article_no,
      display: article.display,
      title: article.title,
      text: article.text,
    })));
    laws.push({
      law: spec.law,
      mst: spec.mst,
      law_id: lawId,
      expected_count: spec.total,
      collected_count: extracted.length,
      difference: extracted.length - spec.total,
    });
    process.stderr.write(`${spec.law}: ${extracted.length}/${spec.total}\n`);
  }

  const corpus = JSON.parse(readFileSync("bench/corpus.json", "utf-8")) as Corpus;
  const devExpected = corpus.items
    .filter((item) => item.provenance === "expansion-2026-08-01" && item.split === "dev")
    .map((item) => ({ caseId: item.case_id, ...splitExpected(item.expected_article ?? "") }));
  if (devExpected.length !== 40) throw new Error(`수리 후 dev 문항이 40건이 아니다: ${devExpected.length}`);
  const articleKeys = new Set(articles.map((article) => `${article.law_name}|${article.display}`));
  const devMissing = devExpected
    .filter((item) => !articleKeys.has(`${item.law}|${item.article}`))
    .map((item) => `${item.caseId}:${item.law} ${item.article}`);
  if (devMissing.length > 0) throw new Error(`dev 정답 조문 누락: ${devMissing.join(", ")}`);

  const collectedAt = new Date().toISOString();
  const dump = `${JSON.stringify({ schema_version: 1, collected_at: collectedAt, laws, articles }, null, 1)}\n`;
  const dumpSha256 = createHash("sha256").update(dump).digest("hex");
  mkdirSync(dirname(dumpPath), { recursive: true });
  writeFileSync(dumpPath, dump, "utf-8");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, manifestMarkdown({
    collectedAt,
    dumpPath,
    dumpSha256,
    laws,
    totalExpected: laws.reduce((sum, law) => sum + law.expected_count, 0),
    totalCollected: articles.length,
    devMissing,
  }), "utf-8");
  process.stdout.write(`${JSON.stringify({ dumpPath, dumpSha256, laws: laws.length, articles: articles.length, devExpected: devExpected.length }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`collect-articles 실패: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
