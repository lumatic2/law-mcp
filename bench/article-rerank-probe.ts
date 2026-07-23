/**
 * LB2 step-2 가정 검증 (일회성 실험 — 채택/기각 판정용).
 * 질문: 본문검색이 준 후보 법령을 "조문 매칭 점수"로 재정렬하면 dev recall@3 가 44.0% 위로 오르는가?
 * 오르지 않으면 계획대로 기각 기록 후 정지한다.
 */
import axios from "axios";
import { readFileSync } from "node:fs";
import { LAW_API_OC, LAW_SERVICE_BASE_URL } from "../src/config.js";
import { ArticleIndexCache, extractArticles } from "../src/article-index.js";
import { rerankByArticleScore, scoreArticles } from "../src/article-match.js";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { isHitAtK } from "./scoring.js";

type Item = { query: string; domain: string; expected_laws: string[]; expected_article?: string; split: string };

const FETCH_BUDGET = 5; // 계획 하드 제약: 검색 1회당 추가 fetch ≤5건
const provider = new LawGoProvider();
const cache = new ArticleIndexCache(40);

async function fetchArticles(lawId: string) {
  const cached = cache.get(lawId);
  if (cached) return cached;
  const res = await axios.get(LAW_SERVICE_BASE_URL, {
    params: { OC: LAW_API_OC, target: "law", type: "JSON", ID: lawId },
    timeout: 20_000,
    validateStatus: () => true,
  });
  const articles = res.status >= 400 ? [] : extractArticles(res.data as Record<string, unknown>);
  cache.set(lawId, articles);
  return articles;
}

async function main() {
  const golden = JSON.parse(readFileSync(new URL("../archive/bench/golden.json", import.meta.url), "utf8")) as { items: Item[] };
  const items = golden.items.filter((i) => i.split === "dev");

  let beforeHit3 = 0, afterHit3 = 0, beforeHit1 = 0, afterHit1 = 0;
  let articleChecked = 0, articleCorrect = 0;
  const latencies: number[] = [];
  const rows: string[] = [];

  for (const [index, item] of items.entries()) {
    const t0 = Date.now();
    // 후보는 기존 검색이 준 것을 쓴다(최대 8) — 후보 생성 자체는 이 실험의 범위가 아니다.
    const search = await provider.searchLaw(item.query, { limit: 8 });
    const candidates = search.items;

    const scores = new Map<string, number>();
    const bestArticle = new Map<string, string>();
    for (const candidate of candidates.slice(0, FETCH_BUDGET)) {
      const articles = await fetchArticles(candidate.law_id);
      const scored = scoreArticles(articles, item.query);
      scores.set(candidate.law_id, scored.score);
      if (scored.top[0]) bestArticle.set(candidate.law_id, scored.top[0].display);
    }
    const reranked = rerankByArticleScore(candidates, (c) => scores.get(c.law_id) ?? 0);
    latencies.push(Date.now() - t0);

    const beforeNames = candidates.map((c) => c.law_name);
    const afterNames = reranked.map((c) => c.law_name);
    const b3 = isHitAtK(beforeNames, item.expected_laws, 3);
    const a3 = isHitAtK(afterNames, item.expected_laws, 3);
    if (b3) beforeHit3++;
    if (a3) afterHit3++;
    if (isHitAtK(beforeNames, item.expected_laws, 1)) beforeHit1++;
    if (isHitAtK(afterNames, item.expected_laws, 1)) afterHit1++;

    // 조문 축: 1위 법령의 최상위 매칭 조문이 라벨과 같은가
    if (item.expected_article) {
      articleChecked++;
      const topLaw = reranked[0];
      const predicted = topLaw ? bestArticle.get(topLaw.law_id) : undefined;
      const expected = item.expected_article.split(" ").pop();
      if (predicted && expected && predicted.replace(/\s/g, "") === expected.replace(/\s/g, "")) articleCorrect++;
      rows.push(`  ${b3 ? "○" : "✗"}→${a3 ? "○" : "✗"} ${item.query}\n      before: ${beforeNames.slice(0, 3).join(" / ")}\n      after : ${afterNames.slice(0, 3).join(" / ")}\n      조문: 예측=${predicted ?? "-"} 기대=${expected}`);
    } else {
      rows.push(`  ${b3 ? "○" : "✗"}→${a3 ? "○" : "✗"} ${item.query}\n      after : ${afterNames.slice(0, 3).join(" / ")}`);
    }
    process.stdout.write(`\r측정 ${index + 1}/${items.length}   `);
  }

  console.log("\n");
  rows.forEach((r) => console.log(r));
  const pct = (n: number) => `${((n / items.length) * 100).toFixed(1)}%`;
  latencies.sort((a, b) => a - b);
  console.log("\n=== 판정 ===");
  console.log(`  recall@3  before ${pct(beforeHit3)} → after ${pct(afterHit3)}`);
  console.log(`  recall@1  before ${pct(beforeHit1)} → after ${pct(afterHit1)}`);
  console.log(`  조문 정확도 ${articleCorrect}/${articleChecked} = ${((articleCorrect / articleChecked) * 100).toFixed(1)}%`);
  console.log(`  지연 median ${latencies[Math.floor(latencies.length / 2)]}ms · p90 ${latencies[Math.floor(latencies.length * 0.9)]}ms · max ${latencies.at(-1)}ms`);
  console.log(`  캐시 보유 법령 ${cache.size}개`);
}

main();
