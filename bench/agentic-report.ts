/**
 * 집계 리포터 (AR1 step-3).
 *
 * 채점 결과(`CaseScore[]`)를 **반복 축**으로 접어 지표를 낸다. 단발 측정으로는 채택·기각을
 * 판정하지 않는다는 규율(`CLAUDE.local.md` 측정 규율)을 **기계로 강제한다** —
 * 반복이 1회뿐인 입력은 거부한다.
 *
 * 지표:
 *  · `SR@1`   **첫 질의**로 찾은 비율 — 다시 물어야 했다면 그건 마찰이다. 채택 판정의 주 지표.
 *             (축은 검색 횟수다. 총 턴이 아니다 — `agentic-baseline.ts` 의 정의 메모 참조.)
 *  · `SR@t`   t턴 이내 누적 성공률 — 마찰이 어디서 풀리는지 보여준다.
 *  · `pass@k` k회 중 **한 번이라도** 성공 — 능력의 상한.
 *  · `pass^k` k회 **전부** 성공 — 신뢰성. τ-bench 의 그 지표다. 상한과 벌어지면 불안정하다.
 *  · `AT`     성공 케이스의 평균 **검색** 횟수.
 *  · 기권 정밀도/재현율 — **둘 다** 낸다. 재현율만 보면 "항상 모르겠다"가 만점을 받는다.
 */
import type { CaseScore } from "./agentic-score.js";

export type Report = {
  cases: number;
  repeats: number;
  sr_at_1: number;
  sr_at_t: number[];
  pass_at_k: number;
  pass_pow_k: number;
  avg_turns_on_success: number | null;
  silence_rate: number;
  abstain_precision: number | null;
  abstain_recall: number | null;
  per_case: Array<{ case_id: string; hits: number; repeats: number; min_turns: number | null }>;
};

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

/**
 * 케이스별로 묶어 집계한다.
 *
 * @throws 반복이 1회인 케이스가 있으면 던진다 — 단발 판정 금지를 기계로 막는다.
 */
export function buildReport(allScores: CaseScore[], maxTurn = 6): Report {
  if (allScores.length === 0) throw new Error("채점 결과가 비어 있다");

  // ⚠ **기권 케이스를 정답률 축에서 뺀다** (2026-07-23 실측에서 적발한 내 리포터 결함).
  //
  // 기권 케이스는 정답이 없으므로 `correct` 가 영원히 false 다. 그대로 섞으면 **옳게 기권해도
  // pass@k 를 깎아** 정답률이 구조적으로 상한을 못 넘는다(기권 4/24 면 최대 83.3%).
  // 실제로 첫 집계에서 pass@3 83.3% 가 나왔는데 정답 케이스만 보면 100% 였다.
  // 기권은 **별도 축**(정밀도/재현율)으로 이미 재고 있으므로 여기서 두 번 벌주면 안 된다.
  const abstainScores = allScores.filter((s) => s.abstain_correct || s.expect_abstain === true);
  const scores = allScores.filter((s) => !abstainScores.includes(s));
  if (scores.length === 0) throw new Error("정답 케이스가 하나도 없다 — 정답률을 낼 수 없다");

  const byCase = new Map<string, CaseScore[]>();
  for (const s of scores) {
    const list = byCase.get(s.case_id) ?? [];
    list.push(s);
    byCase.set(s.case_id, list);
  }

  const single = [...byCase.entries()].filter(([, runs]) => runs.length < 2);
  if (single.length > 0) {
    throw new Error(
      `반복 1회짜리 케이스가 ${single.length}건 있다 (${single.slice(0, 3).map(([id]) => id).join(", ")}…). `
      + "단일 측정으로 채택·기각을 판정하지 않는다 — 최소 2회 반복 입력을 달라.",
    );
  }

  const repeats = Math.min(...[...byCase.values()].map((r) => r.length));

  let passAtK = 0;
  let passPowK = 0;
  const perCase: Report["per_case"] = [];
  for (const [caseId, runs] of byCase) {
    const hits = runs.filter((r) => r.correct).length;
    if (hits > 0) passAtK += 1;
    if (hits === runs.length) passPowK += 1;
    const winners = runs.filter((r) => r.correct).map((r) => r.turn_count);
    perCase.push({
      case_id: caseId,
      hits,
      repeats: runs.length,
      min_turns: winners.length > 0 ? Math.min(...winners) : null,
    });
  }

  // SR@t — 실행(케이스×반복) 단위. t턴 이내에 맞힌 실행의 비율.
  const srAtT: number[] = [];
  for (let t = 1; t <= maxTurn; t += 1) {
    srAtT.push(pct(scores.filter((s) => s.correct && s.turn_count <= t).length, scores.length));
  }

  const successes = scores.filter((s) => s.correct);
  const avgTurns = successes.length > 0
    ? Math.round((successes.reduce((a, s) => a + s.turn_count, 0) / successes.length) * 100) / 100
    : null;

  // 기권 정밀도 = 기권한 것 중 옳게 기권한 비율 / 재현율 = 기권했어야 할 것 중 기권한 비율.
  // 기권 축은 **전체 집합**으로 잰다 — 정답 케이스에서 잘못 기권한 것도 정밀도를 깎아야 한다.
  const abstained = allScores.filter((s) => s.abstained);
  const shouldAbstain = allScores.filter((s) => s.expect_abstain);
  const abstainPrecision = abstained.length > 0
    ? pct(abstained.filter((s) => s.abstain_correct).length, abstained.length)
    : null;
  const abstainRecall = shouldAbstain.length > 0
    ? pct(allScores.filter((s) => s.abstain_correct).length, shouldAbstain.length)
    : null;

  return {
    cases: byCase.size,
    repeats,
    sr_at_1: srAtT[0] ?? 0,
    sr_at_t: srAtT,
    pass_at_k: pct(passAtK, byCase.size),
    pass_pow_k: pct(passPowK, byCase.size),
    avg_turns_on_success: avgTurns,
    silence_rate: pct(scores.filter((s) => s.silent).length, scores.length),
    abstain_precision: abstainPrecision,
    abstain_recall: abstainRecall,
    per_case: perCase.sort((a, b) => a.hits - b.hits || a.case_id.localeCompare(b.case_id)),
  };
}

export function formatReport(r: Report): string {
  const lines = [
    `케이스 ${r.cases} × 반복 ${r.repeats}`,
    "",
    `SR@1 (첫 질의 성공률) ${r.sr_at_1}%`,
    `SR@t 누적           ${r.sr_at_t.map((v, i) => `t${i + 1}:${v}%`).join("  ")}`,
    `pass@${r.repeats} (한 번이라도) ${r.pass_at_k}%`,
    `pass^${r.repeats} (전부)       ${r.pass_pow_k}%`,
    `AT (성공 시 평균질의) ${r.avg_turns_on_success ?? "—"}`,
    `침묵률              ${r.silence_rate}%`,
    `기권 정밀도/재현율  ${r.abstain_precision ?? "—"}% / ${r.abstain_recall ?? "—"}%`,
  ];
  const gap = r.pass_at_k - r.pass_pow_k;
  if (gap > 0) {
    lines.push("", `⚠ pass@k − pass^k = ${Math.round(gap * 10) / 10}%p — 그만큼은 **불안정한 성공**이다.`);
  }
  const flaky = r.per_case.filter((c) => c.hits > 0 && c.hits < c.repeats);
  if (flaky.length > 0) {
    lines.push(`   흔들리는 케이스: ${flaky.map((c) => `${c.case_id}(${c.hits}/${c.repeats})`).join(", ")}`);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────

function selftest(): void {
  const mk = (case_id: string, correct: boolean, turn_count: number, over: Partial<CaseScore> = {}): CaseScore => ({
    case_id, agent: "f", correct, abstained: false, silent: false, wrong: !correct,
    abstain_correct: false, expect_abstain: false, turn_count, stop: "submitted", detail: "", ...over,
  });

  const probes: Array<[string, boolean, string]> = [];

  // ① 단발 입력 거부 — 이 리포터의 핵심 규율.
  let refused = false;
  let msg = "";
  try { buildReport([mk("a", true, 1)]); } catch (e) { refused = true; msg = (e as Error).message.slice(0, 40); }
  probes.push(["① 반복 1회 입력 거부", refused, msg]);

  // ② pass@k 와 pass^k 가 갈린다 — 2회 중 1회만 성공한 케이스.
  const r = buildReport([
    mk("a", true, 1), mk("a", true, 1),
    mk("b", true, 2), mk("b", false, 3),
    mk("c", false, 3), mk("c", false, 3),
  ]);
  probes.push([
    "② pass@k(66.7) > pass^k(33.3)",
    r.pass_at_k === 66.7 && r.pass_pow_k === 33.3,
    `pass@k=${r.pass_at_k} pass^k=${r.pass_pow_k}`,
  ]);

  // ③ SR@1 은 1턴 성공만 센다 — 2턴 성공은 마찰이지 성공이 아니다.
  probes.push(["③ SR@1 은 1턴만", r.sr_at_1 === 33.3, `SR@1=${r.sr_at_1}% (a 2건만)`]);

  // ④ SR@t 는 누적이라 단조 증가한다.
  const mono = r.sr_at_t.every((v, i) => i === 0 || v >= r.sr_at_t[i - 1]);
  probes.push(["④ SR@t 단조 증가", mono, r.sr_at_t.join(" ≤ ")]);

  // ⑤ 기권 재현율만 보면 "항상 기권"이 만점 — 정밀도가 같이 나와야 한다.
  //    a = 기권해야 할 케이스에서 옳게 기권 / b = 정답이 있는데 기권(남발).
  //    b 가 정답률 축에 남아야 하므로 expect_abstain 을 켜지 않는다.
  const alwaysAbstain = buildReport([
    mk("a", false, 1, { abstained: true, abstain_correct: true, wrong: false, expect_abstain: true }),
    mk("a", false, 1, { abstained: true, abstain_correct: true, wrong: false, expect_abstain: true }),
    mk("b", false, 1, { abstained: true, abstain_correct: false, wrong: false }),
    mk("b", false, 1, { abstained: true, abstain_correct: false, wrong: false }),
  ]);
  probes.push([
    "⑤ 기권 정밀도가 남발을 적발",
    alwaysAbstain.abstain_precision === 50 && alwaysAbstain.abstain_recall === 100,
    `정밀도 ${alwaysAbstain.abstain_precision}% / 재현율 ${alwaysAbstain.abstain_recall}%`,
  ]);

  // ⑥ 옳은 기권이 정답률을 깎지 않는다 — 2026-07-23 실측에서 적발한 결함의 회귀 방어.
  const withAbstain = buildReport([
    mk("a", true, 1), mk("a", true, 1),
    mk("z", false, 1, { abstained: true, abstain_correct: true, wrong: false, expect_abstain: true }),
    mk("z", false, 1, { abstained: true, abstain_correct: true, wrong: false, expect_abstain: true }),
  ]);
  probes.push([
    "⑥ 옳은 기권은 pass@k 를 안 깎는다",
    withAbstain.pass_at_k === 100 && withAbstain.cases === 1 && withAbstain.abstain_recall === 100,
    `pass@k=${withAbstain.pass_at_k}% 정답케이스=${withAbstain.cases} 기권재현율=${withAbstain.abstain_recall}%`,
  ]);

  let failed = 0;
  for (const [name, ok, detail] of probes) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  — ${detail}`);
  }
  console.log("");
  console.log(formatReport(r));
  console.log(failed === 0 ? `\nPASS — 집계 규칙 ${probes.length}종 전부 통과` : `\nFAIL — ${failed}건 실패`);
  if (failed > 0) process.exit(1);
}

if (process.argv.includes("--selftest")) selftest();
