/**
 * TV7 step-1 — 신호 확장의 **비용**을 잰다.
 *
 * 이 milestone 의 전제는 "추가 HTTP 호출 0, 같은 호출의 파라미터만 바꾼다" 이다.
 * 전제가 맞아도 응답이 3배 커지면 지연이 늘 수 있으므로, plan 의 예산
 * (**TV4 기본 대비 +200ms 이내**)을 실제로 확인한다.
 *
 * 실패 프로브도 함께 본다 — `aiSearch` 가 죽었을 때 검색이 살아 있는가.
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { AI_SEARCH_DISPLAY, lookupAiSearch } from "../src/ai-search.js";

const QUERIES = [
  "수정신고 할 수 있는 경우",
  "심판청구 청구기간",
  "세금계산서 지연발급 가산세",
  "1세대 1주택 비과세 요건",
  "배우자 상속공제 한도",
  "연구인력개발비 세액공제",
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measure(display: number): Promise<number[]> {
  const times: number[] = [];
  for (const query of QUERIES) {
    const started = Date.now();
    // 캐시를 주지 않는다 — 매번 실제 호출을 재야 비용이 보인다.
    await lookupAiSearch(query, undefined, undefined, display);
    times.push(Date.now() - started);
  }
  return times;
}

async function main() {
  console.log("=== aiSearch 조회 비용 (교차 측정) ===");
  // 드리프트 방어: 쿼리마다 두 폭을 연달아 재는 게 이상적이나, 여기선 왕복 2회로 갈음한다.
  const a10 = await measure(10);
  const a30 = await measure(AI_SEARCH_DISPLAY);
  const b10 = await measure(10);
  const b30 = await measure(AI_SEARCH_DISPLAY);

  const d10 = median([...a10, ...b10]);
  const d30 = median([...a30, ...b30]);
  console.log(`  display=10  중앙 ${d10}ms`);
  console.log(`  display=30  중앙 ${d30}ms`);
  console.log(`  차이 ${d30 - d10>= 0 ? "+" : ""}${d30 - d10}ms  (예산 +200ms)`);

  console.log("\n=== 검색 1회 지연 (실제 표면) ===");
  const provider = new LawGoProvider();
  const searchTimes: number[] = [];
  for (const query of QUERIES) {
    const started = Date.now();
    await provider.searchLaw(query, { limit: 10 });
    searchTimes.push(Date.now() - started);
  }
  console.log(`  중앙 ${median(searchTimes)}ms · 최대 ${Math.max(...searchTimes)}ms`);

  console.log("\n=== 실패 프로브 — aiSearch 가 죽어도 검색이 사는가 ===");
  const broken = new LawGoProvider(undefined, undefined, async () => {
    throw new Error("aiSearch HTTP 503");
  });
  const result = await broken.searchLaw("수정신고 할 수 있는 경우", { limit: 3 });
  console.log(`  결과 ${result.items.length}건 — ${result.items.map((i) => i.law_name).join(" / ")}`);
  if (result.items.length === 0) {
    console.log("  ⚠ aiSearch 실패가 검색을 죽였다");
    process.exitCode = 1;
  }
}

void main();
