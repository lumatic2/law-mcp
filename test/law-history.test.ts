import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * TV3 step-3 — 연혁 목록의 계약 테스트.
 *
 * 잠그는 것: ① 연혁 경로가 `eflaw` 에서 벗어나지 않는다(다른 target 은 전부 죽어 있다)
 * ② **기본 꺼짐** — 시점을 안 묻는 검색에 호출 비용을 얹지 않는다
 * ③ 연혁 조회 실패가 검색 실패가 되지 않는다
 */

const provider = readFileSync(new URL("../src/providers/lawgo-provider.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");

test("연혁은 eflaw 검색으로만 받는다 — 다른 경로는 죽어 있다", () => {
  assert.match(provider, /target: EFFECTIVE_LAW_TARGET/, "fetchLawVersions 가 eflaw 를 쓴다");
  for (const dead of ["lsHistory", "lsHstInf", "eflawJo"]) {
    assert.ok(!new RegExp(`target:\s*"${dead}"`).test(provider), `${dead} 는 빈 응답/HTML 이다`);
  }
});

test("연혁 출하는 기본 꺼짐이다 — 검색 비용을 얹지 않는다", () => {
  assert.match(index, /include_history: z\s*\n?\s*\.boolean\(\)\s*\n?\s*\.default\(false\)/,
    "MCP 스키마 기본값이 false");
  assert.match(provider, /options\.includeHistory \? this\.attachHistory\(promoted\) : promoted/,
    "켰을 때만 붙는다");
});

test("연혁 조회 실패가 검색을 죽이지 않는다", () => {
  const fn = provider.slice(provider.indexOf("private async attachHistory"));
  assert.match(fn.slice(0, 1400), /catch \{[\s\S]{0,120}return base;/, "실패 시 base 를 그대로 돌려준다");
  assert.match(fn.slice(0, 600), /if \(versions\.length === 0\) return base;/, "0건도 무해");
});

test("연혁은 1위 항목에만 붙는다 — 전 항목에 붙이면 호출이 폭발한다", () => {
  const fn = provider.slice(provider.indexOf("private async attachHistory"));
  assert.match(fn.slice(0, 900), /const top = base\.items\[0\]/);
  assert.match(fn.slice(0, 900), /items\[0\] = \{/);
});

test("시행예정/현행/연혁이 섞여 온다는 사실을 타입과 경고가 알린다", () => {
  assert.match(types, /현행연혁코드/, "필드가 타입에 있다");
  assert.match(types, /아직 시행되지 않은 법을 현행으로 오해/, "왜 봐야 하는지 적혀 있다");
  assert.match(provider, /시행예정\/현행\/연혁이 섞여 있으니/, "경고로도 알린다");
});
