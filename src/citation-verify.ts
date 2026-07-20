/**
 * 인용 검증 (LB2 승계 plan step-2).
 *
 * 왜: 상위 레포 3곳(chrisryugj 2252★·startup-law·lexdiff)이 공통으로 헤드라인에 다는 기능이고
 * 우리에겐 없었다(2026-07-21 선행 사례 조사). LLM 이 지어낸 "○○법 제N조"를 실제 조문과 대조해
 * 잡아낸다 — Objective 의 "함정 없음" 축에 직결된다.
 *
 * 조문 인덱스(article-index)가 이미 있으므로 판정은 로컬 대조로 끝난다.
 */
import type { IndexedArticle } from "./article-index.js";

export type CitationVerdict =
  /** 조문이 실재하고(제목을 준 경우) 제목도 일치 */
  | "ok"
  /** 법령은 있으나 그 조문이 없음 — 전형적인 조문번호 환각 */
  | "not_found"
  /** 조문은 있으나 인용된 제목이 다름 — 전형적인 조문제목 환각 */
  | "title_mismatch"
  /** 법령 자체를 못 찾음 */
  | "law_not_found";

export type CitationCheck = {
  verdict: CitationVerdict;
  law_name: string;
  article: string;
  /** 실제 조문 제목 (찾은 경우) */
  actual_title: string | null;
  /** 실제 조문 본문 발췌 (찾은 경우) */
  excerpt: string | null;
  /** 사람이 읽는 판정 사유 */
  reason: string;
  /** 인접 조문 제안 — not_found 일 때 가장 가까운 조문번호들 */
  nearby?: string[];
};

/**
 * "제28조"·"28조"·"28" 표기 차이를 흡수해 비교용 키로 만든다.
 * 가지번호는 "제839조의2" → "839의2" 로 — `조$` 만 벗기면 "839조의2" 가 남아 인덱스 키와 안 맞는다.
 */
export function canonicalArticleNo(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/^제/, "")
    .replace(/조의/, "의")
    .replace(/조$/, "");
}

/**
 * 조문 제목 비교 — 공백·문장부호를 무시하고, **괄호 안 한자 병기를 떼어낸다**.
 * 법령 원문은 "정당방위(正當防衛)" 처럼 한자를 병기하는데, 한자도 글자(\p{L})라 단순 정규화로는
 * 안 지워져 인용된 "정당방위" 와 불일치로 오판한다.
 */
export function isSameTitle(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .replace(/[(（][^)）]*[)）]/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "")
      .toLowerCase();
  return normalize(left) === normalize(right);
}

/**
 * 인용 검증용 법령 해석 — **완전일치만 채택한다.**
 *
 * 일반 검색은 0건일 때 본문검색·완화·브리지로 폴백해 "비슷한" 법령을 돌려주는데, 인용 검증에서
 * 그걸 그대로 쓰면 엉뚱한 법령의 조문과 대조해 `ok` 를 내준다 — 실측(2026-07-21): 존재하지 않는
 * "존재하지않는법률 제1조" 가 건축법 시행령 제1조로 해석돼 `ok` 판정. 거짓 안심은 검증 도구에서
 * 가장 나쁜 실패다.
 */
export function pickExactLawId(
  items: Array<{ law_id: string; law_name: string }>,
  requestedName: string,
): string | null {
  const normalize = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const target = normalize(requestedName);
  const exact = items.find((item) => normalize(item.law_name) === target);
  return exact?.law_id ?? null;
}

function nearbyArticles(articles: IndexedArticle[], target: string, count = 3): string[] {
  const targetMain = Number.parseInt(canonicalArticleNo(target), 10);
  if (!Number.isFinite(targetMain)) return [];
  return articles
    .map((article) => ({
      display: article.display,
      distance: Math.abs(Number.parseInt(article.article_no, 10) - targetMain),
    }))
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, count)
    .map((entry) => entry.display);
}

/**
 * 인용 1건을 조문 인덱스와 대조한다.
 * `articles` 가 null 이면 법령을 못 찾은 것(`law_not_found`) — 빈 배열과 구분한다.
 * ⚠ upstream 장애로 조문을 못 받은 경우를 `ok` 로 처리하지 않는다(거짓 안심 방지) —
 * 호출자가 조회 실패를 null 로 넘겨 `law_not_found` 가 되게 한다.
 */
export function verifyCitation(
  articles: IndexedArticle[] | null,
  lawName: string,
  article: string,
  citedTitle?: string,
): CitationCheck {
  const base = { law_name: lawName, article, actual_title: null, excerpt: null } as const;

  if (articles === null || articles.length === 0) {
    return {
      ...base,
      verdict: "law_not_found",
      reason: `'${lawName}' 의 조문을 확인할 수 없다(법령 미존재 또는 조회 실패) — 인용 진위를 판정하지 못했다.`,
    };
  }

  const target = canonicalArticleNo(article);
  const found = articles.find((candidate) => canonicalArticleNo(candidate.article_no) === target);

  if (!found) {
    return {
      ...base,
      verdict: "not_found",
      reason: `'${lawName}' 에 ${article} 이(가) 없다 — 조문번호 환각으로 의심된다.`,
      nearby: nearbyArticles(articles, article),
    };
  }

  const excerpt = found.text.replace(/\s+/g, " ").slice(0, 160);

  if (citedTitle && found.title && !isSameTitle(citedTitle, found.title)) {
    return {
      law_name: lawName,
      article,
      verdict: "title_mismatch",
      actual_title: found.title,
      excerpt,
      reason: `${article} 은(는) 실재하지만 제목이 '${found.title}' 이다 — 인용된 '${citedTitle}' 과(와) 다르다.`,
    };
  }

  return {
    law_name: lawName,
    article,
    verdict: "ok",
    actual_title: found.title,
    excerpt,
    reason: citedTitle
      ? `${article}(${found.title ?? "제목 없음"}) 실재 확인 — 인용 제목도 일치한다.`
      : `${article}(${found.title ?? "제목 없음"}) 실재 확인.`,
  };
}
