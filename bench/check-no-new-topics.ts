/**
 * 주제 무개입 증명 (TF2 step-2).
 *
 * **왜 있나**: 직전 horizon 의 홀드아웃이 변별력을 잃은 직접 원인은 에이전트가 문제의 *주제까지*
 * 골랐기 때문이다(10건 중 6건). 유출 탐지기는 문단의 **문자열**만 보므로 이 "구성에 의한 오염"을
 * 못 잡는다. 그래서 다른 축으로 잡는다 — **코퍼스의 모든 정답 조문이 통합 전 세트에 이미
 * 존재했는가.** 하나라도 새로 생겼으면 누군가 주제를 고른 것이다.
 *
 * 예외는 딱 하나: 라벨 규약(ADR 0001) 적용으로 본법→시행령이 바뀐 레코드. 이건 주제를 새로
 * 만든 게 아니라 **같은 질문의 정답을 규약대로 고친 것**이라 `label_rule` 필드로 표시하고
 * 여기서 사유와 함께 출력한다. 표시 없는 신규 주제는 실패다.
 *
 * 사용: npx tsx bench/check-no-new-topics.ts
 */
import { readFileSync } from "node:fs";

const LEGACY_SETS = [
  "golden.json",
  "golden-v2.json",
  "golden-tax.json",
  "golden-tax-agentic.json",
];

type Case = {
  case_id: string;
  expected_article: string | null;
  expect_abstain?: boolean;
  label_rule?: string;
};

function normalize(article: string): string {
  return article.replace(/[\s·ㆍ]/g, "");
}

function main(): void {
  const legacy = new Set<string>();
  for (const file of LEGACY_SETS) {
    const data = JSON.parse(
      readFileSync(new URL(`../archive/bench/${file}`, import.meta.url), "utf8"),
    ) as { items: Case[] };
    for (const item of data.items) {
      if (item.expected_article) legacy.add(normalize(item.expected_article));
    }
  }

  const corpus = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8")) as {
    items: Case[];
  };

  const novel: Case[] = [];
  const ruled: Case[] = [];
  for (const item of corpus.items) {
    if (!item.expected_article) continue; // 기권 케이스는 정답 조문이 없다
    if (legacy.has(normalize(item.expected_article))) continue;
    (item.label_rule ? ruled : novel).push(item);
  }

  console.log(`통합 전 세트의 정답 조문: ${legacy.size}종 (${LEGACY_SETS.length}파일)`);
  console.log(`코퍼스 레코드: ${corpus.items.length}건`);

  if (ruled.length > 0) {
    console.log(`\n규약 적용으로 바뀐 라벨 ${ruled.length}건 (주제 신설 아님):`);
    for (const item of ruled) {
      console.log(`  ${item.case_id}  → ${item.expected_article}  [${item.label_rule}]`);
    }
  }

  if (novel.length === 0) {
    console.log(`\nPASS — 표시 없는 신규 주제 0건. 이 horizon 은 문제의 주제를 만들지 않았다.`);
    return;
  }

  console.log(`\nFAIL — 통합 전 세트에 없는 정답 조문 ${novel.length}건:`);
  for (const item of novel) console.log(`  ${item.case_id}  ${item.expected_article}`);
  console.log("  주제를 새로 만들었거나, 규약 적용이면 label_rule 로 사유를 남겨야 한다.");
  process.exit(1);
}

main();
