import assert from "node:assert/strict";
import test from "node:test";
import { AI_SEARCH_DISPLAY, AiSearchCache, extractAiSearch, lookupAiSearch } from "../src/ai-search.js";

/**
 * UD2 step-1 — `aiSearch` 클라이언트 계약 테스트.
 *
 * 두 가지를 잠근다:
 *   ① **키 핀 고정** — 컨테이너 `aiSearch`, 행 `법령조문`, 필드 `법령명/법령ID/조문번호/조문가지번호/
 *      조문제목/조문내용/id`. upstream 이 이걸 바꾸면 HTTP 200 인 채로 결과가 비므로 테스트가 감시한다.
 *   ② **예외 누출 금지** — 어떤 실패든 빈 결과. 이 채널 때문에 검색 자체가 죽으면 안 된다.
 *
 * 픽스처는 2026-07-21 실 응답("부당해고 구제신청 기간")을 줄인 것이다.
 */

const REAL_RESPONSE = {
  aiSearch: {
    검색결과개수: "3",
    키워드: "부당해고 구제신청 기간",
    target: "aiSearch",
    법령조문: [
      {
        조문번호: "0028",
        법령명: "근로기준법",
        법령ID: "001872",
        조문가지번호: "00",
        id: "1",
        조문제목: "부당해고등의 구제신청",
        조문내용: "제28조(부당해고등의 구제신청)① 사용자가 근로자에게 부당해고등을 하면…",
      },
      {
        조문번호: "0005",
        법령명: "근로기준법 시행규칙",
        법령ID: "006859",
        조문가지번호: "00",
        id: "2",
        조문제목: "부당해고등의 구제신청",
        조문내용: "제5조(부당해고등의 구제신청)근로자는 법 제28조제1항에 따라…",
      },
      {
        조문번호: "0082",
        법령명: "노동조합 및 노동관계조정법",
        법령ID: "000143",
        조문가지번호: "00",
        id: "3",
        조문제목: "구제신청",
        조문내용: "제82조(구제신청)①사용자의 부당노동행위로 인하여…",
      },
    ],
  },
};

test("실 응답을 조문 단위로 정규화한다 — 이게 우리가 못 만들던 신호다", () => {
  const result = extractAiSearch(REAL_RESPONSE, "부당해고 구제신청 기간");

  assert.equal(result.total, 3);
  assert.equal(result.articles.length, 3);

  const top = result.articles[0];
  assert.equal(top.lawName, "근로기준법");
  assert.equal(top.lawId, "001872", "법령ID 를 그대로 준다 — get_law_article 에 추가 호출 없이 쓴다");
  assert.equal(top.display, "제28조", "0028 → 제28조");
  assert.equal(top.rank, 1);
  assert.equal(top.title, "부당해고등의 구제신청");
});

test("가지번호가 있으면 제N조의M 으로 표기한다", () => {
  const result = extractAiSearch(
    { aiSearch: { 법령조문: [{ 조문번호: "0839", 조문가지번호: "02", 법령명: "민법", id: "1" }] } },
    "재산분할",
  );

  assert.equal(result.articles[0].display, "제839조의2");
});

test("법령 단위로 접되 순위를 보존한다", () => {
  const result = extractAiSearch(REAL_RESPONSE, "부당해고 구제신청 기간");

  assert.deepEqual(
    result.laws.map((law) => law.lawName),
    ["근로기준법", "근로기준법 시행규칙", "노동조합 및 노동관계조정법"],
  );
  assert.equal(result.laws[0].bestRank, 1);
});

test("같은 법의 조문 여러 건은 한 법령으로 묶인다", () => {
  const result = extractAiSearch(
    {
      aiSearch: {
        법령조문: [
          { 조문번호: "0023", 조문가지번호: "00", 법령명: "근로기준법", 법령ID: "001872", id: "1" },
          { 조문번호: "0028", 조문가지번호: "00", 법령명: "근로기준법", 법령ID: "001872", id: "2" },
        ],
      },
    },
    "해고",
  );

  assert.equal(result.laws.length, 1);
  assert.deepEqual(result.laws[0].articles.map((a) => a.display), ["제23조", "제28조"]);
});

// 순위를 잃으면 이 채널의 존재 이유가 사라진다 — 조용히 0 으로 두지 않고 배열 순서로 떨어진다.
test("순위 필드가 없으면 배열 순서를 순위로 쓴다", () => {
  const result = extractAiSearch(
    {
      aiSearch: {
        법령조문: [
          { 조문번호: "0100", 조문가지번호: "00", 법령명: "가법" },
          { 조문번호: "0200", 조문가지번호: "00", 법령명: "나법" },
        ],
      },
    },
    "질의",
  );

  assert.deepEqual(result.articles.map((a) => a.rank), [1, 2]);
  assert.deepEqual(result.laws.map((l) => l.lawName), ["가법", "나법"]);
});

test("응답이 순위 역순으로 와도 순위대로 정렬한다", () => {
  const result = extractAiSearch(
    {
      aiSearch: {
        법령조문: [
          { 조문번호: "0200", 조문가지번호: "00", 법령명: "나법", id: "2" },
          { 조문번호: "0100", 조문가지번호: "00", 법령명: "가법", id: "1" },
        ],
      },
    },
    "질의",
  );

  assert.deepEqual(result.articles.map((a) => a.lawName), ["가법", "나법"]);
});

// ── Failure probe: 어떤 실패든 빈 결과. 예외가 호출자에게 새면 검색 전체가 죽는다. ──

test("HTTP 실패를 예외 없이 빈 결과로 흡수한다", async () => {
  const result = await lookupAiSearch("부당해고", async () => {
    throw new Error("HTTP 503");
  });

  assert.deepEqual(result.articles, []);
  assert.equal(result.query, "부당해고");
});

test("빈 응답을 빈 결과로 흡수한다", async () => {
  const result = await lookupAiSearch("부당해고", async () => ({}));

  assert.deepEqual(result.articles, []);
  assert.equal(result.total, 0);
});

// 핀 고정한 키가 사라진 응답 = upstream 스키마 변경. 200 이지만 우리가 읽을 수 없다.
test("스키마가 바뀐 응답을 빈 결과로 흡수한다", () => {
  const result = extractAiSearch(
    { aiSearch: { articles: [{ lawName: "근로기준법", articleNo: 28 }] } },
    "부당해고",
  );

  assert.deepEqual(result.articles, []);
});

test("컨테이너가 통째로 없어도 던지지 않는다", () => {
  for (const broken of [null, undefined, "문자열 응답", 42, []]) {
    assert.doesNotThrow(() => extractAiSearch(broken, "질의"));
    assert.deepEqual(extractAiSearch(broken, "질의").articles, []);
  }
});

test("조문번호가 망가진 행은 버리고 나머지는 살린다", () => {
  const result = extractAiSearch(
    {
      aiSearch: {
        법령조문: [
          { 조문번호: "없음", 법령명: "가법", id: "1" },
          { 조문번호: "0028", 조문가지번호: "00", 법령명: "근로기준법", id: "2" },
        ],
      },
    },
    "질의",
  );

  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].lawName, "근로기준법");
});

test("빈 질의는 upstream 을 때리지 않는다", async () => {
  let calls = 0;
  const result = await lookupAiSearch("   ", async () => {
    calls += 1;
    return REAL_RESPONSE;
  });

  assert.equal(calls, 0);
  assert.deepEqual(result.articles, []);
});

// ── 캐시: 비용 예산(검색 1회당 추가 호출 ≤1)을 지키는 장치 ──

test("캐시 히트 시 추가 호출이 0 이다", async () => {
  let calls = 0;
  const cache = new AiSearchCache();
  const fetcher = async () => {
    calls += 1;
    return REAL_RESPONSE;
  };

  await lookupAiSearch("부당해고 구제신청 기간", fetcher, cache);
  const second = await lookupAiSearch("부당해고 구제신청 기간", fetcher, cache);

  assert.equal(calls, 1);
  assert.equal(second.articles[0].lawName, "근로기준법");
});

// miss 를 캐시하지 않으면 결과 없는 질의가 매번 upstream 을 때린다.
test("빈 결과도 캐시한다", async () => {
  let calls = 0;
  const cache = new AiSearchCache();
  const fetcher = async () => {
    calls += 1;
    throw new Error("HTTP 503");
  };

  await lookupAiSearch("없는질의", fetcher, cache);
  await lookupAiSearch("없는질의", fetcher, cache);

  assert.equal(calls, 1);
});

test("캐시는 오래된 항목부터 버린다", async () => {
  const cache = new AiSearchCache(2);
  const fetcher = async () => REAL_RESPONSE;

  await lookupAiSearch("하나", fetcher, cache);
  await lookupAiSearch("둘", fetcher, cache);
  await lookupAiSearch("셋", fetcher, cache);

  assert.equal(cache.size, 2);
});

// ── TV7 step-1 — 재정렬용 신호 확장 ────────────────────────────────────────────

test("조문 수집 폭이 30이다 — 재정렬은 후보가 목록에 있어야 시작된다", async () => {
  // 2026-07-22 실측: 정답 법이 결과 안에 존재하는 비율 display=10 → 28/30,
  // display=30 → 30/30. 이 값이 곧 재정렬의 도달 상한이라 조용히 낮추면 안 된다.
  assert.equal(AI_SEARCH_DISPLAY, 30);

  let seen: number | null = null;
  await lookupAiSearch("가산세", async (_query, display) => {
    seen = display;
    return {};
  });
  assert.equal(seen, AI_SEARCH_DISPLAY, "기본 호출이 확장된 폭을 쓴다");
});

test("폭을 넓혀도 추가 HTTP 호출이 생기지 않는다", async () => {
  // TV4 는 신호를 **사려다** 비용에 막혀 죽었다. 이 milestone 의 전제는
  // "같은 호출의 파라미터만 바꾼다" 이므로 호출 수가 늘면 전제가 깨진 것이다.
  let calls = 0;
  await lookupAiSearch("가산세", async () => {
    calls += 1;
    return {};
  });
  assert.equal(calls, 1);
});

test("법령 단위 신호가 순위·조문제목을 함께 준다 — 재정렬의 재료", async () => {
  const result = extractAiSearch(
    {
      aiSearch: {
        법령조문: [
          { id: "1", 법령명: "가법", 법령ID: "1", 조문번호: "0005", 조문제목: "목적" },
          { id: "2", 법령명: "나법", 법령ID: "2", 조문번호: "0060", 조문제목: "가산세" },
          { id: "3", 법령명: "나법", 법령ID: "2", 조문번호: "0061", 조문제목: "가산세 감면" },
        ],
      },
    },
    "지연발급 가산세",
  );

  const 나법 = result.laws.find((law) => law.lawName === "나법");
  assert.ok(나법, "법령 단위로 접힌다");
  assert.equal(나법.bestRank, 2, "그 법의 최상위 순위");
  assert.deepEqual(나법.articles.map((a) => a.title), ["가산세", "가산세 감면"],
    "조문제목이 보존된다 — TV4 가 771KB 를 내고 얻으려던 값");
});
