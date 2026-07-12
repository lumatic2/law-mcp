import assert from "node:assert/strict";
import test from "node:test";
import {
  bridgeThenRelaxSearch,
  extractNtstDcmIdFromLocation,
  isNtsPlaceholderContent,
  mapNtsPrecedentDetail,
  relaxQuery,
} from "../src/providers/lawgo-provider.js";
import { bridgeTerm } from "../src/term-bridge.js";

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

test("mapNtsPrecedentDetail extracts full text from dcmHwpEditorDVOList html entries when present", () => {
  const actionData = {
    dcmDVO: {
      ntstDcmTtl: "가지급금인정이자 제도와 지급이자손금불산입 제도는 별개",
      ntstDcmGistCntn: "이중과세로 볼 수 없음",
      ntstDcmCntn: "판결 내용은 붙임과 같습니다.",
      dsbdHpnnNo: "대법원-2025-두-34068",
    },
    dcmRltnStttList: [{ ntstTextNm: "법인세법 제19조의2" }],
    dcmHwpEditorDVOList: [
      { dcmFleSn: "2", dcmFleTy: "html", dcmFleByte: "<html><body>이유 부분입니다.</body></html>" },
      { dcmFleSn: "1", dcmFleTy: "html", dcmFleByte: "<html><body>사건 대법원2025두34068 주 문 상고를 기각한다.</body></html>" },
      { dcmFleSn: "0", dcmFleTy: "hwp", dcmFleByte: "" },
    ],
  };

  const result = mapNtsPrecedentDetail(actionData, "612611", "200000000000014819");

  assert.equal(
    result.판례내용,
    "사건 대법원2025두34068 주 문 상고를 기각한다.\n\n이유 부분입니다.",
  );
  assert.ok(result.warnings?.some((w) => w.includes("전문은 NTS 서버 변환 HTML")));
  assert.equal(result.warnings?.some((w) => w.includes("도달 불가")), false);
});

test("mapNtsPrecedentDetail falls back to the placeholder warning when dcmHwpEditorDVOList has no html content", () => {
  const actionData = {
    dcmDVO: {
      ntstDcmTtl: "제목",
      ntstDcmGistCntn: "요지",
      ntstDcmCntn: "판결 내용은 붙임과 같습니다.",
      dsbdHpnnNo: "대법원-2025-두-00000",
    },
    dcmRltnStttList: [],
    dcmHwpEditorDVOList: [{ dcmFleSn: "0", dcmFleTy: "hwp", dcmFleByte: "" }],
  };

  const result = mapNtsPrecedentDetail(actionData, "000000", "200000000000000000");

  assert.equal(result.판례내용, "요지");
  assert.ok(result.warnings && result.warnings.length === 2);
  assert.ok(result.warnings.some((w) => w.includes("도달 불가")));
});

test("relaxQuery drops the last whitespace-separated token", () => {
  assert.equal(relaxQuery("업무무관 가지급금 대표이사 소득처분"), "업무무관 가지급금 대표이사");
  assert.equal(relaxQuery("가지급금 대표이사"), "가지급금");
});

test("relaxQuery returns null when the query cannot be relaxed further", () => {
  assert.equal(relaxQuery("가지급금"), null);
  assert.equal(relaxQuery("   "), null);
});

// BACKLOG #5 실패 시나리오: "기업업무추진비 한도 손금불산입" 브리지 치환 후에도
// ("접대비 한도 손금불산입" 0건) 곧바로 히트하지 못하고, 마지막 토큰부터 두 단계 더
// 완화("접대비 한도" 0건 → "접대비" 히트)해야 도달하는 다단어 신용어 쿼리를 재현한다.
test("bridgeThenRelaxSearch progressively relaxes the bridged query until it hits", async () => {
  const query = "기업업무추진비 한도 손금불산입";
  const bridged = bridgeTerm(query);
  assert.ok(bridged);
  assert.equal(bridged?.replaced, "접대비 한도 손금불산입");

  const attempted: string[] = [];
  const fetchOnce = async (q: string) => {
    attempted.push(q);
    if (q === "접대비") return { items: [{ id: 1 }], total: 3 };
    return { items: [] as { id: number }[], total: 0 };
  };

  const result = await bridgeThenRelaxSearch(query, bridged!, fetchOnce);

  assert.deepEqual(attempted, ["접대비 한도", "접대비"]);
  assert.ok(result);
  assert.equal(result?.items.length, 1);
  assert.equal(result?.total, 3);
  assert.equal(
    result?.warning,
    "'기업업무추진비 한도 손금불산입' 0건 → 개정 전 용어 '접대비 한도 손금불산입'로 치환 후 '접대비'로 완화 재검색",
  );
});

test("bridgeThenRelaxSearch returns null when even full relaxation stays at zero hits", async () => {
  const query = "기업업무추진비 한도 손금불산입";
  const bridged = bridgeTerm(query);
  assert.ok(bridged);

  const fetchOnce = async () => ({ items: [] as unknown[], total: 0 });
  const result = await bridgeThenRelaxSearch(query, bridged!, fetchOnce);

  assert.equal(result, null);
});

test("bridgeThenRelaxSearch does not need to relax when the direct bridge term itself is a single token", async () => {
  const query = "지정기부금";
  const bridged = bridgeTerm(query);
  assert.ok(bridged);
  assert.equal(bridged?.replaced, "일반기부금");

  // 단일 토큰이면 relaxQuery가 더 완화할 게 없어 null을 반환한다 — 다단 완화 루프 자체가 돌지 않아야 한다.
  const fetchOnce = async () => ({ items: [] as unknown[], total: 0 });
  const result = await bridgeThenRelaxSearch(query, bridged!, fetchOnce);

  assert.equal(result, null);
});
