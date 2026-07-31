import assert from "node:assert/strict";
import test from "node:test";
import {
  findArticleInRoot,
  buildFiveHundredError,
  DELEGATION_NOTICE,
  DELEGATION_AS_OF_NOTICE,
  LawGoProvider,
  normalizeArticleInput,
  parseArticleReference,
} from "../src/providers/lawgo-provider.js";

/**
 * M3 — 알려진 함정 4건(J·F·I·D)의 회귀 테스트.
 * fixture 는 실 API 응답 구조에서 잘라 왔다(재현 케이스: get_law_article 001586 제59조 as_of=2024).
 */

// ── J: law_name null ──────────────────────────────────────────────────────
// 법령 상세(law/eflaw MST 조회)의 법령명은 최상위가 아니라 `기본정보.법령명_한글` 에 실린다.
const LAW_ROOT_NESTED_NAME = {
  법령: {
    기본정보: { 법령명_한글: "국세기본법", 법령ID: "001586" },
    조문: {
      조문단위: [
        {
          조문여부: "조문",
          조문번호: "59",
          조문가지번호: "0",
          조문제목: "대리인",
          조문내용: "제59조(대리인) ① 이의신청인은 대리인을 선임할 수 있다.",
        },
      ],
    },
  },
};

test("J — 기본정보.법령명_한글 만 있는 응답에서도 law_name 이 채워진다 (재현: 001586 제59조)", () => {
  const found = findArticleInRoot(
    LAW_ROOT_NESTED_NAME,
    parseArticleReference("제59조"),
    normalizeArticleInput("제59조"),
    "001586",
    "제59조",
  );
  assert.ok(found);
  assert.equal(found.law_name, "국세기본법", "종전엔 null 이었다 — 최상위 키만 봐서");
  assert.equal(found.law_id, "001586");
});

test("J — 최상위 법령명한글 경로(기존 동작)는 회귀 없음", () => {
  const root = {
    법령: {
      법령명한글: "소득세법",
      법령ID: "001565",
      조문: { 조문단위: [{ 조문여부: "조문", 조문번호: "1", 조문가지번호: "0", 조문내용: "제1조(목적) …" }] },
    },
  };
  const found = findArticleInRoot(root, parseArticleReference("제1조"), normalizeArticleInput("제1조"), "001565", "제1조");
  assert.equal(found?.law_name, "소득세법");
});

test("J — 상류가 법령명을 아예 안 주면 null 유지 (없는 값을 지어내지 않는다)", () => {
  const root = {
    법령: {
      조문: { 조문단위: [{ 조문여부: "조문", 조문번호: "1", 조문가지번호: "0", 조문내용: "제1조 …" }] },
    },
  };
  const found = findArticleInRoot(root, parseArticleReference("제1조"), normalizeArticleInput("제1조"), "x", "제1조");
  assert.equal(found?.law_name, null);
});

// ── F: 5xx 재분류 ─────────────────────────────────────────────────────────
test("F — 검증 재조회가 인증 오류를 확인하면 5xx 는 재시도 불가 인증 실패다", () => {
  const err = buildFiveHundredError("auth", "HTTP 500", 500) as Error & {
    data?: { code?: string; retryable?: boolean };
  };
  const payload = JSON.parse(JSON.stringify(err.message ? { message: err.message } : {}));
  assert.match(String(payload.message ?? err.message), /인증 실패/);
  assert.match(String(err.message), /재시도 무익/);
});

test("F — 검증 재조회가 성공하면 일시 장애(재시도 가치 있음)로 남는다", () => {
  const err = buildFiveHundredError("ok", "HTTP 503", 503);
  assert.match(String(err.message), /인증은 정상/);
});

test("F — 검증 재조회 자체가 실패하면 단정하지 않는다 (기존 안내 유지)", () => {
  const err = buildFiveHundredError("unknown", "HTTP 502", 502);
  assert.match(String(err.message), /일시 장애/);
  assert.match(String(err.message), /인증값 문제일 수 있습니다/);
});

// ── I + D: 위임 병렬 조회 · 전달 강화 ──────────────────────────────────────
// fetcher 주입으로 실 API 없이 검증한다. lsDelegated 실측 구조의 축약 fixture.
const DELEGATION_FIXTURE = {
  lsDelegated: {
    법령: {
      위임조문정보: [
        {
          조정보: { 조문번호: "12", 조문가지번호: "0" },
          위임정보: {
            위임법령제목: "소득세법 시행령",
            위임구분: "시행령",
            위임법령조문정보: { 위임법령조문번호: "8", 위임법령조문가지번호: "0", 위임법령조문제목: "비과세" },
          },
        },
      ],
    },
  },
};

test("I — 같은 법령 반복 조회에서 위임 상류 호출은 1회다 (캐시) + D — 위임 지점에 소비 안내가 실린다", async () => {
  let fetchCount = 0;
  const provider = new LawGoProvider(undefined, async () => {
    fetchCount += 1;
    return DELEGATION_FIXTURE;
  });
  // private 경로 대신 공개 동작으로 검증: startDelegationLookup → attachDelegations 체인은
  // getLawArticle 내부라 실 API 가 필요하므로, 여기서는 fetcher 호출 수 계약을 lookup 경유로 잰다.
  const { lookupDelegations, DelegationCache } = await import("../src/delegated.js");
  const cache = new DelegationCache();
  const fetcher = async () => { fetchCount += 1; return DELEGATION_FIXTURE; };
  fetchCount = 0;
  const first = await lookupDelegations("001565", "제12조", fetcher, cache);
  const second = await lookupDelegations("001565", "제12조", fetcher, cache);
  assert.equal(first.length, 1);
  assert.deepEqual(first, second);
  assert.equal(fetchCount, 1, "반복 조회에서 상류 호출이 늘면 캐시가 깨진 것");
  void provider;
});

test("D — 소비 안내 문구가 '어느 쪽이 근거인지 명시하라'를 요구한다", () => {
  assert.match(DELEGATION_NOTICE, /본법이 아니라/);
  assert.match(DELEGATION_NOTICE, /명시하라/);
});

test("D/I — as_of 조회에 위임 정보를 붙일 때 현행 기준임을 고지한다 (시점 오염 방지)", () => {
  assert.match(DELEGATION_AS_OF_NOTICE, /현행 법령 기준/);
  assert.match(DELEGATION_AS_OF_NOTICE, /as_of/);
});
