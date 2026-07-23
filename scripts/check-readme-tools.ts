/**
 * README 도구 표 ↔ 실제 등록 도구 대조 (TF3 step-1).
 *
 * **왜 있나**: README 는 도구 11개 중 4개만 적고 있었다. 문서가 뒤처지는 건 시간 문제라
 * 사람 눈으로 막을 수 없다 — 기계가 막는다. 등록 목록과 표가 다르면 exit 1.
 *
 * 사용: npx tsx scripts/check-readme-tools.ts
 */
import { readFileSync } from "node:fs";

const REGISTER = /server\.registerTool\(\s*\n\s*"([a-z_]+)"/g;

function registered(): string[] {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  return [...src.matchAll(REGISTER)].map((m) => m[1]);
}

function documented(): string[] {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  // 표의 첫 칸이 백틱으로 감싼 도구 이름인 행만 센다.
  return [...readme.matchAll(/^\|\s*`([a-z_]+)`\s*\|/gm)].map((m) => m[1]);
}

function main(): void {
  const inCode = registered();
  const inDocs = documented();
  const missing = inCode.filter((t) => !inDocs.includes(t));
  const extra = inDocs.filter((t) => !inCode.includes(t));

  console.log(`등록된 도구 ${inCode.length}종 · README 표 ${inDocs.length}행`);
  if (missing.length === 0 && extra.length === 0) {
    console.log("PASS — README 표와 등록 목록이 일치한다.");
    return;
  }
  if (missing.length) console.log(`FAIL — README 에 없는 도구: ${missing.join(", ")}`);
  if (extra.length) console.log(`FAIL — 등록되지 않았는데 README 에 있는 도구: ${extra.join(", ")}`);
  process.exit(1);
}

main();
