import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_DESCRIPTORS,
  SPECIAL_DECC_DESCRIPTORS,
  extractDetail,
  extractRows,
  mapRow,
} from "../src/providers/source-adapter.js";

/**
 * TV2 step-1 — 특별행정심판 재결례 3종(조세심판원·감사원 심사청구·소청)의 계약 테스트.
 *
 * 이 자료원은 명명 규칙이 세 군데에서 깨진다. 셋 다 **틀리면 조용히 실패**하므로 고정한다:
 *   ① target 어순이 공식 문서와 반대다 (`specialDeccTt` ✗ / `ttSpecialDecc` ✓)
 *   ② 컨테이너·행 키가 target 에서 유도되지 않는다 (`Decc`/`decc`)
 *   ③ 단건 ID 가 행의 `id`(행 번호)가 아니라 `특별행정심판재결례일련번호` 다
 */

// 2026-07-21 실 API 응답에서 그대로 잘라온 fixture (본문만 축약).
const SEARCH_FIXTURE = {
  Decc: {
    target: "ttSpecialDecc",
    totalCnt: "4688",
    decc: [
      {
        id: "1",
        행정심판재결례상세링크: "/DRF/lawService.do?target=ttSpecialDecc&ID=1704&type=HTML",
        재결청: "조세심판원",
        처분청: "",
        특별행정심판재결례일련번호: "1704",
        재결구분코드: "429150",
        청구번호: "조심 2018광1070",
        의결일자: "2018.06.04",
        재결구분명: "조세",
        사건명: "10년의 국세부과의 제척기간을 적용하여 부가가치세를 부과한 처분의 당부",
        데이터기준일시: "2024.12.18",
      },
    ],
  },
};

const DETAIL_FIXTURE = {
  SpecialDeccService: {
    재결청: "조세심판원",
    청구취지: "",
    참조결정: "",
    재결요지: "청구법인이 쟁점세금계산서를 수취하여 매입세액의 공제를 받은 것은 부정한 행위에 해당",
    이유: "1. 처분개요 가. 청구법인은 조경, 식재공사를 주요 사업으로 하는 사업자이다.",
  },
};

test("조세심판원 target 은 ttSpecialDecc 다 — 공식 문서의 specialDeccTt 는 빈 응답이다", () => {
  assert.equal(SOURCE_DESCRIPTORS.ttDecc.target, "ttSpecialDecc");
  assert.equal(SOURCE_DESCRIPTORS.acrDecc.target, "acrSpecialDecc");
  assert.equal(SOURCE_DESCRIPTORS.adapDecc.target, "adapSpecialDecc");
  for (const d of Object.values(SPECIAL_DECC_DESCRIPTORS)) {
    assert.ok(
      !/^special/i.test(d.target),
      `어순이 뒤집혔다(${d.target}) — 공식 문서 표기를 보고 되돌리면 빈 응답이 된다`,
    );
  }
});

// committee() 헬퍼는 container=Cap(target)·rowKey=target 을 가정한다. 여기선 그 규칙이 깨진다.
test("컨테이너·행 키가 target 에서 유도되지 않는다 — Decc/decc 고정", () => {
  for (const [key, d] of Object.entries(SPECIAL_DECC_DESCRIPTORS)) {
    assert.equal(d.container, "Decc", `${key} 컨테이너`);
    assert.equal(d.rowKey, "decc", `${key} 행 키`);
    assert.notEqual(d.rowKey, d.target, `${key}: rowKey 를 target 으로 유도하면 0건이 된다`);
  }
});

test("검색 행에서 컨테이너를 찾아 항목을 뽑는다", () => {
  const { rows, total } = extractRows(SEARCH_FIXTURE, SOURCE_DESCRIPTORS.ttDecc);
  assert.equal(rows.length, 1);
  assert.equal(total, 4688);
  const item = mapRow(rows[0], SOURCE_DESCRIPTORS.ttDecc, 0);
  assert.equal(item.title, "10년의 국세부과의 제척기간을 적용하여 부가가치세를 부과한 처분의 당부");
  assert.equal(item.청구번호, "조심 2018광1070");
  assert.equal(item.재결청, "조세심판원");
  assert.equal(item.데이터기준일시, "2024.12.18");
});

/**
 * 가장 중요한 계약. `id` 는 행 번호(1,2,3…)라서 그걸 ID 로 넘기면 **무관한 문서가 200 으로
 * 돌아온다** — 2026-07-21 프로브에서 실제로 발생한 사고다.
 */
test("단건 ID 는 행 번호 id 가 아니라 특별행정심판재결례일련번호다", () => {
  for (const [key, d] of Object.entries(SPECIAL_DECC_DESCRIPTORS)) {
    assert.deepEqual(d.idKeys, ["특별행정심판재결례일련번호"], `${key} idKeys`);
    assert.ok(!d.idKeys.includes("id"), `${key}: 행 번호를 ID 로 쓰면 다른 문서가 온다`);
  }
  const item = mapRow(
    extractRows(SEARCH_FIXTURE, SOURCE_DESCRIPTORS.ttDecc).rows[0],
    SOURCE_DESCRIPTORS.ttDecc,
    0,
  );
  assert.equal(item.source_id, "1704", "행의 id=1 이 아니라 일련번호 1704 여야 한다");
});

test("전문에서 재결요지와 이유를 뽑는다 — 우리가 요약을 만들지 않는다", () => {
  const detail = extractDetail(DETAIL_FIXTURE, SOURCE_DESCRIPTORS.ttDecc);
  assert.match(String(detail.재결요지), /부정한 행위에 해당/);
  assert.match(String(detail.이유), /처분개요/);
  assert.equal(detail.재결청, "조세심판원");
});

test("단건 조회는 ID 파라미터를 쓴다 (MST 아님)", () => {
  for (const d of Object.values(SPECIAL_DECC_DESCRIPTORS)) {
    assert.equal(d.detail.idParam, "ID");
    assert.equal(d.detail.container, "SpecialDeccService");
  }
});

/**
 * `decc`(행정심판재결례)와 `ttDecc`(조세심판원)는 이름이 비슷하지만 **다른 컨테이너**다.
 * 하나로 묶으면 세법 질의가 통째로 사각지대가 된다 — 이게 지금까지 조세가 빠져 있던 이유다.
 */
test("decc 와 ttDecc 는 서로 다른 자료원이다 — 묶지 않는다", () => {
  assert.notEqual(SOURCE_DESCRIPTORS.decc.target, SOURCE_DESCRIPTORS.ttDecc.target);
  assert.notEqual(SOURCE_DESCRIPTORS.decc.idKeys[0], SOURCE_DESCRIPTORS.ttDecc.idKeys[0]);
  assert.equal(SOURCE_DESCRIPTORS.decc.idKeys[0], "행정심판재결례일련번호");
});

// type=HTML 은 본문 없는 JS 로더 셸(1,973B)이다. IB1b 의 NTS HTML 폴백 선례를 여기 재사용하면 안 된다.
test("HTML 폴백 경로를 쓰지 않는다 — JSON 전용", () => {
  for (const d of Object.values(SPECIAL_DECC_DESCRIPTORS)) {
    const serialized = JSON.stringify(d);
    assert.ok(!/html/i.test(serialized), `${d.target}: HTML 은 본문 없는 껍데기다`);
  }
});
