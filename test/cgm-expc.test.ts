import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_DESCRIPTORS,
  CGM_EXPC_DESCRIPTORS,
  SPECIAL_DECC_DESCRIPTORS,
  extractRows,
  mapRow,
} from "../src/providers/source-adapter.js";

/**
 * TV2 step-2 — 중앙부처 법령해석(예규) 2종의 계약 테스트.
 *
 * 예규는 다른 자료원과 두 가지가 다르다:
 *   ① **전문이 없다** — 검색 메타데이터와 원문 링크까지가 upstream 이 주는 전부다.
 *      빈 응답을 흘리면 "찾아봤지만 내용이 없다"로 오해되므로 **명시 거절**한다.
 *   ② `display=1` 이면 행이 배열이 아니라 단건 객체로 온다(UD3 이 위원회에서 고친 결함과 동일).
 */

// 2026-07-21 실 API 응답에서 그대로 잘라온 fixture.
const SEARCH_FIXTURE = {
  CgmExpc: {
    totalCnt: "1938",
    cgmExpc: [
      {
        id: "1",
        안건명: "’08년 이전 취득 주식에 대해 출연재산가액 1% 이상 직접 공익목적 사용 의무 위반시 가산세 적용 여부",
        해석기관코드: "1210000",
        법령해석상세링크: "https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=200000000000012562",
        안건번호: "기준-2023-법규법인-0191[법규과-992]",
        법령해석일련번호: "1643869",
        질의기관명: "",
        해석기관명: "국세청",
        해석일자: "2025.05.15",
        데이터기준일시: "2025.06.28",
      },
    ],
  },
};

// display=1 일 때 upstream 이 실제로 주는 모양 — 행이 배열이 아니다.
const SINGLE_OBJECT_FIXTURE = {
  CgmExpc: {
    totalCnt: "1938",
    cgmExpc: SEARCH_FIXTURE.CgmExpc.cgmExpc[0],
  },
};

test("예규 target 도 기관약어 + 서비스명 어순이다 — cgmExpc + 부처코드는 빈 응답이다", () => {
  assert.equal(SOURCE_DESCRIPTORS.ntsExpc.target, "ntsCgmExpc");
  assert.equal(SOURCE_DESCRIPTORS.moefExpc.target, "moefCgmExpc");
  for (const d of Object.values(CGM_EXPC_DESCRIPTORS)) {
    assert.ok(
      !/^cgmExpc/.test(d.target),
      `어순이 뒤집혔다(${d.target}) — cgmExpc+부처코드 형태는 전부 빈 응답이다`,
    );
  }
});

test("실무자가 인용하는 안건번호와 원문 링크를 그대로 싣는다", () => {
  const { rows, total } = extractRows(SEARCH_FIXTURE, SOURCE_DESCRIPTORS.ntsExpc);
  assert.equal(total, 1938);
  const item = mapRow(rows[0], SOURCE_DESCRIPTORS.ntsExpc, 0);
  assert.equal(item.source_id, "1643869");
  assert.equal(item.안건번호, "기준-2023-법규법인-0191[법규과-992]");
  assert.equal(item.해석기관명, "국세청");
  assert.equal(item.해석일자, "2025.05.15");
  assert.match(String(item.원문링크), /taxlaw\.nts\.go\.kr/);
});

// display=1 로 부르면 배열이 아니라 단건 객체가 온다. 정규화가 없으면 조용히 0건이 된다.
test("display=1 단건 객체가 배열로 정규화된다", () => {
  const { rows } = extractRows(SINGLE_OBJECT_FIXTURE, SOURCE_DESCRIPTORS.ntsExpc);
  assert.equal(rows.length, 1, "단건 객체를 배열로 흡수하지 못하면 0건이 된다");
  assert.equal(mapRow(rows[0], SOURCE_DESCRIPTORS.ntsExpc, 0).source_id, "1643869");
});

/**
 * 핵심 계약. 전문이 없다는 사실을 **빈 결과가 아니라 사유로** 알려야 한다.
 * `getLegalSource` 가 이 필드를 보고 upstream 을 부르지 않고 즉시 거절한다.
 */
test("전문 없음이 사유와 대체 경로를 갖고 선언돼 있다", () => {
  for (const [key, d] of Object.entries(CGM_EXPC_DESCRIPTORS)) {
    assert.ok(d.detailUnavailable, `${key}: 전문 없음이 선언돼야 한다`);
    assert.match(String(d.detailUnavailable), /원문링크/, `${key}: 대체 경로를 안내해야 한다`);
    assert.deepEqual(d.detailLinkKeys, ["법령해석상세링크"]);
  }
});

// 전문이 있는 자료원까지 같이 막히면 과잉 수리다.
test("전문이 있는 자료원은 detailUnavailable 이 없다 — 과잉 차단 방지", () => {
  for (const [key, d] of Object.entries(SPECIAL_DECC_DESCRIPTORS)) {
    assert.equal(d.detailUnavailable, undefined, `${key}: 심판례는 전문이 있다`);
  }
  for (const key of ["expc", "detc", "decc", "ordin", "lstrm", "nlrc"]) {
    assert.equal(SOURCE_DESCRIPTORS[key].detailUnavailable, undefined, `${key}`);
  }
});

// 법제처 expc(법령해석례)와 국세청 예규는 다른 자료원이다. 세법 해석은 expc 에 거의 없다.
test("법제처 expc 와 국세청 ntsExpc 는 다른 자료원이다", () => {
  assert.notEqual(SOURCE_DESCRIPTORS.expc.target, SOURCE_DESCRIPTORS.ntsExpc.target);
  assert.notEqual(SOURCE_DESCRIPTORS.expc.container, SOURCE_DESCRIPTORS.ntsExpc.container);
  assert.equal(SOURCE_DESCRIPTORS.ntsExpc.container, "CgmExpc");
});
