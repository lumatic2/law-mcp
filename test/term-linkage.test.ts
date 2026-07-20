import assert from "node:assert/strict";
import test from "node:test";
import {
  TermLinkageCache,
  extractLinkage,
  lookupTermLinkage,
  pickExactTermMst,
} from "../src/term-linkage.js";

// fixture 는 2026-07-21 실 API 응답에서 잘라온 것이다(조문내용만 축약).
const SEARCH_MYEONGYE = {
  lstrmAISearch: {
    검색결과개수: "2",
    키워드: "명예훼손",
    법령용어: [
      {
        id: "1",
        법령용어명: "명예훼손",
        동음이의어존재여부: "N",
        조문간관계링크: "/DRF/lawService.do?OC=8307&target=lstrmRltJo&type=XML&MST=473573",
      },
      {
        id: "2",
        법령용어명: "명예훼손분쟁조정부",
        조문간관계링크: "/DRF/lawService.do?OC=8307&target=lstrmRltJo&type=XML&MST=1319349",
      },
    ],
  },
};

const LINKED_BUDANG = {
  lstrmRltJoService: {
    법령용어: {
      연계법령: [
        { id: "1", 법령명: "근로기준법", 조번호: "0023", 조가지번호: "00", 용어구분: "선정용어", 조문내용: "..." },
        { id: "2", 법령명: "근로기준법", 조번호: "0028", 조가지번호: "00", 용어구분: "선정용어", 조문내용: "..." },
        { id: "3", 법령명: "근로기준법 시행령", 조번호: "0011", 조가지번호: "00", 용어구분: "선정용어", 조문내용: "..." },
        // 중복 행 — upstream 이 같은 조문을 두 번 주는 경우가 있다.
        { id: "4", 법령명: "근로기준법", 조번호: "0023", 조가지번호: "00", 용어구분: "선정용어", 조문내용: "..." },
      ],
    },
  },
};

test("pickExactTermMst takes only the exactly matching term", () => {
  assert.equal(pickExactTermMst(SEARCH_MYEONGYE, "명예훼손"), "473573");
  // 공백·구두점 차이는 흡수한다.
  assert.equal(pickExactTermMst(SEARCH_MYEONGYE, " 명예 훼손 "), "473573");
});

// 부분일치를 받으면 "명예훼손" 질의가 "명예훼손분쟁조정부" 로 새어나간다 —
// verify_citation 이 폴백 법령을 받아 거짓 ok 를 냈던 것과 같은 실패 유형이다.
test("pickExactTermMst refuses a prefix-only match", () => {
  const onlyLonger = {
    lstrmAISearch: {
      법령용어: [{ 법령용어명: "명예훼손분쟁조정부", 조문간관계링크: "...MST=1319349" }],
    },
  };
  assert.equal(pickExactTermMst(onlyLonger, "명예훼손"), null);
});

test("pickExactTermMst returns null on a zero-result response", () => {
  const zero = { lstrmAISearch: { 검색결과개수: "0", 키워드: "존재하지않는용어xyz" } };
  assert.equal(pickExactTermMst(zero, "존재하지않는용어xyz"), null);
  for (const root of [null, undefined, {}, "", 42]) {
    assert.equal(pickExactTermMst(root, "아무거나"), null);
  }
});

test("extractLinkage groups articles by law, dedupes, and ranks by link count", () => {
  const linkage = extractLinkage(LINKED_BUDANG, "부당해고");

  assert.equal(linkage.term, "부당해고");
  assert.equal(linkage.laws.length, 2);

  const [first, second] = linkage.laws;
  assert.equal(first.lawName, "근로기준법", "연계 조문이 많은 법령이 앞");
  assert.equal(first.linkCount, 2, "중복 제23조는 1건으로 접힌다");
  assert.deepEqual(first.articles.map((a) => a.display), ["제23조", "제28조"]);
  assert.equal(second.lawName, "근로기준법 시행령");
});

test("extractLinkage renders 가지번호 as 제N조의M", () => {
  const root = {
    lstrmRltJoService: {
      법령용어: { 연계법령: { 법령명: "민법", 조번호: "0839", 조가지번호: "02", 용어구분: "선정용어" } },
    },
  };
  const linkage = extractLinkage(root, "재산분할청구권");
  assert.equal(linkage.laws[0].articles[0].display, "제839조의2");
  assert.equal(linkage.totalLinks, 1, "연계 1건 — 호출자는 이 낮은 값을 신뢰도 신호로 쓴다");
});

test("extractLinkage returns an empty linkage for malformed or empty responses", () => {
  for (const root of [null, undefined, {}, { lstrmRltJoService: {} }, { lstrmRltJoService: { 법령용어: {} } }]) {
    const linkage = extractLinkage(root, "x");
    assert.equal(linkage.totalLinks, 0);
    assert.deepEqual(linkage.laws, []);
  }
});

// --- lookupTermLinkage: 실패해도 기존 경로를 죽이지 않는다 -----------------------

function fetcherOf(search: unknown, linked: unknown) {
  const calls = { search: 0, linked: 0 };
  return {
    calls,
    fetcher: {
      searchTerm: async () => { calls.search += 1; return search; },
      fetchLinkedArticles: async () => { calls.linked += 1; return linked; },
    },
  };
}

test("lookupTermLinkage resolves term -> law -> articles in two calls", async () => {
  const { calls, fetcher } = fetcherOf(
    { lstrmAISearch: { 법령용어: { 법령용어명: "부당해고", 조문간관계링크: "...MST=1" } } },
    LINKED_BUDANG,
  );

  const linkage = await lookupTermLinkage("부당해고", fetcher);
  assert.equal(linkage.laws[0].lawName, "근로기준법");
  assert.deepEqual(calls, { search: 1, linked: 1 }, "비용 예산: 검색 1회당 추가 호출 ≤2");
});

// Failure probe: 용어 0건이면 두 번째 호출을 아예 하지 않는다.
test("lookupTermLinkage skips the article call when the term does not exist", async () => {
  const { calls, fetcher } = fetcherOf({ lstrmAISearch: { 검색결과개수: "0" } }, LINKED_BUDANG);

  const linkage = await lookupTermLinkage("없는용어", fetcher);
  assert.equal(linkage.totalLinks, 0);
  assert.equal(calls.linked, 0, "불필요한 upstream 왕복 없음");
});

// Failure probe: 어느 단계가 던져도 빈 결과일 뿐, 예외가 새어나가지 않는다.
test("lookupTermLinkage swallows upstream failures and yields an empty linkage", async () => {
  const throwing = {
    searchTerm: async () => { throw new Error("HTTP 503"); },
    fetchLinkedArticles: async () => ({}),
  };
  const linkage = await lookupTermLinkage("부당해고", throwing);
  assert.equal(linkage.totalLinks, 0);
  assert.deepEqual(linkage.laws, []);

  const halfThrowing = {
    searchTerm: async () => ({ lstrmAISearch: { 법령용어: { 법령용어명: "부당해고", 조문간관계링크: "...MST=1" } } }),
    fetchLinkedArticles: async () => { throw new Error("timeout"); },
  };
  assert.equal((await lookupTermLinkage("부당해고", halfThrowing)).totalLinks, 0);
});

test("lookupTermLinkage serves repeat lookups from cache without extra upstream calls", async () => {
  const cache = new TermLinkageCache(10);
  const { calls, fetcher } = fetcherOf(
    { lstrmAISearch: { 법령용어: { 법령용어명: "부당해고", 조문간관계링크: "...MST=1" } } },
    LINKED_BUDANG,
  );

  await lookupTermLinkage("부당해고", fetcher, cache);
  await lookupTermLinkage("부당해고", fetcher, cache);
  await lookupTermLinkage(" 부당해고 ", fetcher, cache);

  assert.deepEqual(calls, { search: 1, linked: 1 }, "2·3회차는 캐시 히트 — 추가 호출 0");
});

// 빈 결과도 캐시한다 — 0건 용어를 매번 다시 묻지 않기 위함.
test("lookupTermLinkage caches misses too", async () => {
  const cache = new TermLinkageCache(10);
  const { calls, fetcher } = fetcherOf({ lstrmAISearch: { 검색결과개수: "0" } }, {});

  await lookupTermLinkage("없는용어", fetcher, cache);
  await lookupTermLinkage("없는용어", fetcher, cache);
  assert.equal(calls.search, 1);
});

test("TermLinkageCache evicts the least recently used entry", () => {
  const cache = new TermLinkageCache(2);
  const make = (term: string) => ({ term, totalLinks: 1, laws: [] });

  cache.set("a", make("a"));
  cache.set("b", make("b"));
  cache.get("a");                  // a 를 최근 사용으로 올린다
  cache.set("c", make("c"));       // 가장 오래된 b 가 밀려난다

  assert.ok(cache.get("a"));
  assert.equal(cache.get("b"), undefined);
  assert.ok(cache.get("c"));
  assert.equal(cache.size, 2);
});

// 연계 행의 `조문연계용어링크` 에 법령ID가 들어 있어 **추가 호출 없이** 법령ID를 얻는다.
// 이게 없으면 법령명을 다시 검색해야 해서 비용 예산(추가 호출 ≤2)을 넘긴다.
test("extractLinkage harvests the law id from the row link without extra calls", () => {
  const root = {
    lstrmRltJoService: {
      법령용어: {
        연계법령: [
          {
            법령명: "정보통신망 이용촉진 및 정보보호 등에 관한 법률",
            조번호: "0044", 조가지번호: "00", 용어구분: "선정용어",
            조문연계용어링크: "/DRF/lawService.do?OC=test&target=joRltLstrm&type=XML&ID=000030&JO=004400",
          },
        ],
      },
    },
  };

  const linkage = extractLinkage(root, "명예훼손");
  assert.equal(linkage.laws[0].lawId, "000030");
  assert.equal(linkage.laws[0].articles[0].lawId, "000030");
  assert.equal(linkage.laws[0].articles[0].display, "제44조");
});

test("extractLinkage tolerates rows without a usable link", () => {
  const root = {
    lstrmRltJoService: { 법령용어: { 연계법령: { 법령명: "민법", 조번호: "0839", 조가지번호: "02" } } },
  };
  assert.equal(extractLinkage(root, "재산분할청구권").laws[0].lawId, null);
});
