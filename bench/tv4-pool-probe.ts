/**
 * TV4 step-2 관측 — 풀 도달과 절단 경고를 **실 API 로** 확인한다.
 *
 * 두 가지를 본다:
 *   ① 겨냥한 쿼리에서 정답 법령이 후보 풀에 **들어오는가**
 *   ② `totalCnt` 가 상한을 크게 넘는 쿼리에서 **절단 경고가 실제로 발화하는가**
 *      (조용한 절단이 이 결함의 원인이었다 — 경고가 안 나오면 고친 게 아니다)
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

const CASES = [
  { query: "세금계산서 지연발급 가산세", expect: "부가가치세법" },
  { query: "수정신고 할 수 있는 경우", expect: "국세기본법" },
  { query: "심판청구 청구기간", expect: "국세기본법" },
  { query: "1세대 1주택 판정에서 1세대의 범위", expect: "소득세법 시행령" },
];

async function main() {
  const provider = new LawGoProvider();

  console.log("=== 풀 도달 · 순위 ===");
  for (const c of CASES) {
    const result = await provider.searchLaw(c.query, {
      limit: 10,
      titleSignal: { enabled: true, window: 6 },
    });
    const names = result.items.map((i) => i.law_name);
    const rank = names.indexOf(c.expect);
    const truncation = (result.warnings ?? []).find((w) => w.includes("만 확인함"));
    console.log(
      `  ${rank >= 0 ? `${rank + 1}위` : "미도달"}  ${c.query} → ${c.expect}` +
      `\n      상위3: ${names.slice(0, 3).join(" / ")}` +
      `\n      전체 ${result.total}건 · 절단경고 ${truncation ? "발화" : "없음"}`,
    );
    if (truncation) console.log(`      "${truncation}"`);
  }
}

void main();
