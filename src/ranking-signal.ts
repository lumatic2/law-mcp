/**
 * 순위 신호 (TV7 step-2).
 *
 * TV4 가 판정한 결함: **도달은 고쳤는데 순위가 안 움직였다.** 순위를 정하는 신호가 법령명
 * 문자열뿐이라, 이름과 글자를 공유하지 않는 정답(`수정신고`→`국세기본법`,
 * `세금계산서`→`부가가치세법`)은 후보 풀에 들어와도 밀린다.
 *
 * TV4 는 조문제목이 옳은 신호임을 확인했지만 **싸게 얻을 경로가 없어**(전문 771KB·1.1초)
 * 미채택으로 닫았다. 그런데 `aiSearch` 는 그 값을 **이미 무료로 준다** — 검색과 병렬로 이미
 * 호출 중이고 응답 행마다 `조문제목`·`조문내용`·순위가 들어 있다. 우리는 그걸 "상위 N개 법
 * 승격"에만 쓰고 버리고 있었다.
 *
 * ⚠ **대체가 아니라 신호다.** `aiSearch` 자체 순서는 세법 dev 에서 76.7% 로 현행 83.3% 보다
 * 나쁘다(2026-07-22 실측). 그 순서를 그대로 믿으면 맞히던 것을 깬다 — 그래서 최종 순서는
 * 우리가 정하고, aiSearch 는 **채점 재료**로만 쓴다.
 *
 * ⚠ 과적합 방어(F5): 이 모듈에는 **법명·도메인·쿼리 토큰이 하나도 없다.**
 * `src/parent-law.ts`·`src/article-title-signal.ts` 와 같은 규율이다.
 */
import type { AiSearchResult } from "./ai-search.js";
import type { IndexedArticle } from "./article-index.js";
import { scoreArticles } from "./article-match.js";

export type RankingCandidate = { law_id: string; law_name: string };

export type RankingOutcome<T> = {
  items: T[];
  /** 신호가 없어 원래 순서를 그대로 돌려줬나 */
  unchanged: boolean;
};

/**
 * `aiSearch` 가 준 조문을 채점 가능한 형태로 옮긴다.
 *
 * 새 채점기를 만들지 않고 **LB2 의 `scoreArticles` 를 그대로 쓴다** — 조문제목 가중치 ×3 +
 * 본문 매칭, 한 조문에 토큰이 몰린 경우를 높게 보는 제곱 가중은 이미 dev 로 검증된 규칙이다.
 * 여기서 새 가중치를 발명하면 그건 평가 세트에 맞춘 것이지 신호가 좋아진 게 아니다.
 */
function toIndexedArticles(law: AiSearchResult["laws"][number]): IndexedArticle[] {
  return law.articles.map((article) => ({
    article_no: String(article.articleNo),
    display: article.display,
    title: article.title,
    // 본문이 없으면 제목만으로 채점된다 — 빈 문자열이어도 `scoreArticles` 가 안전하다.
    text: article.content ?? "",
  }));
}

/** 법령명 비교용 정규화 — 공백·구두점 차이로 신호를 놓치지 않게 한다. */
function normalize(name: string): string {
  return name.replace(/[\s·ㆍ]/g, "");
}

/**
 * `aiSearch` 신호로 후보를 재정렬한다.
 *
 * 규약 — **신호가 없으면 순서를 흔들지 않는다**:
 *   · `aiSearch` 결과가 비었으면(실패·타임아웃 포함) 원본 그대로
 *   · 모든 후보 점수가 0이면 원본 그대로
 *   · 점수가 같으면 `aiSearch` 순위 → 원래 순서로 떨어진다 (원 순서 보존)
 *
 * 후보 풀 **밖의 법을 새로 끼워 넣지 않는다** — 그건 병합(`mergeAiSearch`)의 일이고,
 * 여기서 또 하면 두 단계가 같은 자리를 두고 싸운다.
 */
export function rerankByAiSignal<T extends RankingCandidate>(
  candidates: T[],
  query: string,
  ai: AiSearchResult | null,
): RankingOutcome<T> {
  if (!ai || ai.laws.length === 0 || candidates.length < 2) {
    return { items: candidates, unchanged: true };
  }

  const byName = new Map<string, AiSearchResult["laws"][number]>();
  const byId = new Map<string, AiSearchResult["laws"][number]>();
  for (const law of ai.laws) {
    byName.set(normalize(law.lawName), law);
    if (law.lawId) byId.set(law.lawId, law);
  }

  const scored = candidates.map((candidate, index) => {
    const law = byName.get(normalize(candidate.law_name)) ?? byId.get(candidate.law_id);
    if (!law) return { candidate, index, score: 0, rank: Number.MAX_SAFE_INTEGER };
    const { score } = scoreArticles(toIndexedArticles(law), query);
    return { candidate, index, score, rank: law.bestRank };
  });

  if (scored.every((entry) => entry.score === 0)) {
    return { items: candidates, unchanged: true };
  }

  const reordered = [...scored]
    .sort((left, right) =>
      right.score - left.score
      || left.rank - right.rank
      || left.index - right.index,
    )
    .map((entry) => entry.candidate);

  const moved = reordered.some((candidate, index) => candidate !== candidates[index]);
  return { items: reordered, unchanged: !moved };
}
