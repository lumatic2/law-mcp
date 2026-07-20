/**
 * UD3 step-3 — 위원회 자료원 기여도 게이트.
 *
 * LB3 에서 골든셋으로 법원 기여를 재려다 **용도 불일치로 "기여 0" 착시**를 겪었다. 골든셋은
 * 쟁점→법령 쿼리라 결정문 자료원을 못 잰다. 그래서 여기서는 **자료원별 대표 쿼리**로 잰다.
 *
 * 통과 조건: 대표 쿼리 중 ≥1 건에서 검색 도달 + 그 결과의 단건 조회가 내용 있는 필드를 준다.
 * 못 넘으면 `src/index.ts` 의 enum 에서 뺀다 — 쓸 수 없는 자료원을 목록에 두면 소비 LLM 의
 * 선택 부담만 늘어난다.
 *
 *   npx tsx bench/ud3-contribution.ts
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

const REPRESENTATIVE: Array<[string, string[]]> = [
  ["nlrc", ["부당해고 구제신청", "징계해고"]],
  ["ppc", ["개인정보 유출", "주민등록번호 수집"]],
  ["nhrck", ["장애인 차별", "정년 차별"]],
  ["sfc", ["공시의무 위반", "부정거래"]],
  ["kcc", ["방송 심의", "재허가 조건"]],
  ["ecc", ["소음 피해 배상", "일조권"]],
  ["oclt", ["토지수용 재결", "보상금"]],
  ["ftc", ["입찰담합", "부당공동행위"]],
  ["baiPvcs", ["수의계약", "예산집행"]],
];

async function main() {
  const provider = new LawGoProvider();
  const rows: string[] = [];
  const failed: string[] = [];

  for (const [target, queries] of REPRESENTATIVE) {
    let reached = 0;
    let detailFields = 0;
    let sample = "";

    for (const query of queries) {
      try {
        const result = await provider.searchLegalSource(target, query, { limit: 3 });
        if (result.items.length === 0) continue;
        reached += 1;
        if (!sample) sample = result.items[0].title ?? "";

        const detail = await provider.getLegalSource(target, result.items[0].source_id);
        const filled = detail
          ? Object.entries(detail).filter(([key, value]) => value && !["source_id", "source"].includes(key)).length
          : 0;
        detailFields = Math.max(detailFields, filled);
      } catch (error) {
        // 자료원 하나의 실패가 전체 측정을 멈추지 않는다.
        sample ||= `ERR ${(error as Error).message.slice(0, 40)}`;
      }
    }

    const pass = reached > 0 && detailFields > 0;
    if (!pass) failed.push(target);
    rows.push(
      `| ${target} | ${reached}/${queries.length} | ${detailFields} | ${pass ? "**등록**" : "제외"} | ${sample.slice(0, 34)} |`,
    );
  }

  console.log("| target | 대표쿼리 도달 | 단건 필드 | 판정 | 예시 |");
  console.log("|---|---|---|---|---|");
  rows.forEach((row) => console.log(row));
  console.log(`\n제외 대상: ${failed.length === 0 ? "없음" : failed.join(", ")}`);
}

main();
