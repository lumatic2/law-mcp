/**
 * 골든셋 정답 라벨 검증기 (LB1 step-1).
 * 채점 러너가 아니라 **라벨이 실재하는지** 확인하는 일회성 도구:
 *   ① expected_laws 의 법령명이 법제처에 실재하는가(법령명 매칭으로 조회)
 *   ② expected_article 이 실재하고 본문을 가져올 수 있는가
 * 실패 항목은 라벨이 틀린 것이므로 골든셋을 고친다(도구 성능 측정과 무관).
 */
import { readFileSync } from "node:fs";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

type Item = {
  query: string;
  domain: string;
  expected_laws: string[];
  expected_article?: string;
  split: string;
  source: string;
};

const p = new LawGoProvider();

// --set <이름> 으로 검증 대상 세트를 고른다(기본 golden). UD1 에서 golden-v2 가 생겼다.
const setArg = process.argv.indexOf("--set");
const setName = setArg >= 0 ? process.argv[setArg + 1] : "golden";
const golden = JSON.parse(readFileSync(new URL(`./${setName}.json`, import.meta.url), "utf8")) as {
  items: Item[];
};
console.log(`세트: ${setName}.json (${golden.items.length}건)\n`);

function parseArticle(label: string): { law: string; article: string } | null {
  const m = label.match(/^(.+?)\s+(제\d+조(?:의\d+)?)$/);
  if (!m) return null;
  return { law: m[1].trim(), article: m[2] };
}

async function main() {
  const lawNames = [...new Set(golden.items.flatMap((i) => i.expected_laws))];
  console.log(`=== ① 법령명 실재 확인 (${lawNames.length}종) ===`);
  const missingLaws: string[] = [];
  for (const name of lawNames) {
    const r = await p.searchLaw(name, { limit: 3 });
    const exact = r.items.find((i) => i.match_type === "exact");
    if (exact) {
      console.log(`  OK   ${name} (id=${exact.law_id})`);
    } else {
      missingLaws.push(name);
      console.log(`  FAIL ${name} → ${r.items.map((i) => i.law_name).join(" / ") || "0건"}`);
    }
  }

  const withArticle = golden.items.filter((i) => i.expected_article);
  console.log(`\n=== ② 조문 실재 확인 (${withArticle.length}건) ===`);
  const badArticles: string[] = [];
  for (const item of withArticle) {
    const parsed = parseArticle(item.expected_article!);
    if (!parsed) {
      badArticles.push(`${item.expected_article} (라벨 형식 불량)`);
      console.log(`  FAIL ${item.expected_article} — 형식 파싱 실패`);
      continue;
    }
    try {
      const art = await p.getLawArticle(parsed.law, parsed.article);
      const body = (art?.content ?? "").replace(/\s+/g, " ").trim();
      if (!body) {
        badArticles.push(item.expected_article!);
        console.log(`  FAIL ${item.expected_article} — 본문 없음`);
      } else {
        console.log(`  OK   ${item.expected_article} :: ${art?.title ?? ""} | ${body.slice(0, 60)}`);
      }
    } catch (e) {
      badArticles.push(item.expected_article!);
      console.log(`  FAIL ${item.expected_article} — ${(e as Error).message}`);
    }
  }

  console.log(`\n=== 요약 ===`);
  console.log(`법령명 실재 실패: ${missingLaws.length}건 ${missingLaws.join(", ")}`);
  console.log(`조문 실재 실패: ${badArticles.length}건 ${badArticles.join(", ")}`);
  if (missingLaws.length || badArticles.length) process.exitCode = 1;
}

main();
