import assert from "node:assert/strict";
import test from "node:test";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

/**
 * UD2 step-2 — `aiSearch` 후보 병합 계약 테스트.
 *
 * 이 모듈의 위험은 **조용한 순위 오염**이다. LB5 가 부스트를 넣으면서 이름 조회 경로까지 흔들어
 * `get_law_article` 이 다른 법의 조문을 반환했다(UD0). 그래서 여기서 고정하는 것은 두 가지다:
 *   ① 신호가 없으면 **아무것도 바꾸지 않는다**(같은 객체를 그대로 돌려준다)
 *   ② `aiSearch` 가 죽어도 검색은 **기존 사다리 결과와 동일**하다 — 진짜 폴백인지
 */

const AI_RESPONSE = {
  aiSearch: {
    검색결과개수: "2",
    법령조문: [
      { id: "1", 법령명: "근로기준법", 법령ID: "001766", 조문번호: "0028", 조문가지번호: "00", 조문제목: "부당해고등의 구제신청", 조문내용: "..." },
      { id: "2", 법령명: "노동위원회법", 법령ID: "002000", 조문번호: "0002", 조문가지번호: "00", 조문제목: "설치", 조문내용: "..." },
    ],
  },
};

/** 법령명 검색 응답(사다리 1단)을 흉내 낸다 — aiSearch 와 겹치지 않는 법을 준다. */
function lawSearchResponse(names: string[]) {
  return {
    LawSearch: {
      law: names.map((name, index) => ({
        법령명한글: name,
        법령ID: `9${index}0000`,
        법령MST: `9${index}0000`,
      })),
    },
  };
}

/** axios 를 타지 않는 provider — 사다리 응답과 aiSearch 응답을 모두 주입한다. */
function makeProvider(names: string[], aiFetcher: (query: string, display: number) => Promise<unknown>) {
  const provider = new LawGoProvider(
    // 용어 연계는 이 테스트의 대상이 아니다 — 항상 빈 신호로 둬서 부스트를 재운다.
    { searchTerm: async () => ({}), fetchLinkedArticles: async () => ({}) },
    async () => ({}),
    aiFetcher,
  );
  // 사다리의 upstream 호출만 대체한다 (private 이지만 계약 테스트라 의도적으로 바꾼다).
  (provider as unknown as { fetchLawSearchOnce: unknown }).fetchLawSearchOnce = async (
    _query: string,
    limit: number,
  ) => {
    const rows = lawSearchResponse(names).LawSearch.law.slice(0, limit);
    return {
      items: rows.map((row) => ({
        law_id: row.법령ID,
        law_name: row.법령명한글,
        law_mst: row.법령MST,
        effective_date: null,
        match_type: "contains" as const,
      })),
      total: rows.length,
    };
  };
  return provider;
}

test("aiSearch 가 지목한 법령을 상위로 올린다", async () => {
  const provider = makeProvider(["상법", "국회법", "도로법"], async () => AI_RESPONSE);

  const result = await provider.searchLaw("부당해고 구제신청", { limit: 3, aiSearch: { enabled: true } });

  assert.deepEqual(result.items.map((item) => item.law_name), ["근로기준법", "노동위원회법", "상법"]);
  assert.match(result.warnings?.join(" ") ?? "", /aiSearch/);
});

test("기존 결과에 이미 있는 법령은 중복되지 않고 앞으로만 온다", async () => {
  const provider = makeProvider(["상법", "근로기준법"], async () => AI_RESPONSE);

  const result = await provider.searchLaw("부당해고 구제신청", { limit: 5, aiSearch: { enabled: true } });
  const names = result.items.map((item) => item.law_name);

  assert.equal(names.filter((name) => name === "근로기준법").length, 1, "중복 금지");
  assert.equal(names[0], "근로기준법");
  // 기존 항목의 정보(법령MST 등)를 잃지 않는다 — aiSearch 표제로 덮어쓰면 하류 조회가 깨진다.
  assert.equal(result.items[0].law_mst, "910000");
});

// 채택 판정(2026-07-21 교차 A/B: 이득 8 · 손실 0)을 통과해 기본으로 켰다.
test("주제 검색의 기본 경로는 aiSearch 를 탄다", async () => {
  const provider = makeProvider(["상법", "국회법"], async () => AI_RESPONSE);

  const result = await provider.searchLaw("부당해고 구제신청", { limit: 3 });

  assert.deepEqual(result.items.map((item) => item.law_name), ["근로기준법", "노동위원회법", "상법"]);
});

test("명시적으로 끄면 upstream 을 때리지 않는다", async () => {
  let calls = 0;
  const provider = makeProvider(["상법", "국회법"], async () => {
    calls += 1;
    return AI_RESPONSE;
  });

  const result = await provider.searchLaw("부당해고 구제신청", { limit: 3, aiSearch: { enabled: false } });

  assert.deepEqual(result.items.map((item) => item.law_name), ["상법", "국회법"]);
  assert.equal(calls, 0, "끈 채널이 upstream 을 때리면 안 된다");
});

// ── Failure probe: 폴백이 진짜 폴백인가 ──

test("aiSearch 가 죽어도 검색 결과는 기존과 동일하다", async () => {
  const dead = makeProvider(["상법", "국회법"], async () => {
    throw new Error("aiSearch HTTP 503");
  });
  const control = makeProvider(["상법", "국회법"], async () => ({}));

  const degraded = await dead.searchLaw("부당해고 구제신청", { limit: 3, aiSearch: { enabled: true } });
  const baseline = await control.searchLaw("부당해고 구제신청", { limit: 3 });

  assert.deepEqual(degraded, baseline, "장애 시 LB5 동작과 바이트 단위로 같아야 한다");
});

test("빈 응답·스키마 변경에도 순위를 건드리지 않는다", async () => {
  for (const broken of [{}, { aiSearch: {} }, { other: 1 }, null, "문자열"]) {
    const provider = makeProvider(["상법", "국회법"], async () => broken);
    const result = await provider.searchLaw("부당해고 구제신청", { limit: 3, aiSearch: { enabled: true } });

    assert.deepEqual(result.items.map((item) => item.law_name), ["상법", "국회법"]);
    assert.deepEqual(result.warnings ?? [], [], "신호가 없으면 경고도 붙이지 않는다");
  }
});

test("법령ID 가 없고 기존 결과에도 없으면 싣지 않는다", async () => {
  const provider = makeProvider(["상법"], async () => ({
    aiSearch: { 법령조문: [{ id: "1", 법령명: "유령법", 조문번호: "0001" }] },
  }));

  const result = await provider.searchLaw("아무거나", { limit: 3, aiSearch: { enabled: true } });

  assert.deepEqual(result.items.map((item) => item.law_name), ["상법"], "ID 없는 항목은 하류가 못 쓴다");
});

// 비용 예산: 검색 1회당 추가 upstream 호출 ≤1
test("같은 질의를 반복해도 aiSearch 는 한 번만 부른다", async () => {
  let calls = 0;
  const provider = makeProvider(["상법"], async () => {
    calls += 1;
    return AI_RESPONSE;
  });

  await provider.searchLaw("부당해고 구제신청", { limit: 3, aiSearch: { enabled: true } });
  await provider.searchLaw("부당해고 구제신청", { limit: 3, aiSearch: { enabled: true } });

  assert.equal(calls, 1);
});

// UD0 회귀 — 순위를 바꾸는 변경은 그 순위를 입력으로 쓰는 도구까지 회귀 범위다.
test("법령명 조회 경로(resolveLawId)는 aiSearch 를 타지 않는다", async () => {
  let calls = 0;
  const provider = makeProvider(["민법"], async () => {
    calls += 1;
    return AI_RESPONSE;
  });

  await provider.searchLaw("민법", { limit: 10, termBoost: { enabled: false }, aiSearch: { enabled: false } });

  assert.equal(calls, 0);
});
