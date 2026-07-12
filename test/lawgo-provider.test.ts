import assert from "node:assert/strict";
import test from "node:test";
import {
  extractNtstDcmIdFromLocation,
  isNtsPlaceholderContent,
  mapNtsPrecedentDetail,
  relaxQuery,
} from "../src/providers/lawgo-provider.js";

test("extractNtstDcmIdFromLocation reads ntstDcmId from an NTS redirect", () => {
  const location = "https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=200000000000014819";
  assert.equal(extractNtstDcmIdFromLocation(location), "200000000000014819");
});

test("extractNtstDcmIdFromLocation returns null for a non-NTS redirect", () => {
  assert.equal(extractNtstDcmIdFromLocation("https://www.law.go.kr/LSW/precInfoP.do?precSeq=1"), null);
});

test("extractNtstDcmIdFromLocation returns null for missing/invalid input", () => {
  assert.equal(extractNtstDcmIdFromLocation(undefined), null);
  assert.equal(extractNtstDcmIdFromLocation(null), null);
  assert.equal(extractNtstDcmIdFromLocation("not a url"), null);
});

test("isNtsPlaceholderContent detects the '붙임과 같습니다' placeholder", () => {
  assert.equal(isNtsPlaceholderContent("판결 내용은 붙임과 같습니다."), true);
  assert.equal(isNtsPlaceholderContent("판결 내용은 붙임과 같습니다"), true);
  assert.equal(isNtsPlaceholderContent(null), true);
  assert.equal(isNtsPlaceholderContent(""), true);
  assert.equal(isNtsPlaceholderContent("실제 판결 전문 텍스트입니다."), false);
});

test("mapNtsPrecedentDetail maps dcmDVO fields and falls back to gist when content is a placeholder", () => {
  const actionData = {
    dcmDVO: {
      ntstDcmTtl: "가지급금인정이자 제도와 지급이자손금불산입 제도는 별개",
      ntstDcmGistCntn: "이중과세로 볼 수 없음",
      ntstDcmCntn: "판결 내용은 붙임과 같습니다.",
      dsbdHpnnNo: "대법원-2025-두-34068",
    },
    dcmRltnStttList: [{ ntstTextNm: "법인세법 제19조의2" }],
  };

  const result = mapNtsPrecedentDetail(actionData, "612611", "200000000000014819");

  assert.equal(result.precedent_id, "612611");
  assert.equal(result.사건명, "가지급금인정이자 제도와 지급이자손금불산입 제도는 별개");
  assert.equal(result.법원명, "대법원");
  assert.equal(result.판결요지, "이중과세로 볼 수 없음");
  assert.equal(result.참조조문, "법인세법 제19조의2");
  assert.equal(result.판례내용, "이중과세로 볼 수 없음");
  assert.equal(result.선고일자, null);
  assert.equal(result.판시사항, null);
  assert.ok(result.warnings && result.warnings.length === 2);
});

test("mapNtsPrecedentDetail keeps real content when it is not a placeholder", () => {
  const actionData = {
    dcmDVO: {
      ntstDcmTtl: "제목",
      ntstDcmGistCntn: "요지",
      ntstDcmCntn: "실제 전문 텍스트",
      dsbdHpnnNo: "서울고등법원-2024-누-66886",
    },
    dcmRltnStttList: [],
  };

  const result = mapNtsPrecedentDetail(actionData, "619683", "200000000000020675");

  assert.equal(result.판례내용, "실제 전문 텍스트");
  assert.equal(result.참조조문, null);
  assert.ok(result.warnings && result.warnings.length === 1);
});

test("relaxQuery drops the last whitespace-separated token", () => {
  assert.equal(relaxQuery("업무무관 가지급금 대표이사 소득처분"), "업무무관 가지급금 대표이사");
  assert.equal(relaxQuery("가지급금 대표이사"), "가지급금");
});

test("relaxQuery returns null when the query cannot be relaxed further", () => {
  assert.equal(relaxQuery("가지급금"), null);
  assert.equal(relaxQuery("   "), null);
});
