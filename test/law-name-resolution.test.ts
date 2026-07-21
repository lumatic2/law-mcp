import assert from "node:assert/strict";
import test from "node:test";
import { pickLawByName, pickLawIdByName } from "../src/providers/lawgo-provider.js";

/**
 * UD0 회귀 테스트 — 법령명으로 부른 조회가 **다른 법**을 가리키면 안 된다.
 *
 * 실제 사고(2026-07-21 재현): LB5 용어 연계 부스트가 `민법` 검색의 1위를 새마을금고법으로
 * 바꿨고, `resolveLawId` 가 `items[0]` 을 쓰는 바람에 `get_law_article("민법","제245조")` 가
 * 새마을금고법 조문을 HTTP 200 으로 반환했다. 오류가 아니라 **틀린 답**이라 아무도 못 봤다.
 *
 * 이 사고가 LB5 의 "새로 깨지는 쿼리 0" 게이트를 통과한 이유: 그 측정은 `search_law` 순위만 봤고,
 * 순위가 **다른 도구의 입력**이 된다는 걸 보지 않았다. 그래서 이름 조회를 따로 고정한다.
 */

test("법령명 조회는 정확일치를 고른다 — 부스트가 앞세운 다른 법이 아니라", () => {
  // 실측된 순서 그대로: `민법` 검색에 부스트가 개입하면 새마을금고법이 1위로 온다.
  const boosted = [
    { law_id: "111", law_name: "새마을금고법", match_type: "contains" },
    { law_id: "222", law_name: "수의사법", match_type: "contains" },
    { law_id: "001706", law_name: "민법", match_type: "exact" },
  ];

  assert.equal(pickLawIdByName(boosted), "001706");
});

test("정확일치가 없으면 prefix 를 고른다", () => {
  const items = [
    { law_id: "111", law_name: "광업법", match_type: "contains" },
    { law_id: "001363", law_name: "행정심판법 시행령", match_type: "prefix" },
  ];

  assert.equal(pickLawIdByName(items), "001363");
});

// 신호가 아무것도 없을 때만 첫 항목으로 떨어진다 — 기존 동작 보존.
test("정확일치도 prefix 도 없으면 첫 항목으로 떨어진다", () => {
  const items = [
    { law_id: "111", law_name: "가나다법", match_type: "contains" },
    { law_id: "222", law_name: "라마바법", match_type: "contains" },
  ];

  assert.equal(pickLawIdByName(items), "111");
});

// 정확일치가 뒤쪽에 있어도 잡아야 한다 — 부스트는 앞자리를 여러 개 채울 수 있다.
test("정확일치가 목록 끝에 있어도 찾는다", () => {
  const items = [
    { law_id: "1", law_name: "보호소년 등의 처우에 관한 법률", match_type: "contains" },
    { law_id: "2", law_name: "근로기준법 시행령", match_type: "prefix" },
    { law_id: "001872", law_name: "근로기준법", match_type: "exact" },
  ];

  assert.equal(pickLawIdByName(items), "001872");
});

// UD4 step-3 — dist 스모크에서 적발한 기존 결함(near-miss).
// `민법 시행령` 은 실재하지 않는데 `난민법 시행령` 이 그 문자열을 포함해 조용히 집힌다.
// 폴백 자체는 `부가가치세` → `부가가치세법` 같은 조회를 살리므로 없애지 않고, **조용하지 않게** 만든다.
test("정확일치·prefix 가 없으면 어느 법으로 해석했는지 알려준다", () => {
  const picked = pickLawByName([
    { law_id: "111", law_name: "난민법 시행령", match_type: "contains" },
  ]);

  assert.equal(picked.loose, true);
  assert.equal(picked.resolvedName, "난민법 시행령");
});

/**
 * F20 근본 수리 (2026-07-21) — 경고만으로는 부족했다. 소비 LLM 은 경고를 읽어도 조문 본문을
 * 그대로 인용한다. 이름이 **우연히 겹쳤을 뿐**인 경우를 거절로 승격한다.
 *
 * 사고와 정당한 느슨함을 가르는 선은 실측으로 정했다 (`bench` 이름 해석 프로브):
 *   사고  — 반환 이름이 요청을 부분문자열로 품되 앞에서 시작하지 않음 (난민법 시행령 ⊃ 민법 시행령)
 *   정당  — 약칭은 요청을 부분문자열로 품지 않음 (독점규제…법률 ⊅ 공정거래법)
 */
test("이름이 우연히 겹쳤을 뿐이면 사고로 표시한다 — 민법 시행령 → 난민법 시행령", () => {
  const picked = pickLawByName(
    [{ law_id: "111", law_name: "난민법 시행령", match_type: "contains" }],
    "민법 시행령",
  );

  assert.equal(picked.accidental, true);
});

test("같은 사고 — 상법 시행령 → 기상법 시행령", () => {
  const picked = pickLawByName(
    [{ law_id: "111", law_name: "기상법 시행령", match_type: "contains" }],
    "상법 시행령",
  );

  assert.equal(picked.accidental, true);
});

test("공백만 다른 것도 같은 이름으로 본다", () => {
  const picked = pickLawByName(
    [{ law_id: "111", law_name: "난민법시행령", match_type: "contains" }],
    "민법 시행령",
  );

  assert.equal(picked.accidental, true);
});

// 정당한 약칭은 그대로 살린다 — 이 셋이 죽으면 수리가 과잉이다.
test("약칭 해석은 사고가 아니다 — 공정거래법 → 독점규제 및 공정거래에 관한 법률", () => {
  const picked = pickLawByName(
    [{ law_id: "111", law_name: "독점규제 및 공정거래에 관한 법률", match_type: "contains" }],
    "공정거래법",
  );

  assert.equal(picked.loose, true);
  assert.equal(picked.accidental, false);
});

test("약칭 해석은 사고가 아니다 — 형법 시행령 → 형의 집행 및 수용자의 처우에 관한 법률 시행령", () => {
  const picked = pickLawByName(
    [{ law_id: "111", law_name: "형의 집행 및 수용자의 처우에 관한 법률 시행령", match_type: "contains" }],
    "형법 시행령",
  );

  assert.equal(picked.accidental, false);
});

// upstream 이 prefix 를 표시하지 않아도 이름이 요청으로 시작하면 사고가 아니다.
test("요청으로 시작하는 후보가 있으면 그것을 고르고 사고로 보지 않는다", () => {
  const picked = pickLawByName(
    [
      { law_id: "999", law_name: "외국인관광객 등에 대한 부가가치세 특례규정", match_type: "contains" },
      { law_id: "111", law_name: "부가가치세법", match_type: "contains" },
    ],
    "부가가치세",
  );

  assert.equal(picked.lawId, "111");
  assert.equal(picked.accidental, false);
});

// 요청 이름을 안 주면 판정할 수 없다 — 기존 호출자(`pickLawIdByName`) 동작 보존.
test("요청 이름이 없으면 사고 판정을 하지 않는다", () => {
  const picked = pickLawByName([{ law_id: "111", law_name: "난민법 시행령", match_type: "contains" }]);

  assert.equal(picked.loose, true);
  assert.equal(picked.accidental, false);
});

test("정확일치가 있으면 느슨한 해석이 아니다", () => {
  const picked = pickLawByName([
    { law_id: "222", law_name: "난민법 시행령", match_type: "contains" },
    { law_id: "111", law_name: "민법", match_type: "exact" },
  ]);

  assert.equal(picked.loose, false);
  assert.equal(picked.lawId, "111");
});
