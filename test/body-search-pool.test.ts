import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const provider = readFileSync(new URL("../src/providers/lawgo-provider.ts", import.meta.url), "utf8");
const adapter = readFileSync(new URL("../src/providers/source-adapter.ts", import.meta.url), "utf8");

/** `fetchLawSearchOnce` 본문만 떼어 본다 — 풀 도달 규약은 전부 이 안에 있다. */
const fetchOnce = (() => {
  const start = provider.indexOf("private async fetchLawSearchOnce");
  assert.ok(start > 0, "fetchLawSearchOnce 를 찾지 못했다");
  return provider.slice(start, provider.indexOf("\n  async searchLaw", start));
})();

describe("후보 풀 도달 (TV4 step-2)", () => {
  it("되돌림 지점이 상수다", () => {
    assert.match(provider, /const BODY_POOL_PAGE_SIZE = \d+;/);
    assert.match(provider, /const BODY_POOL_MAX_PAGES = \d+;/);
  });

  it("기본은 풀을 넓히지 않는다 — 채택 문턱을 못 넘겼다", () => {
    // TV4 step-3 판정: 풀을 넓혀도 recall@3 이 안 움직였다(순 이득 0). 규약상 미채택이므로
    // 기본값은 TV3 그대로여야 한다. 이 값이 조용히 올라가면 검증 안 된 변경이 출하된다.
    assert.match(provider, /const BODY_POOL_DEFAULT_PAGES = 1;/);
    assert.match(fetchOnce, /maxPages: number = BODY_POOL_DEFAULT_PAGES/);
  });

  it("넓히지 않을 때는 요청 크기까지 TV3 그대로다", () => {
    // 페이지 크기만 키워도 그건 이미 검증 안 된 풀 변경이다.
    assert.match(fetchOnce, /display: isBodySearch && maxPages > 1 \? BODY_POOL_PAGE_SIZE : display/);
  });

  it("본문검색일 때만 풀을 넓힌다 — 이름검색 비용은 그대로다", () => {
    assert.match(fetchOnce, /const isBodySearch = searchMode === 2;/);
    assert.match(fetchOnce, /if \(isBodySearch && [\s\S]{0,80}totalCount > lawRows\.length\)/);
  });

  it("추가 페이지를 병렬로 받는다 — 순차면 지연이 페이지 수만큼 늘어난다", () => {
    assert.match(fetchOnce, /await Promise\.all\(/);
  });

  it("페이지 상한을 넘겨 받지 않는다", () => {
    assert.match(fetchOnce, /Math\.max\(1, Math\.min\(maxPages, BODY_POOL_MAX_PAGES\)\)/);
  });

  it("풀 깊이를 호출부에서 켤 수 있다 — A/B 와 되돌림이 같은 지점을 쓴다", () => {
    assert.match(provider, /bodyPool\?: \{ maxPages\?: number \}/);
    assert.match(provider, /this\.fetchLawSearchOnce\(q, limit, display, mode, options\.bodyPool\?\.maxPages\)/);
  });

  it("한 페이지가 실패해도 검색이 죽지 않는다", () => {
    assert.match(fetchOnce, /fetchPage\(index \+ 2\)\.catch\(\(\) => null\)/);
  });
});

describe("절단 경고 — 조용한 절단이 이 결함의 원인이었다", () => {
  it("전체 건수가 받은 건수보다 많으면 경고를 만든다", () => {
    assert.match(fetchOnce, /if \(totalCount > lawRows\.length\) \{[\s\S]{0,400}poolWarnings\.push\(/);
  });

  it("경고에 전체 건수와 확인한 건수가 함께 들어간다", () => {
    // 숫자 없이 "일부만 봤다"고만 하면 소비 LLM 이 규모를 판단할 수 없다.
    const warning = fetchOnce.slice(fetchOnce.indexOf("poolWarnings.push("));
    assert.match(warning, /\$\{totalCount\}/);
    assert.match(warning, /\$\{lawRows\.length\}/);
  });

  it("절단이 없으면 경고를 달지 않는다", () => {
    assert.match(fetchOnce, /\.\.\.\(poolWarnings\.length \? \{ warnings: poolWarnings \} : \{\}\)/);
  });

  it("사다리가 채택한 단계의 경고를 실어 보낸다", () => {
    // 경고를 만들어도 사다리가 안 실어 주면 사용자에게 도달하지 않는다.
    assert.match(adapter, /warnings\?: string\[\];/);
    const ladder = adapter.slice(adapter.indexOf("export async function searchWithLadder"));
    assert.match(ladder, /\.\.\.\(bodySearch\.warnings \?\? \[\]\)/);
  });
});
