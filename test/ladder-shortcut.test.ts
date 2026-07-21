import assert from "node:assert/strict";
import test from "node:test";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

/**
 * UD4 step-2 — 사다리·보조채널 동시 실행 계약 테스트 (F19).
 *
 * 지연 꼬리의 원인은 사다리가 아니라 **보조 채널이 사다리 뒤에 줄줄이 붙어 있던 것**이었다.
 * 동시 실행은 결과를 바꾸지 않아야 한다 — 여기서 잠그는 것은 "빨라졌다"가 아니라
 * **"같은 답을 준다"** 와 **"먼저 시작한다"** 두 가지다.
 */

const LINKAGE = {
  searchTerm: async () => ({
    lstrmAISearch: { 법령용어: { 법령용어명: "부당해고", 조문간관계링크: "...MST=1" } },
  }),
  fetchLinkedArticles: async () => ({
    lstrmRltJoService: {
      법령용어: {
        연계법령: [{ 법령명: "근로기준법", 조번호: "0028", 조가지번호: "00", 용어구분: "선정용어", 조문연계용어링크: "/DRF/lawService.do?target=joRltLstrm&ID=999&JO=002800" }],
      },
    },
  }),
};

/** 사다리를 느리게 만들어, 보조 채널이 그 뒤에 붙는지 겹치는지 관측한다. */
function makeProvider(ladderDelayMs: number, order: string[]) {
  const provider = new LawGoProvider(
    {
      searchTerm: async () => { order.push("linkage-start"); return LINKAGE.searchTerm(); },
      fetchLinkedArticles: LINKAGE.fetchLinkedArticles,
    },
    async () => ({}),
    async () => { order.push("ai-start"); return {}; },
  );
  (provider as unknown as { fetchLawSearchOnce: unknown }).fetchLawSearchOnce = async () => {
    order.push("ladder-start");
    await new Promise((resolve) => setTimeout(resolve, ladderDelayMs));
    order.push("ladder-end");
    return { items: [{ law_id: "1", law_name: "상법", match_type: "contains" as const }], total: 1 };
  };
  return provider;
}

test("보조 채널은 사다리가 끝나기 전에 시작한다", async () => {
  const order: string[] = [];
  const provider = makeProvider(30, order);

  await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });

  const ladderEnd = order.indexOf("ladder-end");
  assert.ok(order.indexOf("ai-start") < ladderEnd, `aiSearch 가 사다리 뒤에 붙었다: ${order.join(" → ")}`);
  assert.ok(order.indexOf("linkage-start") < ladderEnd, `용어 연계가 사다리 뒤에 붙었다: ${order.join(" → ")}`);
});

test("동시 실행이 결과를 바꾸지 않는다", async () => {
  const concurrent = await makeProvider(0, []).searchLaw("부당해고 구제신청 기간", { limit: 3 });
  const serialish = await makeProvider(20, []).searchLaw("부당해고 구제신청 기간", { limit: 3 });

  assert.deepEqual(concurrent, serialish, "타이밍이 결과를 바꾸면 동시 실행이 아니라 경합이다");
  assert.equal(concurrent.items[0].law_name, "근로기준법", "용어 연계 부스트는 그대로 동작해야 한다");
});

// Failure probe: 프리페치가 죽어도 부스트 본체가 살아 있어야 한다
test("프리페치가 실패해도 검색은 정상이다", async () => {
  const provider = new LawGoProvider(
    {
      searchTerm: async () => { throw new Error("HTTP 503"); },
      fetchLinkedArticles: async () => { throw new Error("HTTP 503"); },
    },
    async () => ({}),
    async () => ({}),
  );
  (provider as unknown as { fetchLawSearchOnce: unknown }).fetchLawSearchOnce = async () => ({
    items: [{ law_id: "1", law_name: "상법", match_type: "contains" as const }],
    total: 1,
  });

  const result = await provider.searchLaw("부당해고 구제신청 기간", { limit: 3 });

  assert.deepEqual(result.items.map((i) => i.law_name), ["상법"]);
});

test("용어 연계를 끄면 프리페치도 안 돈다", async () => {
  const order: string[] = [];
  const provider = makeProvider(0, order);

  await provider.searchLaw("부당해고 구제신청 기간", { limit: 3, termBoost: { enabled: false } });

  assert.ok(!order.includes("linkage-start"), "끈 채널이 upstream 을 때리면 안 된다");
});
