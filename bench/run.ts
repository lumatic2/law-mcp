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
  aggregateRepeats,
  type ItemOutcome,
} from "./scoring.js";

type Item = {
  query: string;
  domain: string;
  /** 세법 세트(golden-tax)의 질의 유형. 구 세트에는 없다. */
  type?: string;
  /** 귀속연도 — TV3 이 쓸 자리. TV1 시점에는 전부 null 이다. */
  tax_year?: string | null;
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
    set: get("--set") ?? "golden",
    split: get("--split") ?? "dev",
    label: get("--label"),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    repeat: get("--repeat") ? Number(get("--repeat")) : 1,
    holdoutSealBroken: argv.includes("--i-am-closing-the-horizon"),
    dryRun: argv.includes("--dry-run"),
    // blind = 자연어 쿼리로 법령을 찾는다(기존 기본값 — 기존 측정과 재현 비교 가능).
    // assisted = 법령명을 소비자가 준다고 가정하고 조문 도달만 잰다(선행 사례의 표준 소비 패턴).
    mode: (get("--mode") ?? "blind") as "blind" | "assisted",
    date: get("--date") ?? new Date().toISOString().slice(0, 10),
  };
}

// 회차마다 새로 만든다(반복 측정에서 캐시가 σ 를 0 으로 만드는 것을 막는다).
let articleCache = new ArticleIndexCache(40);

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
    type: item.type,
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
    type: item.type,
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

    // 조문 축 (UD2 step-3) — **출하되는 값**을 잰다.
    // LB2~LB5 는 `scoreArticles` 라는 미출하 함수를 쟀다. 그 수치는 제품이 주는 값이 아니라
    // 벤치 전용 경로의 값이었다(F4). 여기서는 `search_law` 응답에 실제로 실린 `ai_articles`
    // 만 본다 — 응답에 없는 것은 소비 LLM 에게 없는 것이다.
    const label = item.expected_article ? parseArticleLabel(item.expected_article) : null;
    const shipped = label
      ? law.items.find((i) => i.law_name === label.law)?.ai_articles ?? null
      : null;

    return {
      ...base,
      returned,
      hit1: isHitAtK(returned, item.expected_laws, 1),
      hit3: isHitAtK(returned, item.expected_laws, 3),
      precHit,
      ...(shipped && shipped.length > 0
        ? {
            articleChecked: true,
            predictedArticles: shipped.map((a) => a.article),
            articleCorrect: isSameArticle(shipped[0].article, label!.article),
            articleCorrectAt3: shipped.slice(0, 3).some((a) => isSameArticle(a.article, label!.article)),
          }
        : {
            // 정답 법령이 안 나왔거나 조문이 안 실린 경우 — 조문 축의 분모에서 뺀다.
            // 법령 도달 실패를 조문 오답으로 세면 두 축이 뒤섞인다(recall@3 이 이미 재는 것이다).
            articleShippingMiss: Boolean(label),
          }),
    };
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
}

/**
 * 홀드아웃 봉인 (UD1 step-2).
 *
 * LB5 에서 홀드아웃 15건이 소진된 이유는 규약이 **문서에만** 있었기 때문이다("bench/README.md
 * 참조"). 사람 기억에 맡기면 튜닝 중에 한 번 열게 되고, 그러면 그 세트는 죽는다.
 * golden-v2 의 홀드아웃은 horizon close 시 1회만 연다 — 그 규약을 여기서 **코드로** 강제한다.
 */
export function assertHoldoutSeal(split: string, sealBroken: boolean): void {
  if (split !== "holdout" || sealBroken) return;
  throw new Error(
    "홀드아웃은 봉인돼 있다 — horizon close 시 1회만 연다.\n" +
      "  정말 닫는 시점이면 --i-am-closing-the-horizon 을 붙여라.\n" +
      "  튜닝·A/B 중이라면 --split dev 를 써라(홀드아웃을 열면 그 세트는 죽는다).",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertHoldoutSeal(args.split, args.holdoutSealBroken);

  const golden = JSON.parse(
    readFileSync(new URL(`./${args.set}.json`, import.meta.url), "utf8"),
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

  const assisted = args.mode === "assisted";

  // 반복 측정 — 2회차부터는 진행 로그를 줄이고 수치만 모은다.
  //
  // ⚠ 회차마다 provider 와 조문 캐시를 **새로 만든다.** 같은 인스턴스를 재사용하면 2회차부터
  // 용어 연계 캐시가 히트해 결과가 기계적으로 동일해지고, σ=0 이라는 거짓 신호가 나온다
  // (첫 구현에서 실제로 관측 — 5회 전부 60.0%). 우리가 재려는 것은 **upstream 비결정성**이라
  // 캐시로 지워선 안 된다.
  const repeat = Math.max(1, args.repeat);
  const passes: ItemOutcome[][] = [];
  for (let round = 0; round < repeat; round += 1) {
    if (repeat > 1) console.log(`\n--- 반복 ${round + 1}/${repeat} ---`);
    articleCache = new ArticleIndexCache(40);
    passes.push(await runPass(new LawGoProvider(), items, assisted, repeat === 1 || round === 0));
  }
  const outcomes = passes[0];

  if (repeat > 1) {
    const key = assisted ? "accuracy@3" : "recall@3";
    const values = passes.map((p) =>
      assisted ? summarizeAssisted(p).accuracy_at_3 : summarize(p).recall_at_3,
    );
    const stats = aggregateRepeats(values);
    console.log(`\n=== 반복 측정 (${key}, n=${stats.n}) ===`);
    console.log(`  평균     ${(stats.mean * 100).toFixed(1)}%`);
    console.log(`  표준편차 ${stats.sd === null ? "n/a (n=1)" : `${(stats.sd * 100).toFixed(1)}%p`}`);
    console.log(`  범위     ${(stats.min * 100).toFixed(1)}% ~ ${(stats.max * 100).toFixed(1)}%`);
    console.log(
      `  채택 문턱(2σ) ${stats.threshold_2sd === null ? "판정 불가" : `${(stats.threshold_2sd * 100).toFixed(1)}%p`}` +
        ` — 이보다 작은 차이는 노이즈와 구분되지 않는다`,
    );
    console.log(`  각 회차: ${stats.values.map((v) => `${(v * 100).toFixed(1)}%`).join(" / ")}`);
    const statsPath = resolve("evidence/bench", `${args.date}-${args.label ?? args.split}-repeat.json`);
    mkdirSync(resolve("evidence/bench"), { recursive: true });
    writeFileSync(
      statsPath,
      JSON.stringify({ date: args.date, set: args.set, split: args.split, mode: args.mode, metric: key, stats }, null, 2) + "\n",
      "utf8",
    );
    console.log(`  → ${statsPath}`);
  }

  if (assisted) {
    const summary = summarizeAssisted(outcomes);
    const label = args.label ?? `${args.split}-assisted`;
    const outPath = resolve("evidence/bench", `${args.date}-${label}.json`);
    mkdirSync(resolve("evidence/bench"), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify({ date: args.date, set: args.set, split: args.split, mode: "assisted", summary, outcomes }, null, 2) + "\n",
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
    JSON.stringify({ date: args.date, set: args.set, split: args.split, summary, outcomes }, null, 2) + "\n",
    "utf8",
  );

  console.log("\n=== 요약 ===");
  console.log(`  recall@3        ${(summary.recall_at_3 * 100).toFixed(1)}%  (1차 지표)`);
  console.log(`  recall@1        ${(summary.recall_at_1 * 100).toFixed(1)}%`);
  console.log(`  판례 hit율      ${(summary.precedent_hit_rate * 100).toFixed(1)}%  (품질 지표 아님)`);
  console.log(`  조문 정확도     ${summary.article_accuracy === null ? "미측정" : `${(summary.article_accuracy * 100).toFixed(1)}%`}  (제품 응답에 실린 조문 기준, n=${summary.article_checked})`);
  // 출하율을 따로 보여 준다 — 정확도만 보면 "안 실린 것"이 분모에서 빠져 좋아 보인다.
  const shippingMiss = outcomes.filter((o) => o.articleShippingMiss).length;
  if (summary.article_checked + shippingMiss > 0) {
    const rate = (summary.article_checked / (summary.article_checked + shippingMiss)) * 100;
    console.log(`  조문 출하율     ${rate.toFixed(1)}%  (조문 라벨 ${summary.article_checked + shippingMiss}건 중 ${summary.article_checked}건에 조문이 실림)`);
  }
  console.log(`  채점 ${summary.scored}건 / 에러 ${summary.errors}건`);
  console.log(`  도메인별 recall@3: ${Object.entries(summary.by_domain).map(([k, v]) => `${k}=${(v.recall_at_3 * 100).toFixed(0)}%`).join(" ")}`);
  // 유형 분해는 세법 세트에서만 나온다(구 세트는 type 라벨이 없어 빈 객체).
  // 어느 유형이 약한지가 TV2~TV5 의 우선순위 근거다.
  for (const [name, v] of Object.entries(summary.by_type)) {
    const art = v.article_accuracy === null ? "n/a" : `${(v.article_accuracy * 100).toFixed(0)}%`;
    console.log(`    ${name.padEnd(16)} n=${String(v.total).padStart(2)}  recall@3 ${(v.recall_at_3 * 100).toFixed(0).padStart(3)}%  조문정확도 ${art}`);
  }
  // 켜지지 않은 축을 0% 로 내면 "시점을 다 틀렸다"는 거짓 주장이 된다 — n/a 로 낸다.
  console.log(`  시점 정확도     ${summary.as_of_accuracy === null ? "n/a (TV3 미도입)" : `${(summary.as_of_accuracy * 100).toFixed(1)}%  (${summary.as_of_checked}건)`}`);
  console.log(`  → ${outPath}`);
}

async function runPass(
  provider: LawGoProvider,
  items: Item[],
  assisted: boolean,
  verbose: boolean,
): Promise<ItemOutcome[]> {
  const outcomes: ItemOutcome[] = [];
  for (const [index, item] of items.entries()) {
    const outcome = assisted ? await scoreAssisted(provider, item) : await scoreItem(provider, item);
    outcomes.push(outcome);

    if (!verbose) {
      process.stdout.write(".");
      continue;
    }

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


  return outcomes;
}

// 테스트가 이 모듈을 import 할 때(assertHoldoutSeal 계약 검증) 러너가 돌면 안 된다 —
// 직접 실행됐을 때만 main 을 부른다.
if ((process.argv[1] ?? "").split("\\").join("/").endsWith("bench/run.ts")) {
  main();
}
