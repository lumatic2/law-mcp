/**
 * 법령 전문 응답을 조문 단위로 분해하고 캐시한다 (LB2 step-1).
 *
 * 배경: upstream 에 조문 단위 검색 타깃이 없다(2026-07-20 실측 — lawjosub·lsJo 등 전부 빈 응답).
 * 다만 `lawService.do?target=law&ID=…` 응답에는 조문 구조(조문단위→항→호→목)가 들어 있어
 * 조문 인덱스를 클라이언트에서 구성할 수 있다. 그러면 "어느 법 몇 조"에 답할 수 있고,
 * 법령명 문자열에 의존하지 않는 관련도 신호도 생긴다(기준선 관찰: 형사 recall@3 20% 의 원인은
 * "정당방위"가 '형법'이라는 이름과 한 글자도 공유하지 않는다는 것).
 */

export type IndexedArticle = {
  /** "28" · "839의2" 형태의 정규화 조문 번호 */
  article_no: string;
  /** "제28조" · "제839조의2" 표시형 */
  display: string;
  title: string | null;
  text: string;
};

const ARTICLE_NUMBER_KEYS = ["조문번호", "JO_NO", "article_no", "no"];
const ARTICLE_BRANCH_KEYS = ["조문가지번호", "JO_BRANCH", "branch_no", "가지번호"];
const ARTICLE_ENABLED_KEYS = ["조문여부", "조문여부YN", "JO_YN", "is_article"];

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

/** 조문 본문 = 조문내용 + 항/호/목 을 재귀로 이어붙인 텍스트. */
function collectArticleText(joObj: Record<string, unknown>): string {
  const parts: string[] = [];
  const heading = pickString(joObj, ["조문내용", "JO_CONTENT", "content"]);
  if (heading) parts.push(heading);

  for (const 항 of toArray(joObj["항"] ?? joObj["para"] ?? joObj["paragraph"])) {
    const 항Obj = asObject(항);
    const 항내용 = pickString(항Obj, ["항내용", "PARA_CONTENT", "para_content"]);
    if (항내용) parts.push(항내용);

    for (const 호 of toArray(항Obj["호"] ?? 항Obj["ho"] ?? 항Obj["subitem"])) {
      const 호Obj = asObject(호);
      const 호내용 = pickString(호Obj, ["호내용", "HO_CONTENT", "ho_content"]);
      if (호내용) parts.push(호내용);

      for (const 목 of toArray(호Obj["목"] ?? 호Obj["mok"] ?? 호Obj["detail"])) {
        const 목내용 = pickString(asObject(목), ["목내용", "MOK_CONTENT", "mok_content"]);
        if (목내용) parts.push(목내용);
      }
    }
  }

  return stripTags(parts.join("\n")).replace(/[ \t]+/g, " ").trim();
}

/**
 * 법령 상세 응답(root)을 조문 배열로 분해한다.
 * 조문 구조가 없는 응답(빈 법령·행정규칙형)은 빈 배열 — 예외를 던지지 않는다.
 */
export function extractArticles(root: Record<string, unknown>): IndexedArticle[] {
  const lawObj = asObject(root.법령 ?? root.law ?? root.Law ?? asObject(root.LawService).법령);
  const joContainer = asObject(lawObj.조문 ?? lawObj.jo ?? lawObj.article);
  const joList = toArray(joContainer.조문단위 ?? joContainer.unit ?? joContainer.items);

  const articles: IndexedArticle[] = [];
  for (const jo of joList) {
    const joObj = asObject(jo);
    // "조문" 만 취한다 — "전문"은 장·절 제목 등 비조문 행이다.
    const enabled = pickString(joObj, ARTICLE_ENABLED_KEYS);
    if (enabled && enabled !== "조문") continue;

    const rawNo = pickString(joObj, ARTICLE_NUMBER_KEYS);
    if (!rawNo) continue;
    const branchRaw = pickString(joObj, ARTICLE_BRANCH_KEYS);
    const branch = branchRaw ? Number(branchRaw.replace(/\D/g, "")) : 0;
    const main = Number(String(rawNo).replace(/\D/g, ""));
    if (!Number.isFinite(main) || main <= 0) continue;

    const article_no = branch > 0 ? `${main}의${branch}` : `${main}`;
    const text = collectArticleText(joObj);
    if (!text) continue;

    articles.push({
      article_no,
      display: `제${article_no}조`.replace(/제(\d+)의(\d+)조/, "제$1조의$2"),
      title: pickString(joObj, ["조문제목", "JO_TITLE", "title"]),
      text,
    });
  }

  return articles;
}

/**
 * 법령 조문 배열의 LRU 캐시. 프로세스 생존 동안만 유지하며 영속 색인은 두지 않는다
 * (계획 결정: 영속 색인은 설치·갱신 부담을 만들어 "누구나 붙이는 MCP" 목표와 충돌).
 */
export class ArticleIndexCache {
  private readonly store = new Map<string, IndexedArticle[]>();

  constructor(private readonly maxEntries = 20) {}

  get(lawId: string): IndexedArticle[] | undefined {
    const hit = this.store.get(lawId);
    if (!hit) return undefined;
    // 최근 사용을 뒤로 보내 LRU 순서를 유지한다.
    this.store.delete(lawId);
    this.store.set(lawId, hit);
    return hit;
  }

  set(lawId: string, articles: IndexedArticle[]): void {
    if (this.store.has(lawId)) this.store.delete(lawId);
    this.store.set(lawId, articles);
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get size(): number {
    return this.store.size;
  }

  has(lawId: string): boolean {
    return this.store.has(lawId);
  }
}
