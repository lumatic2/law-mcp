import assert from "node:assert/strict";
import test from "node:test";
import { pickLawIdByName } from "../src/providers/lawgo-provider.js";

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
