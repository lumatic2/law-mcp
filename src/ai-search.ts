/**
 * 법제처 지능형 검색 `aiSearch` (UD2 step-1).
 *
 * 이 레포는 다섯 milestone 동안 **"upstream 에 관련도 랭킹이 없다"** 를 전제로 후보 생성기를
 * 직접 만들었다. 전수 조사(2026-07-21)에서 그 전제가 틀렸음이 드러났다 — 법제처는 자연어 질의를
 * **조문 단위로** 답하는 검색을 이미 제공하고, 같은 dev 셋에서 무튜닝 92% 로 우리 튜닝 76% 를 이긴다.
 *
 * 다만 **대체가 아니라 병합**이다. `aiSearch` 도 틀리는 유형이 있다("정당방위 성립 요건" →
 * 정당법·방위사업법). 그래서 이 모듈은 *결과를 판단하지 않고* 정규화만 한다 — 어떻게 섞을지는
 * 호출자(step-2)가 실측으로 정한다.
 *
 * 방어 원칙 두 가지:
 *   ① **키 핀 고정.** upstream 컨테이너·행 키는 규칙이 없어 실측으로만 알 수 있고, 바뀌어도
 *      HTTP 200 으로 온다(LB3 `ordin` 사고). 2026-07-21 실측 응답의 키를 그대로 박고 테스트로 잠근다.
 *   ② **예외 누출 금지.** `aiSearch` 는 법제처 블랙박스다. 무응답·타임아웃·스키마 변경 어느 경우든
 *      **빈 결과**를 돌려 호출자가 기존 사다리로 graceful degrade 하게 한다. 이 모듈 때문에
 *      검색이 죽는 일은 없어야 한다.
 */
import axios from "axios";
import { LAW_API_OC, LAW_SEARCH_BASE_URL } from "./config.js";

export type AiSearchArticle = {
  /** 법령명 (예: 근로기준법) */
  lawName: string;
  /** 법령ID — `get_law_article` 경로에 그대로 쓸 수 있다(추가 호출 없음) */
  lawId: string | null;
  /** 사람이 읽는 조문 표기 (예: 제28조, 제839조의2) */
  display: string;
  /** 조 본번호 */
  articleNo: number;
  /** 가지번호 (없으면 0) */
  branch: number;
  /** 조문제목 (예: 부당해고등의 구제신청) */
  title: string | null;
  /** 조문 본문 */
  content: string | null;
  /** upstream 이 매긴 순위 (1부터). 이게 우리가 못 만들던 신호다. */
  rank: number;
};

export type AiSearchResult = {
  query: string;
  /** upstream 이 보고한 총 건수 */
  total: number;
  /** 순위 오름차순 */
  articles: AiSearchArticle[];
  /** 법령 단위로 접은 목록 — 후보 생성에 쓴다. 첫 등장 순위 기준. */
  laws: Array<{ lawName: string; lawId: string | null; bestRank: number; articles: AiSearchArticle[] }>;
};

const EMPTY: AiSearchResult = { query: "", total: 0, articles: [], laws: [] };

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(asObject).filter((row) => Object.keys(row).length > 0);
  const single = asObject(value);
  return Object.keys(single).length > 0 ? [single] : [];
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** "0028" + 가지 "02" → 제28조의2 */
function formatArticle(articleNo: number, branch: number): string {
  return branch > 0 ? `제${articleNo}조의${branch}` : `제${articleNo}조`;
}

/**
 * 응답 정규화. 컨테이너 `aiSearch`, 행 키 `법령조문` — 2026-07-21 실측값이며 테스트로 고정한다.
 *
 * 순위는 행의 `id`(1,2,3…)를 쓰되, 없거나 망가졌으면 **배열 순서로 떨어진다**. 순위를 잃는 것이
 * 이 채널의 존재 이유를 잃는 것이라, 조용히 0 으로 두지 않는다.
 */
export function extractAiSearch(root: unknown, query: string): AiSearchResult {
  const container = asObject(asObject(root).aiSearch);
  const rows = toRows(container.법령조문);
  if (rows.length === 0) return { ...EMPTY, query };

  const articles: AiSearchArticle[] = [];
  rows.forEach((row, index) => {
    const lawName = pickString(row, "법령명");
    const rawNo = pickString(row, "조문번호");
    if (!lawName || !rawNo) return;

    const articleNo = Number(rawNo);
    if (!Number.isFinite(articleNo) || articleNo <= 0) return;
    const branch = Number(pickString(row, "조문가지번호") ?? "0") || 0;
    const rank = Number(pickString(row, "id") ?? "") || index + 1;

    articles.push({
      lawName,
      lawId: pickString(row, "법령ID"),
      display: formatArticle(articleNo, branch),
      articleNo,
      branch,
      title: pickString(row, "조문제목"),
      content: pickString(row, "조문내용"),
      rank,
    });
  });

  articles.sort((left, right) => left.rank - right.rank);

  // 법령 단위로 접는다 — 같은 법의 여러 조문이 나오면 가장 높은 순위를 그 법의 순위로 본다.
  const byLaw = new Map<string, { lawName: string; lawId: string | null; bestRank: number; articles: AiSearchArticle[] }>();
  for (const article of articles) {
    const existing = byLaw.get(article.lawName);
    if (existing) {
      existing.articles.push(article);
      if (article.lawId && !existing.lawId) existing.lawId = article.lawId;
    } else {
      byLaw.set(article.lawName, {
        lawName: article.lawName,
        lawId: article.lawId,
        bestRank: article.rank,
        articles: [article],
      });
    }
  }

  const total = Number(pickString(container, "검색결과개수") ?? "") || articles.length;
  return {
    query,
    total,
    articles,
    laws: [...byLaw.values()].sort((left, right) => left.bestRank - right.bestRank),
  };
}

/**
 * 후보 병합 설정 (UD2 step-2).
 *
 * `enabled` 기본값은 **채택 판정을 통과한 뒤에** 켰다(2026-07-21 교차 A/B: 이득 8 · 손실 0,
 * 2회 동일). 그 전까지는 false 로 두어 판정 전 코드가 제품 경로로 새지 않게 했다.
 * `priority` 기본값 `"ai"` 도 선험적 선택이 아니라 실측 결과다 — `"boost"` 는 +7 로 한 건 낮았다.
 */
export type AiMergeConfig = {
  enabled?: boolean;
  /** 상위로 올릴 법령 수 */
  maxLaws?: number;
  /** 용어 연계 부스트와 충돌할 때 누가 위인가 — 선험적으로 정하지 않고 실측으로 고른다. */
  priority?: "ai" | "boost";
};

export type AiSearchFetcher = (query: string, display: number) => Promise<unknown>;

export const defaultAiSearchFetcher: AiSearchFetcher = async (query, display) => {
  const res = await axios.get(LAW_SEARCH_BASE_URL, {
    params: { OC: LAW_API_OC, target: "aiSearch", type: "JSON", query, display },
    timeout: 20_000,
    validateStatus: () => true,
  });
  if (res.status >= 400) throw new Error(`aiSearch HTTP ${res.status}`);
  return res.data;
};

export class AiSearchCache {
  private readonly entries = new Map<string, AiSearchResult>();

  constructor(private readonly maxSize = 100) {}

  get(key: string): AiSearchResult | undefined {
    const value = this.entries.get(key);
    if (!value) return undefined;
    // LRU: 조회한 항목을 뒤로 보낸다.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: AiSearchResult): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * 조회 진입점. **모든 실패를 빈 결과로 흡수한다** — 호출자는 try/catch 없이 쓸 수 있어야 한다.
 * miss 도 캐시한다(같은 질의로 upstream 을 반복해서 때리지 않는다).
 */
export async function lookupAiSearch(
  query: string,
  fetcher: AiSearchFetcher = defaultAiSearchFetcher,
  cache?: AiSearchCache,
  display = 10,
): Promise<AiSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ...EMPTY, query };

  const key = `${trimmed}::${display}`;
  const cached = cache?.get(key);
  if (cached) return cached;

  let result: AiSearchResult;
  try {
    result = extractAiSearch(await fetcher(trimmed, display), trimmed);
  } catch {
    result = { ...EMPTY, query: trimmed };
  }
  cache?.set(key, result);
  return result;
}
