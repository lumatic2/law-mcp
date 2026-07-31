/**
 * M9 step-1 — 질의 × 정답 조문 어휘 겹침 수치화.
 *
 * 유형 ①(어휘 무공유)을 **사람 감이 아니라 수치로** 가른다. 질의 토큰 중 몇 개가 정답 조문의
 * 표제·본문에 실제로 나타나는지를 센다. 겹침이 0 이면 문자열 매칭 계열로는 원리적으로 못 찾고,
 * 의미 기반 검색만 가능하다 — 그게 임베딩이 이길 수 있는 유일한 유형이다.
 *
 * ⚠ 이 모듈은 **읽기 전용 프로브**다. `src/` 를 건드리지 않고 코퍼스도 읽기만 한다.
 */
import { readFileSync } from "node:fs";
import { LawGoProvider } from "../../src/providers/lawgo-provider.js";

const provider = new LawGoProvider();

/**
 * 조사·어미를 떼고 **2자 이상** 내용어만 남긴다.
 *
 * ⚠ 임계값을 3자로 두면 안 된다 — 한국 법률어의 다수가 2자다(관세·세관·징수·신고·체납·경정).
 * 처음 `check-term-exposure` 의 3자 규칙을 그대로 빌렸다가 질의당 토큰이 1~2개로 줄어
 * 겹침 비율이 의미를 잃었다(실측). 그 검사는 *유출 방지*라 일반어를 버려도 되지만, 여기는
 * *변별력 측정*이라 버리면 안 된다. 대신 아래 GENERIC 으로 진짜 일반어만 뺀다.
 */
const PARTICLES = /(으로써|에게서|으로서|이라는|에서는|으로는|에게는|까지|부터|에서|에게|으로|라는|이나|든지|와의|과의|에는|은|는|이|가|을|를|의|에|도|로|와|과|만|나)$/;

const GENERIC = new Set([
  "경우", "때문", "관련", "대한", "대해", "가능", "여부", "내용", "사람", "사항", "기준",
  "방법", "다시", "그것", "무엇", "어떤", "어떻", "얼마", "정도", "이런", "저런", "그런",
  "있는", "없는", "하는", "되는", "받은", "받는", "하고", "되고", "올려", "잡은", "넣어",
  "판", "뒤", "및", "또는", "등",
]);

export function tokenize(text: string): string[] {
  const raw = text
    .replace(/[^가-힣A-Za-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (const w of raw) {
    const stripped = w.replace(PARTICLES, "");
    const t = stripped.length >= 2 ? stripped : w;
    if (t.length >= 2 && !GENERIC.has(t)) out.add(t);
  }
  return [...out];
}

/** 토큰이 대상 문자열에 나타나나 — 양방향 부분일치(법률 복합어는 조문 표기보다 길다). */
function appears(token: string, haystack: string): boolean {
  if (haystack.includes(token)) return true;
  // 복합어 대응: 토큰을 3자 창으로 훑어 하나라도 걸리면 부분 적중으로 센다.
  for (let i = 0; i + 3 <= token.length; i += 1) {
    if (haystack.includes(token.slice(i, i + 3))) return true;
  }
  return false;
}

export type Side = { tokens: number; hit_exact: number; hit_partial: number; ratio: number; missing: string[] };

export type Overlap = {
  case_id: string;
  expected_article: string;
  query: string;
  /** 결정적 러너가 쓰는 필드 */
  by_query: Side;
  /** 블라인드 에이전트가 실제로 읽는 필드 */
  by_context: Side;
};

function side(text: string, body: string): Side {
  const tokens = tokenize(text);
  let exact = 0;
  let partial = 0;
  const missing: string[] = [];
  for (const t of tokens) {
    if (body.includes(t)) exact += 1;
    else if (appears(t, body)) partial += 1;
    else missing.push(t);
  }
  return {
    tokens: tokens.length,
    hit_exact: exact,
    hit_partial: partial,
    ratio: tokens.length === 0 ? 0 : Number(((exact + partial) / tokens.length).toFixed(3)),
    missing,
  };
}

export async function overlapFor(
  caseId: string,
  query: string,
  context: string,
  expectedArticle: string,
  lawId: string,
  articleNo: string,
): Promise<Overlap> {
  const art = (await provider.getLawArticle(lawId, articleNo)) as Record<string, unknown> | null;
  const body = `${(art?.article_title as string) ?? ""} ${(art?.content as string) ?? ""}`;
  if (!body.trim()) throw new Error(`${caseId}: 조문 본문을 못 받았다 (${lawId} ${articleNo})`);
  return {
    case_id: caseId,
    expected_article: expectedArticle,
    query,
    by_query: side(query, body),
    by_context: side(context, body),
  };
}

async function main(): Promise<void> {
  const setPath = process.argv[2];
  if (!setPath) throw new Error("사용법: overlap.ts <failures.json>");
  const set = JSON.parse(readFileSync(setPath, "utf-8")) as {
    cases: Array<{
      case_id: string;
      query: string;
      expected_article: string;
      law_id: string;
      article_no: string;
      scope: string;
    }>;
  };
  const corpus = JSON.parse(readFileSync("bench/corpus.json", "utf-8")) as {
    items: Array<{ case_id: string; context?: string }>;
  };
  const ctx = new Map(corpus.items.map((i) => [i.case_id, i.context ?? ""]));
  const rows: Overlap[] = [];
  const skipped: string[] = [];
  for (const c of set.cases) {
    if (!c.law_id) {
      skipped.push(`${c.case_id}(scope=${c.scope})`);
      continue;
    }
    rows.push(
      await overlapFor(c.case_id, c.query, ctx.get(c.case_id) ?? "", c.expected_article, c.law_id, c.article_no),
    );
  }
  console.log(JSON.stringify({ skipped, rows }, null, 2));
}

if (process.argv[1] && /overlap\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(`overlap 실패: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
