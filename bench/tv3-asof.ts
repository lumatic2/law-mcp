/**
 * TV3 step-4 — 시점 정확도 판정.
 *
 * 재는 것은 두 가지다:
 *   ① **시점 정확도** — 시점을 지정했을 때 반환 조문이 정말 그 시점 판인가.
 *   ② **조용한 현행 반환 0건** — 못 맞췄는데 현행을 슬쩍 주는 일이 없는가. 닫는 기준 3.
 *
 * ②가 이 milestone 의 존재 이유다. 시점을 지정했는데 아무 말 없이 현행이 나가면 그건
 * 기능이 없는 것보다 나쁘다 — 사용자는 그때 법으로 답을 받았다고 믿는다.
 */
import { writeFileSync } from "node:fs";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

type Case = {
  law: string;
  article: string;
  /** 지정할 시점 */
  asOf: string;
  /** 기대: 반환 조문의 시행일자가 이 값 이하여야 하고, 그 시점에 유효해야 한다 */
  mustBeOnOrBefore: string;
  note?: string;
};

// TV1 세트에서 쓰이는 법령 위주로, 유형이 겹치지 않게 뽑았다.
const CASES: Case[] = [
  { law: "소득세법", article: "제89조", asOf: "2019", mustBeOnOrBefore: "20191231" },
  { law: "소득세법", article: "제89조", asOf: "2023", mustBeOnOrBefore: "20231231" },
  { law: "소득세법", article: "제12조", asOf: "2022", mustBeOnOrBefore: "20221231" },
  { law: "법인세법", article: "제25조", asOf: "2021", mustBeOnOrBefore: "20211231" },
  { law: "법인세법", article: "제23조", asOf: "2023", mustBeOnOrBefore: "20231231" },
  { law: "부가가치세법", article: "제60조", asOf: "2022", mustBeOnOrBefore: "20221231" },
  { law: "국세기본법", article: "제45조의2", asOf: "2020", mustBeOnOrBefore: "20201231" },
  { law: "국세기본법", article: "제47조의2", asOf: "2023", mustBeOnOrBefore: "20231231" },
  { law: "상속세 및 증여세법", article: "제53조", asOf: "2022", mustBeOnOrBefore: "20221231" },
  { law: "조세특례제한법", article: "제6조", asOf: "2021", mustBeOnOrBefore: "20211231" },
];

// 해석 불가·범위 밖. 전부 **거절**되어야 하고, 조용히 현행이 오면 안 된다.
const REJECT_CASES = [
  { law: "소득세법", article: "제89조", asOf: "작년" },
  { law: "소득세법", article: "제89조", asOf: "최근" },
  { law: "소득세법", article: "제89조", asOf: "2023년 1기" },
  { law: "소득세법", article: "제89조", asOf: "1900" },
  { law: "소득세법", article: "제89조", asOf: "1955" },
];

async function main() {
  const provider = new LawGoProvider();

  // 비교 기준: 현행 시행일자. 이 값이 시점 지정 결과로 나오면 "조용한 현행 반환" 의심.
  const currentEff = new Map<string, string | undefined>();
  for (const law of [...new Set(CASES.map((c) => c.law))]) {
    const article = CASES.find((c) => c.law === law)!.article;
    const r = await provider.getLawArticle(law, article);
    currentEff.set(law, r?.effective_date);
  }

  const rows: any[] = [];
  let correct = 0;
  let silentCurrent = 0;

  console.log("=== 시점 정확도 ===");
  for (const c of CASES) {
    try {
      const r = await provider.getLawArticle(c.law, c.article, { asOf: c.asOf });
      const eff = r?.effective_date ?? null;
      const ok = Boolean(eff && eff <= c.mustBeOnOrBefore);
      // 시점을 지정했는데 현행 시행일이 그대로 나왔고 그게 기준일보다 뒤면 = 조용한 현행 반환
      const silent = Boolean(eff && eff === currentEff.get(c.law) && eff > c.mustBeOnOrBefore);
      if (ok) correct += 1;
      if (silent) silentCurrent += 1;
      rows.push({ ...c, effective_date: eff, ok, silentCurrent: silent, hasRule: Boolean(r?.as_of_rule) });
      console.log(
        `  ${ok ? "OK  " : "FAIL"} ${c.law} ${c.article} as_of=${c.asOf} → ${eff}` +
        (silent ? "  ⚠ 조용한 현행 반환" : ""),
      );
    } catch (e: any) {
      // 거절은 오답이 아니다 — 다만 정확도 분모에서 빠진다(못 준 것이지 틀린 게 아니다).
      rows.push({ ...c, effective_date: null, ok: false, rejected: true, code: e.code });
      console.log(`  REJ  ${c.law} ${c.article} as_of=${c.asOf} → ${e.code}`);
    }
  }

  console.log("\n=== 거절되어야 하는 입력 ===");
  let rejectedProperly = 0;
  for (const c of REJECT_CASES) {
    try {
      const r = await provider.getLawArticle(c.law, c.article, { asOf: c.asOf });
      console.log(`  ⚠ FAIL as_of="${c.asOf}" 가 통과했다 → effective_date=${r?.effective_date}`);
      rows.push({ ...c, rejectExpected: true, rejected: false, effective_date: r?.effective_date });
      silentCurrent += 1;
    } catch (e: any) {
      rejectedProperly += 1;
      console.log(`  OK   as_of="${c.asOf}" → ${e.code}`);
      rows.push({ ...c, rejectExpected: true, rejected: true, code: e.code });
    }
  }

  const measured = rows.filter((r) => !r.rejectExpected && !r.rejected);
  const accuracy = measured.length ? correct / measured.length : 0;

  console.log("\n=== 요약 ===");
  console.log(`  시점 정확도       ${(accuracy * 100).toFixed(1)}%  (${correct}/${measured.length})`);
  console.log(`  조용한 현행 반환  ${silentCurrent}건  ${silentCurrent === 0 ? "(닫는 기준 3 충족)" : "⚠ 기준 미달"}`);
  console.log(`  거절 정상 동작    ${rejectedProperly}/${REJECT_CASES.length}`);

  const out = {
    date: "2026-07-21",
    accuracy,
    correct,
    measured: measured.length,
    silent_current_returns: silentCurrent,
    rejected_properly: rejectedProperly,
    reject_cases: REJECT_CASES.length,
    rows,
  };
  const path = new URL("../evidence/bench/2026-07-21-tv3-asof.json", import.meta.url);
  writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`  → ${path.pathname}`);

  if (silentCurrent > 0 || rejectedProperly < REJECT_CASES.length) process.exitCode = 1;
}

void main();
