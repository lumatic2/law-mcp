/**
 * 법령용어 연계 (LB5 step-1).
 *
 * 법제처는 우리가 쓰지 않던 색인을 두 개 더 준다:
 *   - `lstrmAI`     : 법령용어 검색. 기존 `lstrm` 과 **다른 색인**이다("숙려기간"이 여기엔 있다).
 *   - `lstrmRltJo`  : 그 용어가 **실제로 쓰인 조문** 목록(법령명 + 조번호 + 조문내용).
 *
 * 이 모듈은 "구어 → 법문" 갭을 메우는 **추가 후보 생성기**다. 기존 검색을 대체하지 않는다 —
 * 2026-07-21 실측에서 골든셋 실패 용어 8건 중 3건만 적중했다(적중 시엔 조문번호까지 정확).
 *
 * 주의: 이 색인은 개념이 아니라 **낱말이 쓰인 자리**를 가리킨다. "숙려기간"은 자본시장법
 * 시행령으로도 간다(다른 의미). 그래서 호출자는 `linkCount` 를 신뢰도 대리 지표로 쓴다 —
 * 실측에서 적중 3건은 연계 5~26건, miss 3건은 전부 1건이었다.
 */

export type LinkedArticle = {
  /** 법령명 (예: 근로기준법) */
  lawName: string;
  /** 사람이 읽는 조문 표기 (예: 제23조, 제839조의2) */
  display: string;
  /** 조 본번호 */
  articleNo: number;
  /** 가지번호 (없으면 0) */
  branch: number;
  /** 용어구분 (예: 선정용어) */
  kind: string | null;
};

export type LawLinkage = {
  lawName: string;
  /** 이 법령에서 그 용어가 쓰인 조문 수 — 신뢰도 대리 지표 */
  linkCount: number;
  articles: LinkedArticle[];
};

export type TermLinkage = {
  term: string;
  /** 연계 조문 총 건수 (모든 법령 합) */
  totalLinks: number;
  /** 연계 조문이 많은 법령 순 */
  laws: LawLinkage[];
};

const EMPTY: TermLinkage = { term: "", totalLinks: 0, laws: [] };

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

/** 비교용 정규화 — 공백·구두점 제거. */
function normalizeTerm(value: string): string {
  return value.replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * 검색 결과에서 **질의어와 완전히 같은** 용어 행의 MST 를 고른다.
 *
 * 부분일치를 받으면 "명예훼손" 질의에 "명예훼손분쟁조정부"가 딸려온다 — `verify_citation` 이
 * 폴백 법령을 받아 거짓 `ok` 를 냈던 것과 같은 실패 유형이라 같은 방식으로 막는다.
 */
export function pickExactTermMst(root: unknown, term: string): string | null {
  const search = asObject(asObject(root).lstrmAISearch);
  const rows = toRows(search.법령용어);
  const wanted = normalizeTerm(term);

  for (const row of rows) {
    const name = pickString(row, "법령용어명");
    if (!name || normalizeTerm(name) !== wanted) continue;
    const link = pickString(row, "조문간관계링크") ?? "";
    const mst = link.match(/MST=(\d+)/)?.[1];
    if (mst) return mst;
  }
  return null;
}

/** "0099" + 가지 "02" → 제99조의2 */
function formatArticle(articleNo: number, branch: number): string {
  return branch > 0 ? `제${articleNo}조의${branch}` : `제${articleNo}조`;
}

/** 조문 연계 응답을 법령별로 묶는다 (연계 조문 수 내림차순). */
export function extractLinkage(root: unknown, term: string): TermLinkage {
  const service = asObject(asObject(root).lstrmRltJoService);
  const rows = toRows(asObject(service.법령용어).연계법령);
  if (rows.length === 0) return { ...EMPTY, term };

  const byLaw = new Map<string, LinkedArticle[]>();
  for (const row of rows) {
    const lawName = pickString(row, "법령명");
    const rawNo = pickString(row, "조번호");
    if (!lawName || !rawNo) continue;

    const articleNo = Number(rawNo);
    if (!Number.isFinite(articleNo) || articleNo <= 0) continue;
    const branch = Number(pickString(row, "조가지번호") ?? "0") || 0;

    const list = byLaw.get(lawName) ?? [];
    // 같은 조문이 여러 번 오는 경우가 있어 중복을 제거한다.
    if (!list.some((entry) => entry.articleNo === articleNo && entry.branch === branch)) {
      list.push({
        lawName,
        display: formatArticle(articleNo, branch),
        articleNo,
        branch,
        kind: pickString(row, "용어구분"),
      });
    }
    byLaw.set(lawName, list);
  }

  const laws: LawLinkage[] = [...byLaw.entries()]
    .map(([lawName, articles]) => ({
      lawName,
      linkCount: articles.length,
      articles: articles.sort((left, right) => left.articleNo - right.articleNo || left.branch - right.branch),
    }))
    .sort((left, right) => right.linkCount - left.linkCount || left.lawName.localeCompare(right.lawName));

  return { term, totalLinks: rows.length, laws };
}

/** 조회 1회분 — 주입 가능한 형태로 두어 fixture 테스트에서 실 API 없이 검증한다. */
export type LinkageFetcher = {
  searchTerm: (term: string) => Promise<unknown>;
  fetchLinkedArticles: (mst: string) => Promise<unknown>;
};

/**
 * 용어 → 연계 법령·조문. 어느 단계에서 실패하든 **빈 결과**를 돌려 기존 경로를 보존한다
 * (이 채널은 보조라서, 죽었을 때 검색 전체가 죽으면 안 된다).
 */
export async function lookupTermLinkage(
  term: string,
  fetcher: LinkageFetcher,
  cache?: TermLinkageCache,
): Promise<TermLinkage> {
  const key = normalizeTerm(term);
  if (!key) return { ...EMPTY, term };

  const cached = cache?.get(key);
  if (cached) return cached;

  let result: TermLinkage = { ...EMPTY, term };
  try {
    const searchRoot = await fetcher.searchTerm(term);
    const mst = pickExactTermMst(searchRoot, term);
    if (mst) {
      const linkRoot = await fetcher.fetchLinkedArticles(mst);
      result = extractLinkage(linkRoot, term);
    }
  } catch {
    // 보조 채널이므로 삼킨다 — 호출자는 빈 결과를 "신호 없음"으로 다룬다.
    result = { ...EMPTY, term };
  }

  cache?.set(key, result);
  return result;
}

/** 용어 연계 LRU 캐시. 같은 쿼리를 재검색할 때 upstream 왕복을 없앤다. */
export class TermLinkageCache {
  private readonly entries = new Map<string, TermLinkage>();

  constructor(private readonly maxSize = 100) {}

  get(key: string): TermLinkage | undefined {
    const value = this.entries.get(key);
    if (!value) return undefined;
    // LRU: 조회한 항목을 뒤로 보낸다.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: TermLinkage): void {
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
