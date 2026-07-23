/**
 * 맥락 도달성 점검 (TF2 step-2).
 *
 * **에이전트 세션의 대체재가 아니다.** 이건 훨씬 작은 질문 하나만 답한다 —
 * **내가 쓴 맥락이 애초에 풀 수 있는 문제인가.** 맥락을 그대로 검색에 던져 정답 법령이
 * 상위에 나오는지 본다. 나오면 최소한 "도달 가능한 문제"이고, 안 나와도 곧바로 불량은
 * 아니다(어휘 공백이 큰 어려운 케이스일 수 있다) — 다만 **어느 쪽인지 사람이 봐야 할
 * 목록**이 여기서 나온다.
 *
 * 에이전트는 재질의·본문확인을 하므로 실제 성능은 이보다 높다. 이 수치를 성능으로 읽지 마라.
 *
 * 사용: npx tsx bench/context-reachability.ts [--split dev] [--only-new]
 */
import { readFileSync } from "node:fs";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

type Case = {
  case_id: string;
  split: string;
  context: string | null;
  expected_laws: string[] | null;
  expected_article: string | null;
  expect_abstain?: boolean;
  context_origin?: string;
};

function get(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const split = get("--split") ?? "dev";
  const onlyNew = process.argv.includes("--only-new");
  const data = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8")) as {
    items: Case[];
  };
  const cases = data.items.filter(
    (c) =>
      c.split === split
      && c.context?.trim()
      && !c.expect_abstain
      && (!onlyNew || c.context_origin === "TF2-authored"),
  );

  const misses: Case[] = [];
  let hit1 = 0;
  let hit3 = 0;
  for (const [i, c] of cases.entries()) {
    const provider = new LawGoProvider();
    let returned: string[] = [];
    try {
      const res = await provider.searchLaw(c.context!, { limit: 3 });
      returned = res.items.map((it) => it.law_name);
    } catch (e) {
      returned = [`ERROR: ${(e as Error).message}`];
    }
    const want = c.expected_laws ?? [];
    const at1 = returned.slice(0, 1).some((r) => want.some((w) => r.includes(w) || w.includes(r)));
    const at3 = returned.slice(0, 3).some((r) => want.some((w) => r.includes(w) || w.includes(r)));
    if (at1) hit1 += 1;
    if (at3) hit3 += 1;
    else misses.push(c);
    const mark = at1 ? "HIT1" : at3 ? "HIT3" : "MISS";
    console.log(`[${i + 1}/${cases.length}] ${mark} ${c.case_id}  기대 ${want.join("/")}  ← ${returned.join(" / ")}`);
  }

  const pct = (n: number) => `${((n / cases.length) * 100).toFixed(1)}%`;
  console.log(`\n=== 요약 (${split}${onlyNew ? ", 이번에 쓴 맥락만" : ""}) ===`);
  console.log(`  대상 ${cases.length}건 · 1위 도달 ${pct(hit1)} · 3위 내 도달 ${pct(hit3)}`);
  if (misses.length > 0) {
    console.log(`\n사람이 볼 목록 — 맥락만으로 정답 법령에 못 닿은 ${misses.length}건:`);
    for (const c of misses) console.log(`  ${c.case_id}  ${c.expected_article}`);
    console.log("  맥락이 모호한지, 어휘 공백이 큰 어려운 케이스인지 하나씩 판단한다.");
  }
}

main();
