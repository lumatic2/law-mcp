import assert from "node:assert/strict";
import test from "node:test";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

/**
 * 용어 연계 부스트(LB5 step-2)의 계약 테스트.
 *
 * 실 API 를 타지 않도록 법령 검색 응답과 용어 연계 응답을 모두 주입한다.
 * 핵심 계약: **신호가 있을 때만 순서를 바꾸고, 없으면 손대지 않는다.**
 */

const LAW_SEARCH_RESPONSE = {
  LawSearch: {
    totalCnt: "3",
    law: [
      { 법령ID: "111", 법령명한글: "예금자보호법" },
      { 법령ID: "222", 법령명한글: "방송법 시행규칙" },
      { 법령ID: "333", 법령명한글: "관세법" },
    ],
  },
};

function providerWithLinkage(linkedLaws: Array<{ name: string; id: string; articles: string[] }>) {
  const searchTerm = async () => ({
    lstrmAISearch: { 법령용어: { 법령용어명: "부당해고", 조문간관계링크: "...MST=1" } },
  });
  const fetchLinkedArticles = async () => ({
    lstrmRltJoService: {
      법령용어: {
        연계법령: linkedLaws.flatMap((law) =>
          law.articles.map((article) => ({
            법령명: law.name,
            조번호: article.padStart(4, "0"),
            조가지번호: "00",
            용어구분: "선정용어",
            조문연계용어링크: `/DRF/lawService.do?target=joRltLstrm&ID=${law.id}&JO=${article.padStart(4, "0")}00`,
          })),
        ),
      },
    },
  });

  // aiSearch 는 빈 신호로 고정한다 — 이 파일이 재는 것은 **부스트 단독** 동작이고,
  // 주입하지 않으면 기본으로 켜진 aiSearch 가 실 API 를 탄다(UD2 step-2 에서 실제로 샜다).
  const provider = new LawGoProvider({ searchTerm, fetchLinkedArticles }, undefined, async () => ({}));
  // 법령 검색은 실 API 를 타지 않도록 대체한다.
  (provider as unknown as Record<string, unknown>).fetchLawSearchOnce = async () => ({
    items: LAW_SEARCH_RESPONSE.LawSearch.law.map((row) => ({
      law_id: row.법령ID,
      law_name: row.법령명한글,
      match_type: "contains" as const,
    })),
    total: 3,
  });
  return provider;
}

test("term boost lifts the linked law above the alphabetical noise", async () => {
  const provider = providerWithLinkage([{ name: "근로기준법", id: "999", articles: ["23", "28"] }]);

  const result = await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });

  assert.equal(result.items[0].law_name, "근로기준법", "연계 법령이 1위");
  assert.equal(result.items[0].law_id, "999", "연계가 준 법령ID 를 그대로 쓴다(추가 호출 없음)");
  assert.equal(result.items.length, 3, "limit 준수");
  assert.ok(
    (result.warnings ?? []).some((warning) => warning.includes("법령용어 연계")),
    "부스트가 개입한 사실을 경고로 밝힌다",
  );
});

// 무신호 시 순서 보존 — ib3 에서 신호 없이 재정렬했다가 법인세법이 1위→5위로 밀린 실패의 교훈.
test("term boost leaves results untouched when the term has no linkage", async () => {
  const provider = providerWithLinkage([]);

  const boosted = await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });
  const off = await provider.searchLaw("부당해고 구제신청 기간", {
    limit: 3,
    termBoost: { enabled: false },
  });

  assert.deepEqual(boosted.items, off.items, "연계가 비면 결과가 완전히 동일");
  assert.deepEqual(boosted.warnings ?? [], off.warnings ?? []);
});

test("term boost can be switched off entirely", async () => {
  const provider = providerWithLinkage([{ name: "근로기준법", id: "999", articles: ["23"] }]);

  const off = await provider.searchLaw("부당해고 구제신청 기간", {
    limit: 3,
    termBoost: { enabled: false },
  });

  assert.equal(off.items[0].law_name, "예금자보호법", "부스트 없이는 기존 순서 그대로");
});

// 이미 결과에 있는 법령은 중복 추가하지 않고 끌어올리기만 한다.
test("term boost promotes an existing result instead of duplicating it", async () => {
  const provider = providerWithLinkage([{ name: "관세법", id: "333", articles: ["1", "2"] }]);

  const result = await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });

  assert.equal(result.items[0].law_name, "관세법");
  assert.equal(result.items.filter((item) => item.law_name === "관세법").length, 1, "중복 없음");
});

test("term boost respects the minLinks threshold", async () => {
  const provider = providerWithLinkage([{ name: "근로기준법", id: "999", articles: ["23"] }]);

  const result = await provider.searchLaw("부당해고 구제신청 기간", {
    limit: 3,
    termBoost: { minLinks: 2 },
  });

  assert.equal(result.items[0].law_name, "예금자보호법", "연계 1건짜리는 문턱에 걸려 무시된다");
});

// Failure probe: 용어 연계가 통째로 죽어도 검색은 살아 있어야 한다(보조 채널 원칙).
test("term boost failure never breaks the search itself", async () => {
  const provider = new LawGoProvider(
    {
      searchTerm: async () => { throw new Error("HTTP 503"); },
      fetchLinkedArticles: async () => { throw new Error("HTTP 503"); },
    },
    undefined,
    async () => ({}),
  );
  (provider as unknown as Record<string, unknown>).fetchLawSearchOnce = async () => ({
    items: [{ law_id: "111", law_name: "예금자보호법", match_type: "contains" as const }],
    total: 1,
  });

  const result = await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });
  assert.equal(result.items[0].law_name, "예금자보호법");
});

// 연계가 지목한 조문을 응답에 실어 보낸다 — 소비 LLM 이 "어느 법 몇 조"를 한 번에 받는다.
// (조문 *점수 재정렬* 은 LB5 step-3 에서 기각됐다. 이건 재정렬이 아니라 정보 전달이다.)
test("term boost ships the linked article numbers with the promoted law", async () => {
  const provider = providerWithLinkage([{ name: "근로기준법", id: "999", articles: ["23", "28"] }]);

  const result = await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });

  assert.deepEqual(result.items[0].linked_articles, ["제23조", "제28조"]);
  assert.equal(result.items[1].linked_articles, undefined, "연계 없는 항목은 필드를 달지 않는다");
});
