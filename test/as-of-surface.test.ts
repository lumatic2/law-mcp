import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * TV3 step-2 — 시점 인자가 표면에 붙은 뒤의 회귀 계약.
 *
 * 실 API 동작은 프로브로 관측했고(changeset README), 여기서는 **되돌아가면 안 되는 것**을 잠근다:
 *   ① 시점 조회가 `law` 타깃으로 새지 않는다(그 타깃은 efYd 를 조용히 무시한다)
 *   ② 시점 인자는 **선택**이다 — 기존 호출이 깨지면 안 된다
 *   ③ 못 맞추면 현행으로 **대체하지 않는다**
 */

const provider = readFileSync(new URL("../src/providers/lawgo-provider.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

test("시점 조회는 eflaw 타깃으로만 간다", () => {
  assert.match(
    provider,
    /const target = efYd \? EFFECTIVE_LAW_TARGET : "law";/,
    "efYd 가 있으면 eflaw, 없으면 law",
  );
  assert.match(provider, /if \(efYd\) assertEffectiveDateTarget\(target\);/, "실제 쓰는 타깃을 검사한다");
  // "law" 를 하드코딩하면 시점 조회가 항상 던진다 — 실제로 한 번 그 실수를 했다.
  assert.ok(
    !/assertEffectiveDateTarget\("law"\)/.test(provider),
    'assertEffectiveDateTarget("law") 하드코딩은 시점 조회를 전부 막는다',
  );
});

test("as_of 는 선택 인자다 — 기존 호출이 깨지지 않는다", () => {
  assert.match(provider, /options: \{ asOf\?: string \} = \{\}/, "기본값이 있어야 한다");
  assert.match(index, /as_of: z\s*\n?\s*\.string\(\)[\s\S]{0,80}\.optional\(\)/, "MCP 스키마에서도 optional");
});

test("해석 불가·판 없음은 현행으로 대체하지 않고 거절한다", () => {
  assert.match(provider, /해석할 수 없는 시점에 현행 법령을 대신 주지 않는다/);
  assert.match(provider, /현행 법령을 대신 주지 않는다 — 잘못된 연도의 조문은 오답이다/);
  assert.match(provider, /code: "LAW_VERSION_NOT_FOUND"/);
});

test("시점 미지정 경로에도 시행일자를 싣는다 — 상시 출하", () => {
  assert.match(provider, /private withEffectiveDate\(/);
  // 폴백 경로(MST)에도 붙어야 한다. 한쪽만 붙으면 응답이 들쭉날쭉해진다.
  const calls = provider.match(/this\.withEffectiveDate\(/g) ?? [];
  assert.ok(calls.length >= 2, `withEffectiveDate 호출이 ${calls.length}곳 — ID·MST 두 경로 모두 필요`);
});

test("도구 설명이 시점 축과 실패 방식을 알린다", () => {
  assert.match(index, /effective_date/, "상시 출하 필드를 설명한다");
  assert.match(index, /as_of_rule/, "해석 규칙을 설명한다");
  assert.match(index, /FAILS rather than\s*"?\s*\+?\s*"?silently returning the current version/,
    "조용한 현행 반환을 하지 않는다고 명시");
});
