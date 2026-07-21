/**
 * 조문제목 신호 (TV4 step-1).
 *
 * 관측된 결함: 후보 법령의 순서가 **법령명 문자열**로만 정해진다. 그래서 이름에 쿼리 토큰이
 * 하나도 없는 정답(`세금계산서 지연발급 가산세` → 부가가치세법)은 후보 풀 안에 있어도 위로
 * 올라오지 못한다. 반대로 정답 법의 **조문제목**은 쿼리와 거의 일치한다(부가가치세법 제60조
 * `가산세`). 이름보다 훨씬 강한 관련도 신호다.
 *
 * ⚠ 과적합 방어(F5): 이 모듈에는 **법명·도메인·쿼리 토큰이 하나도 없다.** `src/parent-law.ts`
 * 와 같은 규율이다. 실패 사례를 보고 만들었지만 규칙 자체는 "제목과 쿼리를 대조한다" 뿐이다.
 *
 * ⚠ 비용: 조문제목만 주는 upstream 경로가 **없다**(2026-07-21 실측 — `lsJoNm`·`joNm`·`lawjo`·
 * `lsJoInf` 전부 404, `lsJoHstInf` 는 0건). 제목을 보려면 법령 전문을 받아야 하고 그건
 * **771KB · 약 1.1초**다(소득세법 실측). 그래서 이 신호는 **항상 켜지지 않는다** — 이름 신호가
 * 이미 확신을 주는 검색에서는 한 건도 받지 않는다(`shouldRunTitleSignal`). 값을 치를 이유가
 * 있을 때만 값을 친다.
 */
import type { IndexedArticle } from "./article-index.js";
import { tokenizeQuery } from "./article-match.js";

/** 검색 1회당 추가로 여는 법령 전문 수 상한 (plan 비용 예산: ≤3). */
export const TITLE_SIGNAL_FETCH_BUDGET = 3;

export type TitleSignalCandidate = { law_id: string; law_name: string };

/** 법령 전문을 조문 배열로 받아 오는 함수. 실패는 `null` 로 알린다(예외를 던져도 된다). */
export type ArticleFetcher = (lawId: string) => Promise<IndexedArticle[] | null>;

/** 공백을 지운 비교용 문자열 — 법령·조문 제목은 띄어 쓰지만 사용자는 붙여 쓴다. */
function bare(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * 법령명이 쿼리 토큰을 몇 개나 담고 있나. 지금 순위를 만드는 신호와 같은 것을 재현한다
 * — 이 신호가 이미 확실하면 전문을 열 이유가 없다.
 */
export function nameSignal(lawName: string, tokens: string[]): number {
  const name = bare(lawName);
  return tokens.filter((token) => name.includes(bare(token))).length;
}

/**
 * 조문제목 신호를 돌릴 값어치가 있나.
 *
 * **단독 1위가 이름으로 이미 정해져 있으면 돌리지 않는다.** 그 경우 순위를 흔들어 얻을 것보다
 * 잃을 것이 크고(손실 0 규약), 무엇보다 1.1초를 쓸 이유가 없다. 이름이 아무것도 못 가르는
 * 검색(전부 0점) 또는 1위가 동점인 검색에서만 전문을 연다 — 실패 사례가 정확히 그 모양이다.
 */
export function shouldRunTitleSignal(candidates: TitleSignalCandidate[], query: string): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0 || candidates.length < 2) return false;

  const signals = candidates.map((candidate) => nameSignal(candidate.law_name, tokens));
  const best = Math.max(...signals);
  if (best === 0) return true; // 이름이 아무 말도 안 한다 → 신호가 필요하다
  const winners = signals.filter((signal) => signal === best).length;
  // 단독 최고점이 이미 맨 앞에 있으면 그대로 둔다.
  return !(winners === 1 && signals[0] === best);
}

/**
 * 한 법령의 조문제목들을 쿼리로 채점한다.
 *
 * 점수 = **조문 하나가 담은 쿼리 토큰 수의 최대값**이다. 합이 아니다 — 합으로 하면 조문이
 * 수백 개인 큰 법(`국세기본법`)이 우연한 매칭만으로 이기고, 이건 이름 길이 편향을 조문 수
 * 편향으로 바꾼 것에 불과하다. 쟁점은 보통 **한 조문**에 있으므로 최대값이 옳다.
 */
export function scoreArticleTitles(
  articles: IndexedArticle[],
  query: string,
): { score: number; best: IndexedArticle | null } {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return { score: 0, best: null };

  let score = 0;
  let best: IndexedArticle | null = null;
  for (const article of articles) {
    if (!article.title) continue;
    const title = bare(article.title);
    const matched = tokens.filter((token) => title.includes(bare(token))).length;
    if (matched > score) {
      score = matched;
      best = article;
    }
  }
  return { score, best };
}

export type TitleSignalOutcome<T> = {
  items: T[];
  /** 실제로 연 전문 수 (캐시 적중은 fetcher 쪽에서 흡수한다). */
  fetched: number;
  /** 신호를 돌리지 않았거나 상류 실패로 원래 순서를 그대로 돌려줬나. */
  unchanged: boolean;
};

/**
 * 상위 후보의 조문제목으로 재정렬한다.
 *
 * 규약 — **신호가 없으면 순서를 흔들지 않는다**:
 *   · 값어치 게이트에 걸리면 원본 그대로 (`unchanged`)
 *   · 창 안에서 **한 건이라도 조회에 실패하면** 원본 그대로. 일부만 아는 상태로 재정렬하면
 *     실패한 후보가 조용히 밀린다 — 상류 장애가 순위 하락으로 둔갑하면 안 된다.
 *   · 전부 0점이어도 원본 그대로
 *
 * 재정렬 범위는 **연 후보들(창) 안에서만**이다. 창 밖 후보는 점수를 모르므로 건드리지 않는다.
 */
export async function rerankByArticleTitle<T extends TitleSignalCandidate>(
  candidates: T[],
  query: string,
  fetchArticles: ArticleFetcher,
  budget: number = TITLE_SIGNAL_FETCH_BUDGET,
): Promise<TitleSignalOutcome<T>> {
  if (!shouldRunTitleSignal(candidates, query)) {
    return { items: candidates, fetched: 0, unchanged: true };
  }

  const window = candidates.slice(0, Math.max(0, budget));
  if (window.length < 2) return { items: candidates, fetched: 0, unchanged: true };

  const fetched = await Promise.all(
    window.map(async (candidate) => {
      try {
        return await fetchArticles(candidate.law_id);
      } catch {
        return null;
      }
    }),
  );

  // 한 건이라도 못 받았으면 재정렬하지 않는다 (실패 프로브: 503 → 기존 순위 그대로).
  if (fetched.some((articles) => articles === null)) {
    return { items: candidates, fetched: window.length, unchanged: true };
  }

  const scored = window.map((candidate, index) => ({
    candidate,
    index,
    score: scoreArticleTitles(fetched[index] as IndexedArticle[], query).score,
  }));

  if (scored.every((entry) => entry.score === 0)) {
    return { items: candidates, fetched: window.length, unchanged: true };
  }

  const reordered = [...scored]
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.candidate);

  const moved = reordered.some((candidate, index) => candidate !== window[index]);
  return {
    items: [...reordered, ...candidates.slice(window.length)],
    fetched: window.length,
    unchanged: !moved,
  };
}
