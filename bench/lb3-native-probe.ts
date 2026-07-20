/**
 * LB3 step-3 보조 측정 — 법원별 "그 법원에 물을 법한" 대표 쿼리로 재본다.
 *
 * 골든셋 측정이 불공정한 이유: 골든셋은 "쟁점 → 법령" 쿼리라 애초에 법령 도구를 겨냥한다.
 * 이 법원 도구들은 소비 LLM 이 "헌재가 뭐라 했나" 처럼 **법원을 콕 집어** 부를 때 호출된다.
 * 그래서 여기서는 이름(제목) 매칭 단계에서 잡히는지를 본다 — 폴백으로 내려간 결과는
 * 가나다순 앞부분일 뿐이라 기여로 세지 않는다.
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { SOURCE_DESCRIPTORS } from "../src/providers/source-adapter.js";

const QUERIES: Record<string, string[]> = {
  expc: ["도로점용허가", "학교환경위생정화구역", "건축허가 요건", "인허가 의제", "지방자치단체 보조금"],
  detc: ["명예훼손", "양심적 병역거부", "사형제", "재산권 침해", "표현의 자유"],
  decc: ["정보공개", "영업정지처분", "운전면허 취소", "과징금 부과", "산업재해보상"],
  ordin: ["주차장 조례", "주민참여예산", "청년기본조례", "도시공원", "폐기물 처리 수수료"],
  lstrm: ["공소시효", "정당방위", "부당해고", "임대차", "과세표준"],
};

for (const [target, queries] of Object.entries(QUERIES)) {
  const provider = new LawGoProvider();
  let nameHits = 0;
  console.log(`\n##### ${SOURCE_DESCRIPTORS[target].label} (${target})`);
  for (const q of queries) {
    const r = await provider.searchLegalSource(target, q, { limit: 3 });
    const fellBack = (r.warnings ?? []).length > 0;
    if (!fellBack && r.items.length > 0) nameHits += 1;
    const mark = fellBack ? "폴백" : r.items.length > 0 ? "이름매칭" : "0건";
    console.log(`  [${mark}] "${q}" total=${r.total}`);
    r.items.slice(0, 2).forEach((i) => console.log(`      - ${String(i.title).slice(0, 78)}`));
  }
  console.log(`  => 이름매칭 도달 ${nameHits}/${queries.length}`);
}
