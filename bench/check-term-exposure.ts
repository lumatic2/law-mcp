/**
 * 맥락 용어 노출 검사 (M6 step-1).
 *
 * **왜 있나**: 이 도구가 실제로 겪는 난점은 *일상어로 물었을 때 법률 용어로 된 조문에 닿는가*다.
 * 맥락 산문이 정답 조문 표제의 법률 용어를 그대로 담고 있으면 문제가 공짜로 쉬워지고, 어휘 공백
 * 축이 측정에서 조용히 사라진다. 사람 눈으로는 60건을 일관되게 못 보므로 기계로 본다.
 *
 * 판정: 표제에서 **3자 이상 내용어**를 뽑아(조사·일반어 제거) `context` 에 부분문자열로 등장하면
 * FAIL. `query` 는 검사하지 않는다 — 사람이 검색창에 치는 말이라 용어가 섞이는 것이 자연스럽고,
 * 기존 코퍼스도 그렇다(`임금체불 지연이자`).
 *
 * 사용: npx tsx bench/check-term-exposure.ts [파일] [--expect-fail]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 표제에 흔한 일반어 — 이것까지 금지하면 한국어로 상황을 서술할 수 없다. */
const GENERIC = new Set([
  "특례",
  "계산",
  "방법",
  "경우",
  "기타",
  "그밖의",
  "관련",
  "적용",
  "배제",
  "산입",
  "제출",
  "발급",
  "징수",
  "신고",
  "납부",
  "공제",
  "세율",
  "세액",
  "기간",
  "순위",
  "효력",
  "준용",
  "확정",
  "승계",
  "연장",
  "위탁",
  "면제",
  "행위",
  "자료",
  "시기",
]);

export function titleTerms(title: string): string[] {
  return title
    // 표제를 토큰으로 가른다 — 조사·접속어가 붙은 채로 비교하면 아무것도 안 걸린다.
    .split(/[\sㆍ·,()「」]|및|또는|에\s*대한|에\s*관한|으로\s*인한|의\s+/)
    .map((t) => t.replace(/^(제\d+조(의\d+)?|등|의)$/g, "").trim())
    .map((t) => t.replace(/(의|에|을|를|은|는|이|가|와|과|으로|로)$/, ""))
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}

type Item = { case_id: string; topic_id: string; context: string; article_title: string };

function main(): void {
  const args = process.argv.slice(2);
  const expectFail = args.includes("--expect-fail");
  const path = resolve(args.find((a) => !a.startsWith("--")) ?? "bench/expansion/items-2026-08-01.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as { items: Item[] };

  const hits: string[] = [];
  for (const item of data.items) {
    for (const term of titleTerms(item.article_title)) {
      if (item.context.includes(term)) {
        hits.push(`  ${item.case_id} ${item.topic_id}: context 에 표제 용어 "${term}" 노출`);
      }
    }
  }

  console.log(`용어 노출 검사: ${data.items.length}건 · 노출 ${hits.length}건`);
  if (hits.length > 0) {
    for (const h of hits) console.log(h);
    console.log("  일상어로 바꿔 쓰라 — 표제 용어를 담으면 어휘 공백 축이 사라진다.");
  }

  // `--expect-fail` 은 검사 자체가 실제로 평가되는지 증명하는 데 쓴다(통과만 보면 검사가 죽어도 모른다).
  if (expectFail) {
    if (hits.length === 0) {
      console.log("FAIL — 노출을 기대했는데 0건이다. 검사가 죽었을 수 있다.");
      process.exitCode = 1;
      return;
    }
    console.log("PASS — 검사가 노출을 실제로 잡았다(--expect-fail).");
    return;
  }
  if (hits.length > 0) process.exitCode = 1;
  else console.log("PASS — 표제 용어 노출 0건.");
}

if (process.argv[1] && /check-term-exposure\.(ts|js)$/.test(process.argv[1])) main();
