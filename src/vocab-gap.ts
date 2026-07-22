/**
 * 어휘 공백 신호 (AR3).
 *
 * 관측된 결함(2026-07-22~23 실측): 일상어로 물으면 **정답 법령 자체가 후보에 안 들어온다** —
 * 홀드아웃 MISS 5건 중 4건이 `lawRank = -1` 이었다. 같은 쟁점을 법률 용어로 바꿔 물으면
 * 정확 도달이 **0/5 → 3/5** 로 복구된다. 즉 도구가 못 찾는 게 아니라, 소비 에이전트가
 * *자기 질의 어휘가 이 검색에 안 먹혔다는 사실을 모른 채* 첫 결과를 답으로 쓰는 것이 문제다.
 *
 * 그래서 이 모듈은 순위를 **바꾸지 않는다.** 경고 한 줄을 더할 뿐이다 —
 * 오탐이 나도 잃는 것은 잔소리 한 줄이고, 결과가 나빠지지 않는다(채택 문턱의 "손실 0"이
 * 구조적으로 성립한다). 고칠 대상은 순위가 아니라 **에이전트의 다음 행동**이다.
 *
 * ⚠ 과적합 방어: 이 파일에는 **법명·도메인·용어 사전이 하나도 없다.**
 * 규칙은 "질의 어휘가 결과에 보이나" 하나뿐이라 세법 밖에서도 같은 뜻으로 돈다.
 * (`src/article-title-signal.ts`·`src/parent-law.ts` 와 같은 규율.)
 */
import { tokenizeQuery } from "./article-match.js";

/** 공백 제거 — 법령·조문 제목은 띄어 쓰지만 사용자는 붙여 쓴다. */
function bare(value: string): string {
  return value.replace(/\s+/g, "");
}

/** 신호가 보는 후보의 최소 모양. 프로바이더 타입에 묶지 않는다(테스트가 쉬워진다). */
export type VocabGapCandidate = {
  law_name?: string | null;
  ai_articles?: ReadonlyArray<{ article?: string; title?: string | null }> | null;
};

/**
 * 질의 토큰의 몇 할이 결과(법령명 + 조문제목)에 실제로 나타나나.
 *
 * ⚠ **양방향으로 본다.** 한쪽만 보면 `기한후과세표준신고서`(질의)와 `기한 후 신고`(조문제목)를
 * 안 겹친 것으로 세어, **성공한 검색에까지 신호가 켜진다**(2026-07-23 오탐 원인). 법률 복합어는
 * 조문제목보다 길기 때문에, 토큰이 제목을 **포함**하는 쪽도 적중으로 센다.
 */
export function vocabCoverage(
  query: string,
  candidates: readonly VocabGapCandidate[],
): { covered: number; total: number; ratio: number } {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return { covered: 0, total: 0, ratio: 1 };

  const pieces = candidates
    .flatMap((item) => [
      item.law_name ?? "",
      ...(item.ai_articles ?? []).map((article) => article.title ?? ""),
    ])
    .map(bare)
    .filter((piece) => piece.length >= 2);

  if (pieces.length === 0) return { covered: 0, total: tokens.length, ratio: 0 };

  const haystack = pieces.join(" ");
  const covered = tokens.filter((raw) => {
    const token = bare(raw);
    return haystack.includes(token) || pieces.some((piece) => token.includes(piece));
  }).length;

  return { covered, total: tokens.length, ratio: covered / tokens.length };
}

/**
 * 문턱. 질의 토큰의 **절반도** 결과에 안 보이면 어휘가 빗나간 것으로 본다.
 *
 * 실측 분리력(2026-07-23, 12질의): 재현율 6/7 · 정밀도 75% · 오탐 2/5.
 * 문턱을 올리면 오탐이 늘고, 내리면 실패를 놓친다. 0.5 는 그 사이에서 고른 값이다.
 */
export const VOCAB_GAP_THRESHOLD = 0.5;

/**
 * 어휘 공백 경고를 만든다. 공백이 아니면 `null` — **경고를 안 붙이는 것이 기본**이다.
 *
 * 문구가 "질의를 좁혀라"가 아니라 **"법률 용어로 바꿔라"** 인 것이 핵심이다. 좁히기는
 * 같은 어휘 안에서 도는 일이라 이 실패를 못 푼다. 실측으로 복구시킨 행동은 *번역*이었다.
 */
export function vocabGapWarning(
  query: string,
  candidates: readonly VocabGapCandidate[],
): string | null {
  const { covered, total, ratio } = vocabCoverage(query, candidates);
  if (total === 0 || ratio >= VOCAB_GAP_THRESHOLD) return null;

  return (
    `질의 어휘가 결과에 거의 나타나지 않는다(${covered}/${total} 토큰) — 일상어로 물어서 `
    + "정답 법령이 후보에 아예 안 들어왔을 가능성이 높다. "
    + "**질의를 좁히지 말고 법률 용어로 바꿔 다시 검색하라** "
    + "(예: 일상적 서술 → 해당 제도의 법령상 명칭). "
    + "이 목록을 그대로 답으로 쓰지 말 것."
  );
}
