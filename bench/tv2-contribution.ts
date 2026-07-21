/**
 * TV2 step-4 — 기여도 게이트.
 *
 * 자료원을 붙였다고 좋아진 게 아니다. **대표 세무 질의에서 관련 문서가 상위에 실제로 오는가**를
 * 재고, 못 미치면 그 자료원을 채택하지 않는다(plan hard-stop: 도달률 <70% → 미채택).
 *
 * 왜 골든셋 recall 로 재지 않나: 골든셋은 **법령** 정답을 라벨링한 세트다. 심판례·예규는 정답
 * 라벨이 없다. LB3 에서 자료원 기여도를 골든셋으로 재려다 용도 불일치를 이미 배웠다.
 * 그래서 여기서는 **도달(관련 문서가 상위 3에 오는가)** 과 **표기(등급이 100% 실리는가)** 를 잰다.
 *
 * 관련성 판정: 사람이 미리 정한 키워드가 제목에 있는가. 임의 판정을 피하려고 각 질의마다
 * "이 단어가 제목에 있으면 관련 있다고 본다"를 명시했다. 느슨한 기준이지만 **일관되다**.
 */
import { writeFileSync } from "node:fs";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

type Probe = {
  /** TV1 dev 세트에서 뽑은 실무 질의 */
  query: string;
  /** 이 질의에 물어볼 자료원 */
  sources: string[];
  /** 제목에 이 중 하나가 있으면 관련 있다고 본다 */
  relevant: string[];
};

// TV1 세트의 유형을 고르게 덮도록 뽑았다(가산세·비과세·손금·불복·상속).
const PROBES: Probe[] = [
  { query: "세금계산서 지연발급 가산세", sources: ["ttDecc", "ntsExpc"], relevant: ["세금계산서", "가산세"] },
  { query: "1세대 1주택 비과세", sources: ["ttDecc", "ntsExpc"], relevant: ["1세대", "주택", "비과세"] },
  { query: "기업업무추진비 손금불산입", sources: ["ttDecc", "ntsExpc"], relevant: ["접대비", "기업업무추진비", "손금"] },
  { query: "경정청구", sources: ["ttDecc", "ntsExpc"], relevant: ["경정", "청구"] },
  { query: "증여재산공제", sources: ["ttDecc", "ntsExpc"], relevant: ["증여", "공제"] },
  { query: "부당과소신고 가산세", sources: ["ttDecc", "ntsExpc"], relevant: ["과소신고", "가산세", "부당"] },
  { query: "이행강제금", sources: ["ttDecc"], relevant: ["이행강제금"] },
  { query: "매입세액 불공제", sources: ["ttDecc", "ntsExpc"], relevant: ["매입세액", "공제"] },
];

const TOP_K = 3;
const REACH_THRESHOLD = 0.7;

type Row = {
  query: string;
  source: string;
  total: number;
  reached: boolean;
  authorityLabelled: boolean;
  dataAsOf: string | null;
  topTitles: string[];
  error?: string;
};

async function main() {
  const provider = new LawGoProvider() as any;
  const rows: Row[] = [];

  for (const probe of PROBES) {
    for (const source of probe.sources) {
      try {
        const r = await provider.searchLegalSource(source, probe.query, { limit: TOP_K });
        const items = (r.items ?? []).slice(0, TOP_K);
        const titles = items.map((i: any) => String(i.title ?? ""));
        rows.push({
          query: probe.query,
          source,
          total: r.total ?? 0,
          reached: titles.some((t) => probe.relevant.some((k) => t.includes(k))),
          // 등급 표기율 — 하나라도 비면 프리모템 ③ 이 되살아난다.
          authorityLabelled: Boolean(r.authority) && Boolean(r.authority_note),
          dataAsOf: r.data_as_of ?? null,
          topTitles: titles.map((t) => t.slice(0, 50)),
        });
      } catch (e) {
        rows.push({
          query: probe.query, source, total: 0, reached: false,
          authorityLabelled: false, dataAsOf: null, topTitles: [],
          error: (e as Error).message.slice(0, 120),
        });
      }
    }
  }

  const bySource = new Map<string, Row[]>();
  for (const row of rows) {
    if (!bySource.has(row.source)) bySource.set(row.source, []);
    bySource.get(row.source)!.push(row);
  }

  console.log(`=== TV2 기여도 게이트 (상위 ${TOP_K}, 문턱 ${REACH_THRESHOLD * 100}%) ===\n`);
  const verdicts: Array<{ source: string; reach: number; labelled: number; verdict: string }> = [];
  for (const [source, group] of bySource) {
    const scored = group.filter((g) => !g.error);
    const reach = scored.length ? scored.filter((g) => g.reached).length / scored.length : 0;
    const labelled = scored.length ? scored.filter((g) => g.authorityLabelled).length / scored.length : 0;
    // 등급 표기는 100% 가 아니면 무조건 미달이다 — 부분 표기는 표기 안 한 것과 같다.
    const verdict = reach >= REACH_THRESHOLD && labelled === 1 ? "채택" : "미달";
    verdicts.push({ source, reach, labelled, verdict });
    console.log(`[${source}] 도달 ${(reach * 100).toFixed(0)}% (${scored.filter((g) => g.reached).length}/${scored.length}) · 등급표기 ${(labelled * 100).toFixed(0)}% · 에러 ${group.length - scored.length} → ${verdict}`);
    for (const g of group) {
      const mark = g.error ? "ERR " : g.reached ? "HIT " : "MISS";
      console.log(`  ${mark} ${g.query}  (total ${g.total})`);
      if (g.error) console.log(`       ${g.error}`);
      else for (const t of g.topTitles) console.log(`       · ${t}`);
    }
    console.log("");
  }

  const out = { date: "2026-07-21", top_k: TOP_K, threshold: REACH_THRESHOLD, verdicts, rows };
  const path = new URL("../evidence/bench/2026-07-21-tv2-contribution.json", import.meta.url);
  writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`→ ${path.pathname}`);

  if (verdicts.some((v) => v.verdict === "미달")) {
    console.log("\n⚠ 미달 자료원이 있다 — plan hard-stop: 해당 자료원은 채택하지 않고 기각 근거를 남긴다.");
    process.exitCode = 1;
  }
}

void main();
