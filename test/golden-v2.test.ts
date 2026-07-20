import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * UD1 step-1 — 평가 세트 `bench/golden-v2.json` 의 계약 테스트.
 *
 * 이 세트는 horizon `upstream-delivery` 의 **판정 정본**이다. 구 `golden.json` 은 LB1~LB5 튜닝에
 * 소진돼 신뢰할 수 없다(F5). 그래서 여기서 지키는 것은 세트의 "품질"이 아니라 **오염 방지**다:
 *   ① 구 세트와 쿼리가 겹치면 소진된 튜닝이 새 수치로 새어 들어온다 → 중복 금지
 *   ② 근거 없는 라벨은 추측이다 → source 필수
 *   ③ 분할 비율이 흔들리면 dev/holdout 수치를 나란히 못 읽는다 → 25/15 고정
 */

type Item = {
  query: string;
  domain: string;
  expected_laws: string[];
  expected_article?: string;
  split: string;
  source: string;
};

function load(name: string): { items: Item[] } {
  return JSON.parse(readFileSync(new URL(`../bench/${name}.json`, import.meta.url), "utf8"));
}

const v2 = load("golden-v2");
const v1 = load("golden");

test("세트 크기와 분할 비율이 구 세트와 같다 — 수치를 나란히 읽기 위해", () => {
  assert.equal(v2.items.length, 40);
  assert.equal(v2.items.filter((i) => i.split === "dev").length, 25);
  assert.equal(v2.items.filter((i) => i.split === "holdout").length, 15);
});

// 오염 방지의 핵심. 구 세트 쿼리가 하나라도 섞이면 그 항목은 이미 튜닝에 노출된 값이다.
test("구 골든셋과 쿼리가 하나도 겹치지 않는다", () => {
  const old = new Set(v1.items.map((i) => i.query));
  const overlap = v2.items.filter((i) => old.has(i.query)).map((i) => i.query);

  assert.deepEqual(overlap, [], `구 세트와 중복된 쿼리: ${overlap.join(", ")}`);
});

test("세트 안에서도 쿼리가 중복되지 않는다", () => {
  const seen = new Set<string>();
  const dupes = v2.items.filter((i) => (seen.has(i.query) ? true : (seen.add(i.query), false)));

  assert.deepEqual(dupes.map((i) => i.query), []);
});

// 라벨 근거 없는 항목은 추측이다 — 이 세트는 실 API 로 확인한 것만 담는다.
test("모든 항목이 라벨 근거(source)를 가진다", () => {
  const missing = v2.items.filter((i) => !i.source || i.source.trim().length < 10);

  assert.deepEqual(missing.map((i) => i.query), []);
});

test("모든 항목이 정답 법령을 최소 1개 가진다", () => {
  const missing = v2.items.filter((i) => !Array.isArray(i.expected_laws) || i.expected_laws.length === 0);

  assert.deepEqual(missing.map((i) => i.query), []);
});

// 조문 라벨은 검증기가 파싱할 수 있는 형식이어야 한다("<법령명> 제N조" / "제N조의M").
test("조문 라벨은 검증 가능한 형식이다", () => {
  const bad = v2.items
    .filter((i) => i.expected_article)
    .filter((i) => !/^.+\s+제\d+조(의\d+)?$/.test(i.expected_article!));

  assert.deepEqual(bad.map((i) => i.expected_article), []);
});

// 조문 라벨의 법령은 expected_laws 안에 있어야 한다 — 라벨 두 축이 서로 어긋나면 채점이 무의미하다.
test("조문 라벨의 법령이 expected_laws 에 들어 있다", () => {
  const mismatched = v2.items
    .filter((i) => i.expected_article)
    .filter((i) => {
      const law = i.expected_article!.replace(/\s+제\d+조(의\d+)?$/, "");
      return !i.expected_laws.includes(law);
    });

  assert.deepEqual(mismatched.map((i) => i.expected_article), []);
});

test("도메인이 5종으로 균형 잡혀 있다", () => {
  const counts = new Map<string, number>();
  for (const item of v2.items) counts.set(item.domain, (counts.get(item.domain) ?? 0) + 1);

  assert.deepEqual([...counts.keys()].sort(), ["노동", "민사", "세무", "행정", "형사"]);
  assert.deepEqual([...counts.values()], [8, 8, 8, 8, 8]);
});
