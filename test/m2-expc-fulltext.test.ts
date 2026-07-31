import assert from "node:assert/strict";
import test from "node:test";
import { extractNtstDcmIdFromSourceId } from "../src/providers/lawgo-provider.js";
import { SOURCE_DESCRIPTORS, CGM_EXPC_DESCRIPTORS } from "../src/providers/source-adapter.js";

/**
 * M2 step-3 — 예규 본문 도달 계약.
 * 법제처엔 예규 전문이 없고, 원문링크의 ntstDcmId 로 NTS 문서 API 를 타야 한다.
 */

test("원문링크 URL 전체에서 ntstDcmId 를 뽑는다 (에이전트는 링크를 그대로 넘기면 된다)", () => {
  assert.equal(
    extractNtstDcmIdFromSourceId("https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=200000000000012562"),
    "200000000000012562",
  );
  assert.equal(
    extractNtstDcmIdFromSourceId("https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=010000000000149597"),
    "010000000000149597",
  );
});

test("맨 ntstDcmId 숫자도 받는다 — 단 법령해석일련번호(짧은 숫자)는 거른다", () => {
  assert.equal(extractNtstDcmIdFromSourceId("200000000000012562"), "200000000000012562");
  // 법령해석일련번호(1643869)를 ntstDcmId 로 오인하면 무관한 문서가 온다 — 반드시 null.
  assert.equal(extractNtstDcmIdFromSourceId("1643869"), null);
  assert.equal(extractNtstDcmIdFromSourceId("안건번호-문자열"), null);
});

test("일련번호 경로의 거절 안내가 새 전문 경로(원문링크를 source_id 로)를 가리킨다", () => {
  for (const [key, d] of Object.entries(CGM_EXPC_DESCRIPTORS)) {
    assert.ok(d.detailUnavailable, `${key}`);
    assert.match(String(d.detailUnavailable), /source_id/, `${key}: 새 경로 안내가 있어야 한다`);
  }
  assert.match(String(SOURCE_DESCRIPTORS.ntsExpc.detailUnavailable), /원문링크/);
});
