/**
 * 기준선 드라이버 (AR2 step-3).
 *
 * **살아있는 에이전트 세션이 낸 기록**을 트래젝토리로 바꿔 채점기·리포터에 태운다.
 * SDK 로 에이전트를 새로 호출하지 않기로 한 뒤(2026-07-22 전환), 실행은 세션이 하고
 * 채점은 코드가 한다 — 그 이음매가 이 파일이다.
 *
 * **에이전트가 누구든 상관없다**(Claude·Codex·사람). 입력 모양만 맞으면 되고, 그래야
 * 벤더 교차 비교가 공짜로 생긴다.
 *
 * ⚠ **도구가 죽어서 못 찾은 것은 기권이 아니다.** 2026-07-23 첫 블라인드 시도에서 Codex 의
 * 도구 호출이 전부 exit 1 이었는데 3건 모두 `not_found` 로 돌아왔다. 그걸 기권으로 채점하면
 * "도구가 답을 못 줬다"는 거짓 기록이 된다. 그래서 `tool_ok: false` 인 실행은 **채점하지 않고
 * 거부한다** — 무효를 0점으로 접는 것이 이 벤치가 막으려는 바로 그 왜곡이다.
 *
 * 사용: npx tsx bench/agentic-baseline.ts run1.json run2.json run3.json
 */
import { readFileSync } from "node:fs";
import { loadAgenticSet, toExpected, type AgenticCase } from "./agentic-set.js";
import { scoreAll, type CaseScore } from "./agentic-score.js";
import { buildReport, formatReport } from "./agentic-report.js";
import type { Trajectory } from "./agentic-run.js";

/** 살아있는 에이전트 세션이 돌려주는 기록의 모양. */
export type AgentRunFile = {
  /** 도구가 실제로 돌았나. `false` 면 그 실행 전체가 무효다. */
  tool_ok?: boolean;
  agent?: string;
  results: Array<{
    case_id: string;
    turns?: number;
    law_name?: string;
    article_no?: string;
    not_found?: boolean;
    queries?: string[];
    saw_vocab_warning?: boolean;
  }>;
};

export function toTrajectories(run: AgentRunFile, cases: AgenticCase[]): Trajectory[] {
  if (run.tool_ok === false) {
    throw new Error(
      "tool_ok=false — 도구가 안 돌아간 실행이다. 채점하지 않는다.\n"
      + "  도구 실패를 기권·오답으로 접으면 '도구가 답을 못 줬다'는 거짓 기록이 된다.",
    );
  }

  const byId = new Map(cases.map((c) => [c.case_id, c]));
  return run.results.map((r) => {
    const kase = byId.get(r.case_id);
    if (!kase) throw new Error(`세트에 없는 case_id: ${r.case_id}`);
    const { expected, expect_abstain } = toExpected(kase);

    // 지목도 기권도 없으면 침묵이다 — 기권과 다른 값으로 남는다.
    const declared = r.not_found === true;
    const named = Boolean(r.law_name && r.article_no);
    const submitted = declared
      ? { not_found: true }
      : named
        ? { law_name: r.law_name, article_no: r.article_no }
        : null;

    return {
      case_id: r.case_id,
      context: kase.context,
      expected,
      expect_abstain,
      agent: run.agent ?? "live-session",
      model: null,
      turns: [],
      submitted,
      stop: submitted ? "submitted" : "turn_cap",
      turn_count: r.turns ?? (r.queries?.length ?? 1),
    } as Trajectory;
  });
}

async function main(): Promise<void> {
  const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    throw new Error("실행 기록 파일을 하나 이상 달라 (반복 측정이라 보통 3개 이상)");
  }

  const cases = loadAgenticSet("dev");
  const scores: CaseScore[] = [];
  for (const path of paths) {
    const run = JSON.parse(readFileSync(path, "utf8")) as AgentRunFile;
    scores.push(...scoreAll(toTrajectories(run, cases)));
  }

  // 반복이 1회면 리포터가 거부한다 — 단발 판정 금지가 여기서도 걸린다.
  const report = buildReport(scores);
  console.log(formatReport(report));
  console.log("\n케이스별:");
  for (const c of report.per_case) {
    console.log(`  ${c.case_id}  ${c.hits}/${c.repeats}  최소턴 ${c.min_turns ?? "—"}`);
  }
}

function selftest(): void {
  const cases = loadAgenticSet("dev");
  const probes: Array<[string, boolean, string]> = [];

  // ① 도구 실패 실행은 거부한다 — 이 파일의 존재 이유.
  let refused = false;
  let msg = "";
  try {
    toTrajectories({ tool_ok: false, results: [] }, cases);
  } catch (e) {
    refused = true;
    msg = (e as Error).message.split("\n")[0];
  }
  probes.push(["① tool_ok=false 실행 거부", refused, msg]);

  // ② 정답 지목이 적중으로 채점된다.
  const hit = scoreAll(
    toTrajectories(
      { results: [{ case_id: "d02", turns: 2, law_name: "법인세법 시행령", article_no: "제44조" }] },
      cases,
    ),
  )[0];
  probes.push(["② 정답 지목 → 적중", hit.correct, hit.detail]);

  // ③ 기권 케이스에서 기권하면 옳은 기권.
  const ab = scoreAll(
    toTrajectories({ results: [{ case_id: "a01", turns: 3, not_found: true }] }, cases),
  )[0];
  probes.push(["③ 기권 케이스 기권 → 옳음", ab.abstained && ab.abstain_correct, ab.detail]);

  // ④ 기권 케이스에서 뭔가 지목하면 환각.
  const halluc = scoreAll(
    toTrajectories(
      { results: [{ case_id: "a01", turns: 2, law_name: "소득세법", article_no: "제12조" }] },
      cases,
    ),
  )[0];
  probes.push(["④ 기권 케이스 지목 → 환각", halluc.wrong, halluc.detail]);

  // ⑤ 지목도 기권도 없으면 침묵.
  const silent = scoreAll(toTrajectories({ results: [{ case_id: "d02", turns: 6 }] }, cases))[0];
  probes.push(["⑤ 무응답 → 침묵(기권 아님)", silent.silent && !silent.abstained, silent.detail]);

  let failed = 0;
  for (const [name, ok, detail] of probes) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  — ${detail}`);
  }
  console.log(failed === 0 ? `\nPASS — 드라이버 ${probes.length}종 통과` : `\nFAIL — ${failed}건`);
  if (failed > 0) process.exit(1);
}

if (process.argv.includes("--selftest")) selftest();
else {
  main().catch((e) => {
    process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
