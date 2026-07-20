/**
 * 골든셋 러너 (LB1 step-2).
 *   npm run bench:golden -- --split dev [--dry-run] [--label <name>] [--limit <n>]
 * 결과는 evidence/bench/<date>-<label>.json 으로 저장한다.
 *
 * ⚠ --split holdout 은 LB2 완료 시점에 1회만 (bench/README.md 홀드아웃 봉인 규약).
 */
import axios from "axios";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ArticleIndexCache, extractArticles } from "../src/article-index.js";
import { scoreArticles } from "../src/article-match.js";
import { LAW_API_OC, LAW_SERVICE_BASE_URL } from "../src/config.js";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import {
  isHitAtK,
  isSameArticle,
  parseArticleLabel,
  summarize,
  summarizeAssisted,
  type ItemOutcome,
} from "./scoring.js";

type Item = {
  query: string;
  domain: string;
  expected_laws: string[];
  expected_article?: string;
  split: string;
  source: string;
};

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    split: get("--split") ?? "dev",
    label: get("--label"),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    dryRun: argv.includes("--dry-run"),
    // blind = 자연어 쿼리로 법령을 찾는다(기존 기본값 — 기존 측정과 재현 비교 가능).
    // assisted = 법령명을 소비자가 준다고 가정하고 조문 도달만 잰다(선행 사례의 표준 소비 패턴).
    mode: (get("--mode") ?? "blind") as "blind" | "assisted",
    date: get("--date") ?? new Date().toISOString().slice(0, 10),
  };
}

const articleCache = new ArticleIndexCache(40);

async function loadArticles(lawName: string, provider: LawGoProvider) {
  const cached = articleCache.get(lawName);
  if (cached) return cached;

  const search = await provider.searchLaw(lawName, { limit: 3 });
  const exact = search.items.find((i) => i.match_type === "exact") ?? search.items[0];
  if (!exact) {
    articleCache.set(lawName, []);
    return [];
  }

  const res = await axios.get(LAW_SERVICE_BASE_URL, {
    params: { OC: LAW_API_OC, target: "law", type: "JSON", ID: exact.law_id },
    timeout: 20_000,
    validateStatus: () => true,
  });
  const articles = res.status >= 400 ? [] : extractArticles(res.data as Record<string, unknown>);
  articleCache.set(lawName, articles);
  return articles;
}

/**
 * assisted 모드 채점 — 법령명은 주어지고, 도구가 그 안에서 정답 조문에 닿는지만 본다.
 * 순환 논리가 아닌 이유: 정답 법령 입력은 소비자 LLM 의 역할을 대신하는 것이고,
 * 측정 대상은 그 이후 도구의 조문 도달 능력이다.
 */
async function scoreAssisted(provider: LawGoProvider, item: Item): Promise<ItemOutcome> {
  const base: ItemOutcome = {
    query: item.query,
    domain: item.domain,
    split: item.split,
    hit1: false,
    hit3: false,
    precHit: false,
    articleChecked: false,
    articleCorrect: false,
    returned: [],
  };

  if (!item.expected_article) return { ...base, skipped: "조문 라벨 없음" };
  const label = parseArticleLabel(item.expected_article);
  if (!label) return { ...base, skipped: "조문 라벨 형식 불량" };

  try {
    const articles = await loadArticles(label.law, provider);
    if (articles.length === 0) return { ...base, skipped: `조문 인덱스 비어 있음 (${label.law})` };

    const scored = scoreArticles(articles, item.query, 3);
    const predicted = scored.top.map((t) => t.display);
    const expectedNo = label.article;
    return {
      ...base,
      returned: [label.law],
      articleChecked: true,
      predictedArticles: predicted,
      articleCorrect: predicted.length > 0 && isSameArticle(predicted[0], expectedNo),
      articleCorrectAt3: predicted.some((p) => isSameArticle(p, expectedNo)),
    };
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
}

async function scoreItem(provider: LawGoProvider, item: Item): Promise<ItemOutcome> {
  const base: ItemOutcome = {
    query: item.query,
    domain: item.domain,
    split: item.split,
    hit1: false,
    hit3: false,
    precHit: false,
    articleChecked: false,
    articleCorrect: false,
    returned: [],
  };

  try {
    const law = await provider.searchLaw(item.query, { limit: 3 });
    const returned = law.items.map((i) => i.law_name);
    let precHit = false;
    try {
      const prec = await provider.searchPrecedents(item.query, { limit: 3 });
      precHit = prec.items.length > 0;
    } catch {
      precHit = false; // 판례 실패는 보조 지표라 항목 전체를 실패로 만들지 않는다
    }

    return {
      ...base,
      returned,
      hit1: isHitAtK(returned, item.expected_laws, 1),
      hit3: isHitAtK(returned, item.expected_laws, 3),
      precHit,
      // 조문 축은 LB2 에서 채운다 — 지금은 조문 검색 수단이 없다(articleChecked=false).
    };
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const golden = JSON.parse(
    readFileSync(new URL("./golden.json", import.meta.url), "utf8"),
  ) as { items: Item[] };

  let items = golden.items.filter((i) => i.split === args.split);
  if (args.limit) items = items.slice(0, args.limit);

  if (args.dryRun) {
    const domains = new Map<string, number>();
    for (const item of items) domains.set(item.domain, (domains.get(item.domain) ?? 0) + 1);
    console.log(`dry-run — split=${args.split} 항목 ${items.length}건 (API 호출 없음)`);
    console.log(`  도메인: ${[...domains].map(([k, v]) => `${k}=${v}`).join(" ")}`);
    console.log(`  조문 라벨 보유: ${items.filter((i) => i.expected_article).length}건`);
    return;
  }

  if (items.length === 0) {
    console.log(`split=${args.split} 항목이 없다.`);
    process.exitCode = 1;
    return;
  }

  const provider = new LawGoProvider();
  const assisted = args.mode === "assisted";
  const outcomes: ItemOutcome[] = [];
  for (const [index, item] of items.entries()) {
    const outcome = assisted ? await scoreAssisted(provider, item) : await scoreItem(provider, item);
    outcomes.push(outcome);

    if (assisted) {
      const mark = outcome.error ? "ERR " : outcome.skipped ? "SKIP" : outcome.articleCorrect ? "OK@1" : outcome.articleCorrectAt3 ? "OK@3" : "MISS";
      console.log(
        `[${String(index + 1).padStart(2)}/${items.length}] ${mark} ${item.query}`
          + `\n        기대: ${item.expected_article ?? "-"}`
          + `\n        예측: ${outcome.predictedArticles?.join(" / ") || outcome.skipped || outcome.error || "-"}`,
      );
    } else {
      const mark = outcome.error ? "ERR " : outcome.hit3 ? (outcome.hit1 ? "HIT1" : "HIT3") : "MISS";
      console.log(
        `[${String(index + 1).padStart(2)}/${items.length}] ${mark} ${item.query}`
          + `\n        기대: ${item.expected_laws.join(" | ")}`
          + `\n        반환: ${outcome.returned.join(" / ") || (outcome.error ?? "0건")}`,
      );
    }
  }

  if (assisted) {
    const summary = summarizeAssisted(outcomes);
    const label = args.label ?? `${args.split}-assisted`;
    const outPath = resolve("evidence/bench", `${args.date}-${label}.json`);
    mkdirSync(resolve("evidence/bench"), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify({ date: args.date, split: args.split, mode: "assisted", summary, outcomes }, null, 2) + "\n",
      "utf8",
    );
    console.log("\n=== 요약 (assisted — 조문 도달 지표. blind recall 과 합산 금지) ===");
    console.log(`  accuracy@1      ${(summary.accuracy_at_1 * 100).toFixed(1)}%`);
    console.log(`  accuracy@3      ${(summary.accuracy_at_3 * 100).toFixed(1)}%`);
    console.log(`  측정 ${summary.measured}건 / 대상 아님 ${summary.skipped}건 / 에러 ${summary.errors}건`);
    console.log(`  → ${outPath}`);
    return;
  }

  const summary = summarize(outcomes);
  const label = args.label ?? `${args.split}`;
  const outPath = resolve("evidence/bench", `${args.date}-${label}.json`);
  mkdirSync(resolve("evidence/bench"), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify({ date: args.date, split: args.split, summary, outcomes }, null, 2) + "\n",
    "utf8",
  );

  console.log("\n=== 요약 ===");
  console.log(`  recall@3        ${(summary.recall_at_3 * 100).toFixed(1)}%  (1차 지표)`);
  console.log(`  recall@1        ${(summary.recall_at_1 * 100).toFixed(1)}%`);
  console.log(`  판례 hit율      ${(summary.precedent_hit_rate * 100).toFixed(1)}%  (품질 지표 아님)`);
  console.log(`  조문 정확도     ${summary.article_accuracy === null ? "미측정(LB2)" : `${(summary.article_accuracy * 100).toFixed(1)}%`}`);
  console.log(`  채점 ${summary.scored}건 / 에러 ${summary.errors}건`);
  console.log(`  도메인별 recall@3: ${Object.entries(summary.by_domain).map(([k, v]) => `${k}=${(v.recall_at_3 * 100).toFixed(0)}%`).join(" ")}`);
  console.log(`  → ${outPath}`);
}

main();
