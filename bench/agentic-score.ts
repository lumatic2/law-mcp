/**
 * 결정적 채점기 (AR1 step-2).
 *
 * **LLM judge 0개.** 트래젝토리의 `submit_answer` 인자를 정답 튜플과 문자열 비교한다.
 * 같은 로그를 두 번 채점하면 반드시 같은 값이 나온다 — 그래야 "고쳤더니 올랐다" 가
 * 모델 기분이 아니라 도구 변화를 뜻한다.
 *
 * ⚠ **반드시 (법령, 조문) 튜플로 대조한다.** 조문번호 단독 비교는 실제로 틀렸다:
 * 2026-07-22 기여도 프로브에서 `제57조` 가 엉뚱한 법에서 나온 것을 적중으로 세어
 * 3/5 를 4/5 로 부풀렸다(`evidence/bench/2026-07-22-ar3-rephrasing-contribution.md`).
 * 그 결함을 채점기 수준에서 구조적으로 막는 것이 이 파일의 존재 이유다.
 *
 * 침묵(`submitted === null`)과 기권(`not_found === true`)은 **다른 결과**로 채점한다.
 * 같은 값으로 접으면 기권 정밀도/재현율(닫는 기준 5)을 잴 수 없다.
 */
import type { Trajectory } from "./agentic-run.js";

/** 채점 결과 — 한 트래젝토리당 하나. */
export type CaseScore = {
  case_id: string;
  agent: string;
  /** 정답 튜플에 도달했나. 기권·침묵은 항상 false. */
  correct: boolean;
  /** 기권을 **선언**했나 (`not_found: true`). 침묵은 false. */
  abstained: boolean;
  /** 지목도 기권도 없이 끝났나 (`submitted === null`). */
  silent: boolean;
  /** 틀린 조문을 확신 있게 지목했나 — 기권보다 나쁜 결과다. */
  wrong: boolean;
  /** 기권이 옳았나 (정답이 없는 케이스에서 기권). `expect_abstain` 이 있을 때만 의미 있다. */
  abstain_correct: boolean;
  turn_count: number;
  stop: Trajectory["stop"];
  /** 채점이 왜 그렇게 났는지 — 사람이 표본 검토할 때 읽는다. */
  detail: string;
};

/**
 * 비교용 정규화. 공백·괄호는 지우고, 그 외에는 **아무것도 하지 않는다.**
 *
 * 동의어 사전을 여기 넣고 싶어지지만 금지한다 — 채점기가 관대해지면 도구가 나아진 것과
 * 채점이 물러진 것을 구분할 수 없다. 표기 흔들림은 정답 라벨 쪽에서 잡는다.
 */
export function normalize(value: string): string {
  return value.replace(/\s+/g, "").replace(/[()（）]/g, "");
}

/**
 * 조문번호 비교. `제45조의3` / `45조의3` / `제45조의3항` 같은 표기 차이를 흡수하되,
 * **조번호와 의번호는 반드시 둘 다 일치해야 한다** — `제45조` 와 `제45조의3` 은 다른 조문이고,
 * 이 둘을 같게 보면 이 벤치의 대표 실패 사례가 통과해 버린다.
 */
export function articleKey(raw: string): string | null {
  const m = normalize(raw).match(/제?(\d+)조(?:의(\d+))?/);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
}

export function scoreTrajectory(traj: Trajectory): CaseScore {
  const base = {
    case_id: traj.case_id,
    agent: traj.agent,
    turn_count: traj.turn_count,
    stop: traj.stop,
  };

  const s = traj.submitted;

  // ① 침묵 — 도구를 부르다 말았거나 턴 상한에 걸렸다. 기권이 아니다.
  if (s === null || s === undefined) {
    return {
      ...base,
      correct: false,
      abstained: false,
      silent: true,
      wrong: false,
      abstain_correct: false,
      detail: `침묵 — submit_answer 미호출 (stop=${traj.stop})`,
    };
  }

  // ② 기권 선언
  if (s.not_found === true) {
    const right = traj.expect_abstain === true;
    return {
      ...base,
      correct: false,
      abstained: true,
      silent: false,
      wrong: false,
      abstain_correct: right,
      detail: right ? "기권 — 정답이 없는 케이스, 옳은 기권" : "기권 — 정답이 있는데 놓쳤다",
    };
  }

  // ③ 지목 — 튜플 비교
  const expected = traj.expected;
  if (!expected) {
    // 정답이 없는 케이스인데 뭔가를 지목했다 = 환각. 가장 나쁜 결과다.
    return {
      ...base,
      correct: false,
      abstained: false,
      silent: false,
      wrong: true,
      abstain_correct: false,
      detail: `오지목 — 정답 없는 케이스에 ${s.law_name ?? "?"} ${s.article_no ?? "?"} 를 지목`,
    };
  }

  const lawOk = normalize(String(s.law_name ?? "")) === normalize(expected.law_name);
  const gotArt = articleKey(String(s.article_no ?? ""));
  const wantArt = articleKey(expected.article_no);
  const artOk = gotArt !== null && wantArt !== null && gotArt === wantArt;
  const correct = lawOk && artOk;

  return {
    ...base,
    correct,
    abstained: false,
    silent: false,
    wrong: !correct,
    abstain_correct: false,
    detail: correct
      ? `적중 — ${expected.law_name} ${expected.article_no}`
      : `오지목 — 기대 ${expected.law_name} ${expected.article_no} / 실제 `
        + `${s.law_name ?? "?"} ${s.article_no ?? "?"}`
        + ` (법령 ${lawOk ? "일치" : "불일치"}, 조문 ${artOk ? "일치" : "불일치"})`,
  };
}

export function scoreAll(trajectories: Trajectory[]): CaseScore[] {
  return trajectories.map(scoreTrajectory);
}

// ─────────────────────────────────────────────────────────────────────────────
// 결정성 프로브 — 같은 로그를 두 번 채점하면 같아야 한다
// ─────────────────────────────────────────────────────────────────────────────

/** 두 번 채점해 결과가 완전히 같은지 확인한다. 다르면 채점기에 비결정성이 들어온 것이다. */
export function determinismProbe(trajectories: Trajectory[]): { ok: boolean; detail: string } {
  const a = JSON.stringify(scoreAll(trajectories));
  const b = JSON.stringify(scoreAll(trajectories));
  return a === b
    ? { ok: true, detail: `${trajectories.length}건 2회 채점 동일` }
    : { ok: false, detail: "동일 입력에서 채점 결과가 갈렸다 — 채점기가 비결정적이다" };
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — 실 트래젝토리 없이 채점 규칙 자체를 검증한다
// ─────────────────────────────────────────────────────────────────────────────

function fixture(over: Partial<Trajectory>): Trajectory {
  return {
    case_id: "t",
    context: "",
    expected: { law_name: "국세기본법", article_no: "제45조의3" },
    expect_abstain: false,
    agent: "fixture",
    model: null,
    turns: [],
    submitted: null,
    stop: "submitted",
    turn_count: 1,
    ...over,
  } as Trajectory;
}

function selftest(): void {
  const probes: Array<[string, boolean, string]> = [];

  const hit = scoreTrajectory(fixture({ submitted: { law_name: "국세기본법", article_no: "제45조의3" } }));
  probes.push(["① 정답 튜플 적중", hit.correct && !hit.wrong, hit.detail]);

  // 이 프로브가 이 파일의 존재 이유다 — 조문번호만 맞고 법이 다르면 오답이어야 한다.
  const wrongLaw = scoreTrajectory(fixture({ submitted: { law_name: "지방세기본법", article_no: "제45조의3" } }));
  probes.push(["② 조문 같고 법 다름 → 오답", !wrongLaw.correct && wrongLaw.wrong, wrongLaw.detail]);

  // 제45조 와 제45조의3 을 같게 보면 대표 실패 사례가 통과해 버린다.
  const wrongSub = scoreTrajectory(fixture({ submitted: { law_name: "국세기본법", article_no: "제45조" } }));
  probes.push(["③ 제45조 ≠ 제45조의3", !wrongSub.correct, wrongSub.detail]);

  const spaced = scoreTrajectory(fixture({ submitted: { law_name: "국세 기본법", article_no: "45조의3" } }));
  probes.push(["④ 공백·접두 표기 흔들림 흡수", spaced.correct, spaced.detail]);

  const silent = scoreTrajectory(fixture({ submitted: null, stop: "turn_cap" }));
  probes.push(["⑤ 침묵 ≠ 기권", silent.silent && !silent.abstained, silent.detail]);

  const abstain = scoreTrajectory(fixture({ submitted: { not_found: true }, expect_abstain: true }));
  probes.push(["⑥ 옳은 기권", abstain.abstained && abstain.abstain_correct, abstain.detail]);

  const badAbstain = scoreTrajectory(fixture({ submitted: { not_found: true } }));
  probes.push(["⑦ 정답 있는데 기권 → 미적중", badAbstain.abstained && !badAbstain.abstain_correct, badAbstain.detail]);

  const halluc = scoreTrajectory(
    fixture({ expected: null, expect_abstain: true, submitted: { law_name: "양곡관리법", article_no: "제19조" } }),
  );
  probes.push(["⑧ 정답 없는데 지목 → 환각", halluc.wrong, halluc.detail]);

  const det = determinismProbe([hit, wrongLaw, silent].map(() => fixture({ submitted: { law_name: "국세기본법", article_no: "제45조의3" } })));
  probes.push(["⑨ 같은 로그 2회 채점 동일", det.ok, det.detail]);

  let failed = 0;
  for (const [name, ok, detail] of probes) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  — ${detail}`);
  }
  console.log(
    failed === 0
      ? `\nPASS — 채점 규칙 ${probes.length}종 전부 통과 (LLM 호출 0)`
      : `\nFAIL — ${failed}/${probes.length} 실패`,
  );
  if (failed > 0) process.exit(1);
}

if (process.argv.includes("--selftest")) selftest();
