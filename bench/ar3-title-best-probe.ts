/**
 * AR3 기여도 프로브 — 조문제목 신호의 `best` 를 살리면 조문 수준 정답률이 얼마나 오르나.
 *
 * 관측(2026-07-22): `search_law` 는 상위 법령을 맞히고도 **정답 조문을 안 준다**.
 * `ai_articles` 는 법조문 용어에만 반응하고 일상어 질의에서 무너진다.
 * 한편 `scoreArticleTitles` 는 최적 조문(`best`)을 이미 계산해 놓고 **버린다** —
 * 법령 재정렬 점수로만 쓴다. 새 upstream 호출 없이 쓸 수 있는 신호가 놀고 있다.
 *
 * 이 프로브는 `src/` 를 바꾸지 않고, 같은 계산을 밖에서 재현해 기여도만 잰다.
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { extractArticles } from "../src/article-index.js";
import { scoreArticleTitles } from "../src/article-title-signal.js";

/**
 * `fetchLawArticleRoot` 는 `lawgo-provider.ts` 의 모듈 private 다. 이 프로브는 `src/` 를
 * 건드리지 않기로 했으므로(판정 중 대상 불변) 같은 upstream 호출을 여기서 재현한다.
 * 수리가 채택되면 프로바이더 안에서 이미 도는 경로를 쓰게 되므로 이 사본은 프로브 한정이다.
 */
async function fetchArticleRoot(lawId: string): Promise<Record<string, unknown>> {
  const oc = process.env.LAW_API_OC;
  if (!oc) throw new Error("LAW_API_OC 미설정");
  const url = `https://www.law.go.kr/DRF/lawService.do?OC=${encodeURIComponent(oc)}`
    + `&target=law&type=JSON&ID=${encodeURIComponent(lawId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

type Case = { query: string; law: string; article: string };

/**
 * 맥락효과 프로브(2026-07-22)가 적발한 홀드아웃 MISS 5건을 **일상어**로 다시 쓴 것.
 * 정답 조문 제목을 질의에 넣지 않았다 — 넣으면 문제가 사라져 아무것도 못 잰다.
 */
const CASES: Case[] = [
  { query: "신고를 안 하고 기한이 지났는데 지금이라도 신고하는 방법", law: "국세기본법", article: "제45조의3" },
  { query: "세금을 잘못 매겼을 때 다투는 절차", law: "국세기본법", article: "제55조" },
  { query: "회사가 임원한테 준 퇴직금을 비용으로 얼마나 인정받나", law: "법인세법 시행령", article: "제44조" },
  { query: "외국에 낸 세금을 우리나라 세금에서 빼주는 한도", law: "법인세법", article: "제57조" },
  { query: "돈을 준 사람이 누구에게 얼마 줬는지 세무서에 내는 서류", law: "소득세법", article: "제164조" },
];

function norm(value: string): string {
  return value.replace(/\s+/g, "");
}

async function main(): Promise<void> {
  const provider = new LawGoProvider();
  const rows: Record<string, unknown>[] = [];

  for (const kase of CASES) {
    const res = await provider.searchLaw(kase.query, { limit: 5 });
    const items = res.items ?? [];

    // ① 현행: 법령을 맞혔나 / ai_articles 가 정답 조문을 줬나
    const lawRank = items.findIndex((it) => norm(it.law_name ?? "") === norm(kase.law));
    const aiHit = items.some((it) =>
      (it.ai_articles ?? []).some((a) => norm(a.article) === norm(kase.article)),
    );

    // ② 제안: 상위 3 법령 각각의 조문제목 best 를 뽑았다면 정답이 나왔나
    let titleHit = false;
    const titleBest: { law: string; article: string | null; score: number }[] = [];
    for (const it of items.slice(0, 3)) {
      if (!it.law_id) continue;
      try {
        const articles = extractArticles(await fetchArticleRoot(it.law_id));
        const { score, best } = scoreArticleTitles(articles, kase.query);
        titleBest.push({ law: it.law_name ?? "?", article: best?.article ?? null, score });
        if (
          norm(it.law_name ?? "") === norm(kase.law)
          && best
          && norm(best.article) === norm(kase.article)
        ) {
          titleHit = true;
        }
      } catch {
        titleBest.push({ law: it.law_name ?? "?", article: null, score: -1 });
      }
    }

    const row = { query: kase.query, gold: `${kase.law} ${kase.article}`, lawRank, aiHit, titleHit, titleBest };
    rows.push(row);
    console.log(
      `${aiHit ? "AI✅" : "AI❌"} ${titleHit ? "TITLE✅" : "TITLE❌"} lawRank=${lawRank}  ${kase.gold ?? ""}${kase.law} ${kase.article}`,
    );
    for (const b of titleBest) console.log(`      ${b.law} → ${b.article ?? "(없음)"} (score ${b.score})`);
  }

  const ai = rows.filter((r) => r.aiHit).length;
  const title = rows.filter((r) => r.titleHit).length;
  const union = rows.filter((r) => r.aiHit || r.titleHit).length;
  console.log(`\n현행 ai_articles 조문 적중: ${ai}/${rows.length}`);
  console.log(`조문제목 best 적중:        ${title}/${rows.length}`);
  console.log(`둘 중 하나라도 적중(합집합): ${union}/${rows.length}`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
