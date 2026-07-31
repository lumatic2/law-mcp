import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_DESCRIPTORS,
  STATUTE_ANNEX_DESCRIPTORS,
  extractRows,
  extractDetail,
  mapRow,
} from "../src/providers/source-adapter.js";

/**
 * M2 step-1 — 법령계 자료원 3종(조약·신구법·별표)의 계약 테스트.
 * fixture 는 2026-07-31 실 API 응답에서 그대로 잘라 왔다(M1 프로브·M2 사전 프로브).
 */

// ── trty ──────────────────────────────────────────────────────────────────
// ⚠ 행 키가 target 소문자가 아니라 대문자 `Trty` 다.
const TRTY_SEARCH_FIXTURE = {
  TrtySearch: {
    totalCnt: "147",
    Trty: [
      {
        id: "1",
        조약명: "1978년 10월 25일 서울에서 서명된 대한민국과 네덜란드왕국간의 소득에 대한 조세의 이중과세회피와 탈세방지를 위한 협약 개정 의정서",
        서명일자: "19781025",
        조약번호: "962",
        조약구분명: "양자조약",
        발효일자: "19990402",
        조약일련번호: "8757",
        조약상세링크: "/DRF/lawService.do?OC=x&target=trty&ID=8757&type=HTML&mobileYn=",
      },
    ],
  },
};

// 전문은 `조약내용.조약내용` 으로 한 단계 중첩이다 — extractDetail nested lookup 계약.
const TRTY_DETAIL_FIXTURE = {
  BothTrtyService: {
    조약내용: { 조약내용: "[전문]대한민국과 네덜란드왕국(이하 \"체약국\"이라 한다)은 …" },
    조약기본정보: { 조약명: "…협약 개정 의정서", 발효일자: "19990402" },
    추가정보: {},
  },
};

test("trty — 검색 행 키는 대문자 Trty 다 (소문자로 추측하면 0건)", () => {
  const { rows, total } = extractRows(TRTY_SEARCH_FIXTURE, SOURCE_DESCRIPTORS.trty);
  assert.equal(total, 147);
  const item = mapRow(rows[0], SOURCE_DESCRIPTORS.trty, 0);
  assert.equal(item.source_id, "8757");
  assert.equal(item.조약구분명, "양자조약");
  assert.equal(item.발효일자, "19990402");
});

test("trty — 전문이 조약내용.조약내용 중첩에서 나온다", () => {
  const detail = extractDetail(TRTY_DETAIL_FIXTURE, SOURCE_DESCRIPTORS.trty, "8757");
  assert.ok(detail, "양자조약 전문이 나와야 한다");
  assert.match(String(detail.조약내용), /체약국/);
  assert.equal(detail.발효일자, "19990402");
});

test("trty — 국내법 우선 오해를 막는 statute 등급과 조세조약 우선 적용 안내", () => {
  assert.equal(SOURCE_DESCRIPTORS.trty.authority.grade, "statute");
  assert.match(SOURCE_DESCRIPTORS.trty.authority.note, /우선 적용/);
});

// ── oldAndNew ─────────────────────────────────────────────────────────────
const OLDANDNEW_SEARCH_FIXTURE = {
  OldAndNewLawSearch: {
    totalCnt: "3",
    oldAndNew: {
      // display=1 단건 객체 (DRF 공통 습성)
      현행연혁코드: "현행",
      id: "1",
      신구법ID: "001565",
      시행일자: "20260701",
      법령구분명: "법률",
      공포일자: "20251223",
      제개정구분명: "일부개정",
      신구법일련번호: "280405",
      신구법명: "소득세법",
    },
  },
};

// OldAndNewService 는 평평한 필드가 없다 — listSections 가 없으면 상세가 통째로 null 이 된다.
const OLDANDNEW_DETAIL_FIXTURE = {
  OldAndNewService: {
    신조문목록: {
      조문: [
        { content: "제12조(비과세소득) 다음 각 호의 소득에 대해서는 소득세를 과세하지 아니한다.", no: "1" },
        { content: "마. 조림기간 5년 이상인 임지의 임목의 벌채 … 연 3천만원 이하의 금액.", no: "5" },
      ],
    },
    구조문목록: {
      조문: { content: "제12조(비과세소득) — 구조문", no: "1" },
    },
    신조문_기본정보: {},
    구조문_기본정보: {},
  },
};

test("oldAndNew — display=1 단건 객체가 배열로 정규화되고 MST 용 일련번호가 ID 다", () => {
  const { rows, total } = extractRows(OLDANDNEW_SEARCH_FIXTURE, SOURCE_DESCRIPTORS.oldAndNew);
  assert.equal(total, 3);
  assert.equal(rows.length, 1);
  const item = mapRow(rows[0], SOURCE_DESCRIPTORS.oldAndNew, 0);
  assert.equal(item.source_id, "280405");
  assert.equal(item.제개정구분명, "일부개정");
  assert.equal(SOURCE_DESCRIPTORS.oldAndNew.detail.idParam, "MST");
});

test("oldAndNew — 신·구 조문 목록이 listSections 로 펴진다 (단건 조문도 배열로)", () => {
  const detail = extractDetail(OLDANDNEW_DETAIL_FIXTURE, SOURCE_DESCRIPTORS.oldAndNew, "280405");
  assert.ok(detail, "listSections 없이는 여기서 null 이 됐다");
  assert.equal((detail.신조문목록 as string[]).length, 2);
  assert.match((detail.신조문목록 as string[])[0], /비과세소득/);
  assert.equal((detail.구조문목록 as string[]).length, 1, "단건 조문 객체를 배열로 흡수해야 한다");
});

// ── licbyl ────────────────────────────────────────────────────────────────
const LICBYL_SEARCH_FIXTURE = {
  licBylSearch: {
    totalCnt: "97",
    licbyl: [
      {
        id: "1",
        관련법령명: "소득세법 시행규칙",
        관련법령ID: "007507",
        별표일련번호: "18161693",
        별표종류: "서식",
        별표번호: "008306",
        별표명: "1세대 3주택 이상자의 장기임대주택 등 일반세율 적용신청서",
        별표서식파일링크: "/LSW/flDownload.do?flSeq=164445073",
        별표서식PDF파일링크: "/LSW/flDownload.do?flSeq=164445075",
        공포일자: "20260522",
      },
    ],
  },
};

test("licbyl — 세율표·서식 메타와 파일 링크가 실린다", () => {
  const { rows, total } = extractRows(LICBYL_SEARCH_FIXTURE, SOURCE_DESCRIPTORS.licbyl);
  assert.equal(total, 97);
  const item = mapRow(rows[0], SOURCE_DESCRIPTORS.licbyl, 0);
  assert.equal(item.source_id, "18161693");
  assert.equal(item.관련법령명, "소득세법 시행규칙");
  assert.match(String(item.별표서식PDF파일링크), /flDownload/);
});

test("licbyl — 전문 없음이 사유·대체 링크와 함께 선언돼 있다 (HTML 셸을 빈 결과로 흘리지 않는다)", () => {
  const d = SOURCE_DESCRIPTORS.licbyl;
  assert.ok(d.detailUnavailable);
  assert.match(String(d.detailUnavailable), /PDF/);
  assert.deepEqual(d.detailLinkKeys, ["별표서식PDF파일링크", "별표서식파일링크"]);
});

// ── 공통 ──────────────────────────────────────────────────────────────────
test("3종 전부 SOURCE_DESCRIPTORS 에 등록됐고 본문검색은 미확인이라 꺼져 있다", () => {
  for (const key of Object.keys(STATUTE_ANNEX_DESCRIPTORS)) {
    assert.ok(SOURCE_DESCRIPTORS[key], `${key} 등록 누락`);
    assert.equal(SOURCE_DESCRIPTORS[key].supportsBodySearch, false, `${key}: 본문검색 미확인 — 켜려면 실측 먼저`);
  }
});
