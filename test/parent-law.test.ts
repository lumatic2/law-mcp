import assert from "node:assert/strict";
import test from "node:test";
import { missingParentNames, parentLawName } from "../src/parent-law.js";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

/**
 * UD4 step-1 — 본법 승격 계약 테스트.
 *
 * 이 기능의 위험은 **없는 법을 만들어 내는 것**이다. 이름 규칙으로 복원한 문자열은 실재하는
 * 법령이라는 보장이 없고, 그대로 반환하면 HTTP 200 짜리 거짓말이 된다(UD0 와 같은 부류).
 * 그래서 "복원 규칙"과 "존재 확인"을 따로 잠근다.
 */

test("하위법령 이름에서 본법명을 복원한다", () => {
  assert.equal(parentLawName("부가가치세법 시행령"), "부가가치세법");
  assert.equal(parentLawName("부가가치세법 시행규칙"), "부가가치세법");
  assert.equal(
    parentLawName("남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 시행령"),
    "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률",
  );
});

test("하위법령이 아니면 복원하지 않는다", () => {
  for (const name of ["민법", "형법", "행정절차법", "국세기본법"]) {
    assert.equal(parentLawName(name), null);
  }
});

test("접미사만 있는 이름은 복원하지 않는다", () => {
  assert.equal(parentLawName("시행령"), null, "본법명이 빈 문자열이 된다");
  assert.equal(parentLawName("  시행규칙  "), null);
});

test("본법이 이미 목록에 있으면 승격 대상이 아니다", () => {
  assert.deepEqual(missingParentNames(["부가가치세법", "부가가치세법 시행령"]), []);
});

test("같은 본법을 가리키는 하위법령이 여럿이면 한 번만 센다", () => {
  assert.deepEqual(
    missingParentNames(["부가가치세법 시행령", "조세특례제한법", "부가가치세법 시행규칙"]),
    ["부가가치세법"],
  );
});

test("승격 순서는 upstream 순위를 따른다", () => {
  assert.deepEqual(
    missingParentNames(["고용보험법 시행규칙", "남녀고용평등법 시행령"]),
    ["고용보험법", "남녀고용평등법"],
  );
});

// ── provider 결선 ──

/**
 * 사다리·부스트·aiSearch 를 모두 재우고 본법 승격만 남긴 provider.
 *
 * `ladder` = 검색이 돌려주는 목록, `existing` = upstream 에 **실재하는** 법령명.
 * 이 둘을 한 배열로 두면 존재 확인이 항상 성공해 "없는 법을 만들어 내는" 경로를 못 잰다.
 */
function makeProvider(ladder: string[], existing: string[] = [], onLookup?: (query: string) => void) {
  const provider = new LawGoProvider(
    { searchTerm: async () => ({}), fetchLinkedArticles: async () => ({}) },
    async () => ({}),
    async () => ({}),
  );
  let first = true;
  (provider as unknown as { fetchLawSearchOnce: unknown }).fetchLawSearchOnce = async (query: string) => {
    onLookup?.(query);
    if (first) {
      first = false;
      return {
        items: ladder.map((name, index) => ({
          law_id: `${index}`,
          law_name: name,
          match_type: "contains" as const,
        })),
        total: ladder.length,
      };
    }
    // 이후 호출 = 본법 존재 확인. 실재 목록에 있을 때만 exact 로 답한다.
    return existing.includes(query)
      ? { items: [{ law_id: "999", law_name: query, match_type: "exact" as const }], total: 1 }
      : { items: [], total: 0 };
  };
  return provider;
}

test("하위법령만 나왔으면 근거 본법을 함께 싣는다", async () => {
  const provider = makeProvider(["부가가치세법 시행령", "조세특례제한법"], ["부가가치세법"]);

  const result = await provider.searchLaw("매입세액 불공제 대상", { limit: 3 });

  assert.equal(result.items[0].law_name, "부가가치세법");
  assert.match(result.warnings?.join(" ") ?? "", /근거 본법/);
});

// ★ 이걸 안 지키면 없는 법을 그럴듯하게 반환한다 — UD0 와 같은 부류의 조용한 오답.
test("실재하지 않는 본법은 싣지 않는다", async () => {
  // 존재 확인 조회가 exact 를 못 찾는 상황(= 그런 본법이 없다).
  const provider = makeProvider(["○○에 관한 규정 시행령", "민법"], []);

  const result = await provider.searchLaw("아무거나", { limit: 3 });

  assert.ok(
    !result.items.some((item) => item.law_name === "○○에 관한 규정"),
    "이름 규칙만 믿고 넣으면 안 된다",
  );
});

test("조회가 실패해도 기존 결과를 그대로 돌려준다", async () => {
  const provider = makeProvider(["부가가치세법 시행령", "조세특례제한법"], ["부가가치세법"]);
  (provider as unknown as { lookupExactLaw: unknown }).lookupExactLaw = async () => {
    throw new Error("HTTP 503");
  };

  const result = await provider.searchLaw("매입세액 불공제 대상", { limit: 3 }).catch(() => null);

  assert.ok(result, "보조 보정이 검색을 죽이면 안 된다");
});

// 비용 예산: 검색 1회당 추가 호출 ≤1
test("본법 후보가 여럿이어도 조회는 한 번만 한다", async () => {
  const lookups: string[] = [];
  const provider = makeProvider(
    ["고용보험법 시행규칙", "남녀고용평등법 시행령"],
    ["고용보험법", "남녀고용평등법"],
    (query) => lookups.push(query),
  );

  await provider.searchLaw("육아휴직 신청 요건과 기간", { limit: 3 });

  // 사다리 1회 + 본법 확인 1회 = 2. 본법 후보는 2개지만 확인은 1번뿐이다.
  assert.equal(lookups.length, 2, `추가 호출 ≤1 (실제: ${lookups.join(", ")})`);
});

test("같은 본법을 다시 물으면 캐시를 쓴다", async () => {
  const lookups: string[] = [];
  const provider = makeProvider(["부가가치세법 시행령"], ["부가가치세법"], (query) => lookups.push(query));

  await provider.searchLaw("매입세액 불공제 대상", { limit: 3 });
  await provider.searchLaw("세금계산서 발급 시기", { limit: 3 });

  assert.equal(lookups.filter((q) => q === "부가가치세법").length, 1);
});

// UD0 회귀 — 순위를 바꾸는 변경은 그 순위를 입력으로 쓰는 도구까지 회귀 범위다.
test("법령명 조회 경로는 본법 승격을 타지 않는다", async () => {
  const provider = makeProvider(["민법 시행령"], ["민법"]);

  const result = await provider.searchLaw("민법 시행령", {
    limit: 10,
    termBoost: { enabled: false },
    aiSearch: { enabled: false },
    parentLaw: { enabled: false },
  });

  assert.ok(
    result.items[0].law_name !== "민법",
    "'민법 시행령' 을 물었는데 '민법' 이 1위면 다른 법의 조문을 반환하게 된다",
  );
});
