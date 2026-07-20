import assert from "node:assert/strict";
import test from "node:test";
import { DelegationCache, extractDelegations, lookupDelegations } from "../src/delegated.js";

/**
 * UD3 step-2 — 위임조문 점프 계약 테스트.
 *
 * 픽스처는 2026-07-21 소득세법(ID=001565) 실 응답을 줄인 것이다. 이 응답의 **두 가지 배열/객체
 * 흔들림**이 이 모듈의 핵심 함정이고, 둘 다 조용한 누락을 만든다:
 *   ① `위임법령조문정보` 가 1건이면 객체
 *   ② `위임정보` 자체가 배열 — 한 조문이 시행령과 시행규칙에 동시에 위임할 때
 * ②를 놓쳤을 때 189건 중 23건(제70조 포함)이 통째로 사라졌다.
 */

const REAL = {
  lsDelegated: {
    법령: {
      위임조문정보: [
        {
          // 위임정보가 객체 + 조문정보가 배열
          위임정보: {
            위임법령제목: "소득세법 시행령",
            위임구분: "시행령",
            위임법령조문정보: [
              { 라인텍스트: "비거주자의 구분은 대통령령으로", 위임법령조문번호: "2", 위임법령조문제목: "주소와 거소의 판정" },
              { 라인텍스트: "비거주자의 구분은 대통령령으로", 위임법령조문번호: "2", 위임법령조문가지번호: "2", 위임법령조문제목: "거주자 또는 비거주자가 되는 시기" },
            ],
          },
          조정보: { 조문번호: "1", 조문제목: "정의", 조문가지번호: "2" },
        },
        {
          // 위임정보가 **배열** — 시행령과 시행규칙에 동시 위임
          위임정보: [
            {
              위임법령제목: "소득세법 시행령",
              위임구분: "시행령",
              위임법령조문정보: { 라인텍스트: "대통령령으로 정하는", 위임법령조문번호: "130", 위임법령조문제목: "종합소득 과세표준확정신고" },
            },
            {
              위임법령제목: "소득세법 시행규칙",
              위임구분: "시행규칙",
              위임법령조문정보: { 라인텍스트: "기획재정부령으로 정하는", 위임법령조문번호: "102", 위임법령조문제목: "조정계산서 관련서식" },
            },
          ],
          조정보: { 조문번호: "70", 조문제목: "종합소득과세표준 확정신고" },
        },
      ],
    },
  },
};

test("조문 → 위임받은 하위 법령 조문 지도를 만든다", () => {
  const map = extractDelegations(REAL);

  assert.deepEqual(
    map.get("제1조의2")?.map((d) => `${d.law} ${d.article}`),
    ["소득세법 시행령 제2조", "소득세법 시행령 제2조의2"],
  );
  assert.equal(map.get("제1조의2")?.[1].title, "거주자 또는 비거주자가 되는 시기");
  assert.equal(map.get("제1조의2")?.[0].phrase, "비거주자의 구분은 대통령령으로");
});

// 이걸 놓쳐서 소득세법 189건 중 23건이 사라졌다 — 제70조가 그중 하나였다.
test("위임정보가 배열이면(시행령+시행규칙 동시 위임) 둘 다 싣는다", () => {
  const map = extractDelegations(REAL);
  const seventy = map.get("제70조");

  assert.equal(seventy?.length, 2, "한쪽만 읽으면 조용히 절반이 사라진다");
  assert.deepEqual(seventy?.map((d) => d.kind), ["시행령", "시행규칙"]);
  assert.deepEqual(
    seventy?.map((d) => `${d.law} ${d.article}`),
    ["소득세법 시행령 제130조", "소득세법 시행규칙 제102조"],
  );
});

test("같은 법 같은 조문이 여러 구절에서 지목되면 한 번만 싣는다", () => {
  const map = extractDelegations({
    lsDelegated: {
      법령: {
        위임조문정보: {
          위임정보: {
            위임법령제목: "소득세법 시행령",
            위임구분: "시행령",
            위임법령조문정보: [
              { 라인텍스트: "대통령령으로 정하는 장소로", 위임법령조문번호: "5", 위임법령조문제목: "납세지의 결정과 신고" },
              { 라인텍스트: "대통령령으로 정하는 사람의", 위임법령조문번호: "5", 위임법령조문제목: "납세지의 결정과 신고" },
            ],
          },
          조정보: { 조문번호: "8", 조문제목: "상속 등의 경우의 납세지" },
        },
      },
    },
  });

  assert.equal(map.get("제8조")?.length, 1);
});

// ── Failure probe ──

test("위임이 없는 조문에는 아무것도 주지 않는다", async () => {
  const found = await lookupDelegations("001565", "제999조", async () => REAL);

  assert.deepEqual(found, [], "빈 배열 — 호출자가 필드를 달지 않는 신호");
});

test("조회 실패를 예외 없이 빈 배열로 흡수한다", async () => {
  const found = await lookupDelegations("001565", "제70조", async () => {
    throw new Error("HTTP 503");
  });

  assert.deepEqual(found, []);
});

test("응답 구조가 바뀌어도 던지지 않는다", () => {
  for (const broken of [null, undefined, "문자열", 42, [], { lsDelegated: {} }, { other: 1 }]) {
    assert.doesNotThrow(() => extractDelegations(broken));
    assert.equal(extractDelegations(broken).size, 0);
  }
});

test("법령ID·조문 중 하나라도 비면 upstream 을 때리지 않는다", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return REAL;
  };

  await lookupDelegations("", "제70조", fetcher);
  await lookupDelegations("001565", "", fetcher);

  assert.equal(calls, 0);
});

// 비용 예산: get_law_article 1회당 추가 호출 ≤1
test("같은 법령의 다른 조문은 캐시를 재사용한다", async () => {
  let calls = 0;
  const cache = new DelegationCache();
  const fetcher = async () => {
    calls += 1;
    return REAL;
  };

  await lookupDelegations("001565", "제1조의2", fetcher, cache);
  await lookupDelegations("001565", "제70조", fetcher, cache);

  assert.equal(calls, 1, "법령 단위로 한 번만 받는다");
});

test("빈 결과도 캐시한다", async () => {
  let calls = 0;
  const cache = new DelegationCache();
  const fetcher = async () => {
    calls += 1;
    throw new Error("HTTP 503");
  };

  await lookupDelegations("999999", "제1조", fetcher, cache);
  await lookupDelegations("999999", "제1조", fetcher, cache);

  assert.equal(calls, 1);
});
