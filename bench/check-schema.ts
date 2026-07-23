/**
 * 골든셋 스키마 완전성 검사 (LB1 step-1 Verify + Failure probe).
 * 사용: npx tsx bench/check-schema.ts [path]  (기본 bench/golden.json)
 * 라벨 근거(source) 누락·빈 expected_laws 를 실패로 잡는다 — 추정 라벨 방지 장치.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED = ["query", "domain", "expected_laws", "split", "source"] as const;
/**
 * 코퍼스(TF1)는 형식 중립이라 `query` 를 필수로 걸 수 없다 — agentic 출신 레코드는 `context` 만
 * 갖고 들어온다. 대신 **둘 중 최소 하나**를 요구하고, 케이스를 잇는 `topic_id`·출처를 밝히는
 * `provenance` 를 필수로 건다. 라벨 근거(`source`)는 agentic 출신에 없으므로 필수에서 뺀다.
 */
const CORPUS_REQUIRED = ["case_id", "provenance", "topic_id", "domain", "split"] as const;
const VALID_SPLITS = new Set(["dev", "holdout"]);

const path = resolve(process.argv[2] ?? "bench/golden.json");
const data = JSON.parse(readFileSync(path, "utf8")) as { items?: unknown };
const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : null;
const isCorpus = Boolean(items?.length && "topic_id" in items[0]);

const errors: string[] = [];
function emptyValue(value: unknown): boolean {
  return value == null
    || (typeof value === "string" && !value.trim())
    || (Array.isArray(value) && value.length === 0);
}

if (!items) {
  errors.push("items 배열이 없다");
} else {
  const seenIds = new Set<string>();
  items.forEach((item, i) => {
    const label = `item[${i}] ${String(item.case_id ?? item.query ?? "(식별자 없음)")}`;
    for (const key of isCorpus ? CORPUS_REQUIRED : REQUIRED) {
      if (emptyValue(item[key])) errors.push(`${label}: '${key}' 누락/빈 값`);
    }
    if (typeof item.split === "string" && !VALID_SPLITS.has(item.split)) {
      errors.push(`${label}: split='${item.split}' 은 dev|holdout 이 아님`);
    }
    if (isCorpus) {
      if (emptyValue(item.query) && emptyValue(item.context)) {
        errors.push(`${label}: query 와 context 가 둘 다 없다 — 최소 하나는 있어야 한다`);
      }
      // 기권 케이스가 아닌데 정답 조문이 없으면 채점이 불가능하다.
      if (!item.expect_abstain && emptyValue(item.expected_article)) {
        errors.push(`${label}: 기권 케이스가 아닌데 'expected_article' 이 없다`);
      }
      const id = String(item.case_id);
      if (seenIds.has(id)) errors.push(`${label}: case_id 중복`);
      seenIds.add(id);
    }
  });
}

if (items && errors.length === 0) {
  const bySplit = new Map<string, number>();
  const byDomain = new Map<string, number>();
  for (const item of items) {
    bySplit.set(String(item.split), (bySplit.get(String(item.split)) ?? 0) + 1);
    byDomain.set(String(item.domain), (byDomain.get(String(item.domain)) ?? 0) + 1);
  }
  const withArticle = items.filter((i) => i.expected_article).length;
  console.log(`schema: PASS (${path})`);
  console.log(`  총 ${items.length}건 | split: ${[...bySplit].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`  도메인: ${[...byDomain].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`  조문 라벨 보유: ${withArticle}건`);
  if (isCorpus) {
    const topics = new Set(items.map((i) => String(i.topic_id)));
    const q = items.filter((i) => i.query).length;
    const c = items.filter((i) => i.context).length;
    console.log(`  distinct topic: ${topics.size}개`);
    console.log(`  query 보유 ${q}건 · context 보유 ${c}건 · 양쪽 보유 ${items.filter((i) => i.query && i.context).length}건`);
  }
} else {
  console.log(`schema: FAIL (${path})`);
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exitCode = 1;
}
