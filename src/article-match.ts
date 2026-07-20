/**
 * 조문 단위 매칭 점수 (LB2 step-2).
 *
 * 왜 조문 단위인가: ib3 에서 "법령 단위 본문 토큰 빈도"는 기각됐다 — `가지급금 인정이자` 로
 * 재정렬하면 예금 가지급금(전혀 다른 개념)을 쓰는 예금자보호법이 2위로 올라왔다. 법령 전체는
 * 문맥이 너무 넓어 의미 불일치를 못 거른다. 조문은 문맥이 좁아 그 반증이 그대로 적용되지 않는다
 * — 단 그 가정 자체를 dev 골든셋으로 검증한 뒤에만 채택한다(계획 hard-stop).
 */
import type { IndexedArticle } from "./article-index.js";

export type ArticleHit = {
  article_no: string;
  display: string;
  title: string | null;
  /** 이 조문이 포함한 쿼리 토큰 종류 수 */
  matched_tokens: number;
  /** 매칭 근거를 사람이 볼 수 있게 자른 발췌 */
  excerpt: string;
};

export type LawArticleScore = {
  /** 법령 점수 — 정렬 키 */
  score: number;
  /** 쿼리 토큰을 하나라도 포함한 조문 수 */
  matched_articles: number;
  /** 어떤 조문이든 한 번이라도 매칭된 토큰 종류 수(전체 쿼리 대비 커버리지) */
  covered_tokens: number;
  /** 상위 조문 (matched_tokens desc → 조문번호 asc) */
  top: ArticleHit[];
};

const STOPWORDS = new Set([
  "기간", "요건", "사유", "범위", "기준", "청구", "신청", "의무", "책임", "효력",
  "경우", "관련", "대한", "위한", "무엇", "어떻게", "얼마",
]);

/**
 * 쿼리를 매칭 토큰으로 쪼갠다. 2자 미만과 일반 법률 상용어(요건·기간·사유…)는 버린다 —
 * 이런 토큰은 거의 모든 법령의 거의 모든 조문에 있어 변별력이 없다.
 */
export function tokenizeQuery(query: string): string[] {
  return [...new Set(
    query
      .trim()
      .split(/\s+/)
      .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
  )];
}

function excerptAround(text: string, token: string): string {
  const index = text.indexOf(token);
  if (index < 0) return text.slice(0, 80);
  const start = Math.max(0, index - 25);
  return text.slice(start, start + 90).replace(/\s+/g, " ").trim();
}

/**
 * 조문 제목 매칭 1건의 가중치. 제목은 곧 쟁점명인 경우가 많아(제307조 "명예훼손",
 * 제839조의2 "재산분할청구권") 본문 매칭보다 훨씬 강한 신호다 — 2026-07-21 assisted 실측에서
 * 제목을 버린 탓에 "사실적시 명예훼손 처벌" 이 제1·14·18조를 예측했다.
 */
const TITLE_WEIGHT = 3;

/**
 * 한 법령의 조문 배열을 쿼리로 채점한다.
 *
 * score = Σ(조문별 (본문 매칭 + 제목 매칭×3)²) — 제곱은 "여러 토큰이 *한 조문에* 몰린 경우"를
 * "토큰이 여러 조문에 흩어진 경우"보다 높게 본다. 쟁점은 보통 한 조문에 모여 있고,
 * 흩어진 매칭은 우연일 가능성이 크다.
 */
export function scoreArticles(articles: IndexedArticle[], query: string, topN = 3): LawArticleScore {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0 || articles.length === 0) {
    return { score: 0, matched_articles: 0, covered_tokens: 0, top: [] };
  }

  const hits: Array<ArticleHit & { weight: number }> = [];
  const covered = new Set<string>();
  let score = 0;

  for (const article of articles) {
    const matched = tokens.filter((token) => article.text.includes(token));
    // 제목은 띄어쓰기를 지우고 비교한다 — 법령 제목은 "연장 근로의 제한" 처럼 띄어 쓰지만
    // 사용자는 "연장근로" 로 붙여 쓴다(2026-07-21 실측 실패 원인).
    const bareTitle = article.title ? article.title.replace(/\s+/g, "") : null;
    const titleMatched = bareTitle
      ? tokens.filter((token) => bareTitle.includes(token.replace(/\s+/g, "")))
      : [];
    if (matched.length === 0 && titleMatched.length === 0) continue;

    [...matched, ...titleMatched].forEach((token) => covered.add(token));
    const weight = matched.length + titleMatched.length * TITLE_WEIGHT;
    score += weight ** 2;
    hits.push({
      article_no: article.article_no,
      display: article.display,
      title: article.title,
      matched_tokens: matched.length + titleMatched.length,
      excerpt: titleMatched.length > 0
        ? excerptAround(article.text, titleMatched[0])
        : excerptAround(article.text, matched[0]),
      weight,
    });
  }

  hits.sort((left, right) => {
    if (left.weight !== right.weight) return right.weight - left.weight;
    return Number(parseInt(left.article_no, 10)) - Number(parseInt(right.article_no, 10));
  });

  const top = hits.slice(0, topN).map(({ weight: _weight, ...hit }) => hit);
  return { score, matched_articles: hits.length, covered_tokens: covered.size, top };
}

/**
 * 조문 점수로 후보 법령을 재정렬한다. 점수가 전부 0이면 **원 순서를 그대로 보존**한다
 * (신호가 없을 때 순서를 흔들지 않는다 — ib3 에서 upstream 가나다순으로 넘겼다가
 * 법인세법이 1위→5위로 밀린 실패의 교훈).
 */
export function rerankByArticleScore<T>(
  candidates: T[],
  scoreOf: (candidate: T) => number,
): T[] {
  const scored = candidates.map((candidate, index) => ({ candidate, index, score: scoreOf(candidate) }));
  if (scored.every((entry) => entry.score === 0)) return candidates;

  return scored
    .sort((left, right) => (right.score - left.score) || (left.index - right.index))
    .map((entry) => entry.candidate);
}
