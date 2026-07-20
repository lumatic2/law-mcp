/**
 * 골든셋 스키마 완전성 검사 (LB1 step-1 Verify + Failure probe).
 * 사용: npx tsx bench/check-schema.ts [path]  (기본 bench/golden.json)
 * 라벨 근거(source) 누락·빈 expected_laws 를 실패로 잡는다 — 추정 라벨 방지 장치.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED = ["query", "domain", "expected_laws", "split", "source"] as const;
const VALID_SPLITS = new Set(["dev", "holdout"]);

const path = resolve(process.argv[2] ?? "bench/golden.json");
const data = JSON.parse(readFileSync(path, "utf8")) as { items?: unknown };
const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : null;

const errors: string[] = [];
if (!items) {
  errors.push("items 배열이 없다");
} else {
  items.forEach((item, i) => {
    const label = `item[${i}] ${String(item.query ?? "(query 없음)")}`;
    for (const key of REQUIRED) {
      const value = item[key];
      const empty = value == null
        || (typeof value === "string" && !value.trim())
        || (Array.isArray(value) && value.length === 0);
      if (empty) errors.push(`${label}: '${key}' 누락/빈 값`);
    }
    if (typeof item.split === "string" && !VALID_SPLITS.has(item.split)) {
      errors.push(`${label}: split='${item.split}' 은 dev|holdout 이 아님`);
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
} else {
  console.log(`schema: FAIL (${path})`);
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exitCode = 1;
}
