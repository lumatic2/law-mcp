/**
 * LB5 step-3 — 조문 도달 A/B.
 *
 * 두 경로를 같은 dev 항목에서 비교한다:
 *   (A) 기존 `scoreArticles` — 법령 전문을 받아 쿼리 토큰으로 조문을 고른다(벤치 전용 경로).
 *   (B) 용어 연계가 지목한 조문 — `search_law` 응답의 `linked_articles` 로 **실제 출하되는** 값.
 *
 * (B) 가 중요한 이유: (A) 는 어떤 MCP 도구에도 연결돼 있지 않다. 즉 기존 assisted 지표는
 * 출하되지 않은 경로를 재고 있었다. (B) 는 소비 LLM 이 실제로 받는 값이다.
 */
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ArticleIndexCache, extractArticles } from "../src/article-index.js";
import { scoreArticles } from "../src/article-match.js";
import { LAW_API_OC, LAW_SERVICE_BASE_URL } from "../src/config.js";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { isSameArticle, parseArticleLabel } from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, "golden.json"), "utf-8")) as {
  items: Array<{ query: string; split: string; domain: string; expected_article?: string }>;
};
const items = golden.items.filter((item) => item.split === "dev" && item.expected_article);

const provider = new LawGoProvider();
const articleCache = new ArticleIndexCache(40);

async function loadArticles(lawName: string) {
  const cached = articleCache.get(lawName);
  if (cached) return cached;
  const search = await provider.searchLaw(lawName, { limit: 3, termBoost: { enabled: false } });
  const exact = search.items.find((entry) => entry.match_type === "exact") ?? search.items[0];
  if (!exact) { articleCache.set(lawName, []); return []; }
  const res = await axios.get(LAW_SERVICE_BASE_URL, {
    params: { OC: LAW_API_OC, target: "law", type: "JSON", ID: exact.law_id },
    timeout: 20_000, validateStatus: () => true,
  });
  const articles = res.status >= 400 ? [] : extractArticles(res.data as Record<string, unknown>);
  articleCache.set(lawName, articles);
  return articles;
}

type Tally = { at1: number; at3: number; covered: number };
const scoreOnly: Tally = { at1: 0, at3: 0, covered: 0 };
const linkedOnly: Tally = { at1: 0, at3: 0, covered: 0 };
const combined: Tally = { at1: 0, at3: 0, covered: 0 };
const scoreFirst: Tally = { at1: 0, at3: 0, covered: 0 };
const fillGap: Tally = { at1: 0, at3: 0, covered: 0 };
const interleave: Tally = { at1: 0, at3: 0, covered: 0 };
const oneSlot: Tally = { at1: 0, at3: 0, covered: 0 };
const detail: string[] = [];

for (const [index, item] of items.entries()) {
  const label = parseArticleLabel(item.expected_article as string);
  if (!label) continue;

  // (A) 기존 조문 점수
  let scorePredicted: string[] = [];
  try {
    const articles = await loadArticles(label.law);
    if (articles.length > 0) scorePredicted = scoreArticles(articles, item.query, 3).top.map((t) => t.display);
  } catch { /* 빈 예측으로 둔다 */ }

  // (B) 출하되는 연계 조문 — 정답 법령에 해당하는 항목의 linked_articles
  let linkedPredicted: string[] = [];
  try {
    const search = await provider.searchLaw(item.query, { limit: 3 });
    const normalize = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "");
    const match = search.items.find((entry) => normalize(entry.law_name) === normalize(label.law));
    linkedPredicted = match?.linked_articles ?? [];
  } catch { /* 빈 예측 */ }

  const hitAt = (list: string[], k: number) =>
    list.slice(0, k).some((display) => isSameArticle(display, label.article));

  const bump = (tally: Tally, list: string[]) => {
    if (list.length > 0) tally.covered += 1;
    if (hitAt(list, 1)) tally.at1 += 1;
    if (hitAt(list, 3)) tally.at3 += 1;
  };

  // (C) 결합: 연계가 있으면 연계를 앞에 두고 기존 예측을 뒤에 붙인다.
  const merged = [...linkedPredicted, ...scorePredicted.filter((d) => !linkedPredicted.includes(d))];

  // (D) 기존 우선 + 연계로 뒤를 채운다.
  const scoreFirstList = [...scorePredicted, ...linkedPredicted.filter((d) => !scorePredicted.includes(d))];
  // (E) 기존이 아무 예측도 못 냈을 때만 연계를 쓴다(가장 보수적).
  const fillGapList = scorePredicted.length > 0 ? scorePredicted : linkedPredicted;

  bump(scoreOnly, scorePredicted);
  bump(linkedOnly, linkedPredicted);
  bump(combined, merged);
  bump(scoreFirst, scoreFirstList);
  bump(fillGap, fillGapList);

  // (F) 교차 배치 — A1, B1, A2, B2 ... 두 경로에 상위 자리를 나눠 준다.
  const interleaved: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    for (const list of [scorePredicted, linkedPredicted]) {
      const value = list[i];
      if (value && !interleaved.includes(value)) interleaved.push(value);
    }
  }
  // (G) 연계에 1자리만 준다 — A1, B1, A2, A3.
  const oneSlotList = [scorePredicted[0], linkedPredicted[0], ...scorePredicted.slice(1)]
    .filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

  bump(interleave, interleaved);
  bump(oneSlot, oneSlotList);

  const mark = hitAt(merged, 1) ? "HIT1" : hitAt(merged, 3) ? "HIT3" : "MISS";
  detail.push(
    `| ${item.query} | ${item.expected_article} | ${scorePredicted.join(",") || "-"} `
    + `| ${linkedPredicted.join(",") || "-"} | ${mark} |`,
  );
  console.error(`[${index + 1}/${items.length}] ${mark} ${item.query}`);
}

const pct = (n: number) => ((n / items.length) * 100).toFixed(1) + "%";
const out: string[] = [];
out.push(`# LB5 step-3 — 조문 도달 A/B (dev ${items.length}건, 정답 법령 주어짐)`);
out.push("");
out.push("| 경로 | acc@1 | acc@3 | 예측을 낸 건수 |");
out.push("|---|---|---|---|");
out.push(`| (A) 기존 scoreArticles (**미출하 경로**) | ${pct(scoreOnly.at1)} | ${pct(scoreOnly.at3)} | ${scoreOnly.covered} |`);
out.push(`| (B) 용어 연계 조문 (**출하됨**) | ${pct(linkedOnly.at1)} | ${pct(linkedOnly.at3)} | ${linkedOnly.covered} |`);
out.push(`| (C) 연계 우선 + 기존 보완 | ${pct(combined.at1)} | ${pct(combined.at3)} | ${combined.covered} |`);
out.push(`| (D) 기존 우선 + 연계 보완 | ${pct(scoreFirst.at1)} | ${pct(scoreFirst.at3)} | ${scoreFirst.covered} |`);
out.push(`| (E) 기존 무예측일 때만 연계 | ${pct(fillGap.at1)} | ${pct(fillGap.at3)} | ${fillGap.covered} |`);
out.push(`| (F) 교차 배치 A1,B1,A2,B2 | ${pct(interleave.at1)} | ${pct(interleave.at3)} | ${interleave.covered} |`);
out.push(`| (G) 연계에 2번 자리 1칸만 | ${pct(oneSlot.at1)} | ${pct(oneSlot.at3)} | ${oneSlot.covered} |`);
out.push("");
out.push("| 쿼리 | 정답 조문 | (A) 예측 | (B) 연계 | 결합 판정 |");
out.push("|---|---|---|---|---|");
out.push(...detail);

const target = path.resolve(__dirname, "../evidence/bench/2026-07-21-lb5-article-sweep.md");
fs.writeFileSync(target, out.join("\n"), "utf-8");
console.log(out.slice(0, 8).join("\n"));
console.log(`\n→ ${target}`);
