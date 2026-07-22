/**
 * 에이전트형 평가 루프 러너 (AR1 step-1).
 *
 * 구 `bench/run.ts` 는 라벨 문자열을 `searchLaw` 에 **한 번** 던지고 상위 3 을 채점한다.
 * 실제 소비 경로는 맥락을 가진 에이전트가 쿼리를 짜고, 도구 응답의 경고를 읽고, 재질의하는
 * 루프다. 이 러너는 그 층을 복원한다.
 *
 * 설계 계약 (plans/2026-07-22-ar1-agentic-harness.md):
 *  - 종료는 **에이전트가 조문 하나를 확정 지목**할 때만이다(`submit_answer`). "상위 N 에 있었다"
 *    로 퇴화하면 멀티턴으로 바꾼 의미가 없다.
 *  - 못 찾겠으면 기권을 **선언**해야 한다(`submit_answer` with `not_found`). 침묵은 기권이 아니다.
 *  - 트래젝토리를 JSONL 로 남긴다 — 채점(step-2)은 이 로그만 읽고 LLM 없이 결정적으로 돈다.
 *  - 턴 상한에서 반드시 멈춘다(무한 루프 금지).
 *
 * 에이전트는 `Agent` 인터페이스 뒤에 있다:
 *  - `ScriptedAgent` — 결정적. LLM 없이 루프 기계장치·상한·로깅을 검증한다.
 *  - 실 LLM 에이전트는 `--agent claude` 로 붙는다(자격증명 필요).
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

// ─────────────────────────────────────────────────────────────────────────────
// 도구 표면 — 에이전트에게 보이는 것. law-mcp 의 실 도구를 그대로 반영한다.
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_TOOLS = [
  {
    name: "search_law",
    description:
      "법령을 키워드나 자연어 법률 질문으로 검색한다. 응답의 warnings 를 반드시 읽어라 — "
      + "본문검색으로 폴백했거나 결과가 절단됐다면 그 목록은 관련도순이 아니다.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색어 또는 자연어 질문" },
        limit: { type: "integer", description: "결과 개수(기본 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_law_article",
    description: "법령ID와 조문번호로 조문 본문을 가져온다. 지목 전에 본문을 확인하는 데 쓴다.",
    input_schema: {
      type: "object",
      properties: {
        law_id: { type: "string", description: "법령ID 또는 법령명" },
        article_no: { type: "string", description: '조문번호 (예: "제55조", "제45조의3")' },
      },
      required: ["law_id", "article_no"],
    },
  },
  {
    name: "submit_answer",
    description:
      "답을 확정한다. **이 도구를 부르기 전에는 과제가 끝나지 않는다.** "
      + "정답 조문을 하나 지목하거나, 못 찾았으면 not_found=true 로 기권을 선언하라. "
      + "확신이 없는데 아무거나 지목하지 마라 — 틀린 답보다 없는 답이 낫다.",
    input_schema: {
      type: "object",
      properties: {
        law_name: { type: "string", description: "지목하는 법령명" },
        article_no: { type: "string", description: '지목하는 조문번호 (예: "제55조")' },
        not_found: { type: "boolean", description: "못 찾았으면 true" },
        reason: { type: "string", description: "지목 근거 또는 기권 사유" },
      },
      required: [],
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 트래젝토리 — 채점기(step-2)가 읽는 유일한 입력
// ─────────────────────────────────────────────────────────────────────────────

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type TurnRecord = {
  turn: number;
  tool_calls: ToolCall[];
  /** 도구 응답 요약 — 전문이 아니라 채점·재현에 필요한 것만. */
  tool_results: Array<{
    id: string;
    ok: boolean;
    summary: string;
    warnings?: string[];
  }>;
};

export type Trajectory = {
  case_id: string;
  /** 에이전트에게 준 맥락 문단. 정답 라벨은 절대 여기 들어가면 안 된다(AR2 유출 탐지기). */
  context: string;
  /** 정답 라벨 — 러너는 이걸 에이전트에게 **주지 않는다**. 채점기만 읽는다. */
  expected: { law_name: string; article_no: string } | null;
  /** 기권이 정답인 케이스(AR2 step-2) */
  expect_abstain: boolean;
  agent: string;
  /** 모델을 바꾸면 자가 바뀐다 — 반드시 기록한다. */
  model: string | null;
  turns: TurnRecord[];
  /** 에이전트가 확정 지목한 것. 지목 없이 끝났으면 null(= 침묵, 기권과 구분한다). */
  submitted: { law_name?: string; article_no?: string; not_found?: boolean; reason?: string } | null;
  /** 왜 끝났나 */
  stop: "submitted" | "turn_cap" | "error";
  turn_count: number;
  error?: string;
  /** 비용 실측 — LLM 을 쓴 경우만 */
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
};

// ─────────────────────────────────────────────────────────────────────────────
// 에이전트 인터페이스
// ─────────────────────────────────────────────────────────────────────────────

export type AgentObservation = {
  context: string;
  history: TurnRecord[];
};

export interface Agent {
  readonly name: string;
  readonly model: string | null;
  /** 다음 턴에 부를 도구들. 빈 배열을 주면 러너가 침묵으로 보고 종료한다. */
  next(obs: AgentObservation): Promise<{ calls: ToolCall[]; usage?: Trajectory["usage"] }>;
}

/**
 * 결정적 스텁 — LLM 없이 루프 기계장치를 검증한다.
 * 스크립트는 턴 번호로 인덱싱된 도구 호출 목록이다. 스크립트를 다 쓰면 침묵한다.
 */
export class ScriptedAgent implements Agent {
  readonly name = "scripted";
  readonly model = null;
  private readonly script: ToolCall[][];

  constructor(script: ToolCall[][]) {
    this.script = script;
  }

  async next(obs: AgentObservation): Promise<{ calls: ToolCall[] }> {
    return { calls: this.script[obs.history.length] ?? [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 도구 실행 — 실 프로바이더를 친다(모킹하지 않는다. 자를 만드는 중이지 흉내내는 중이 아니다).
// ─────────────────────────────────────────────────────────────────────────────

async function execTool(
  provider: LawGoProvider,
  call: ToolCall,
): Promise<TurnRecord["tool_results"][number]> {
  try {
    if (call.name === "search_law") {
      const res = await provider.searchLaw(String(call.input.query ?? ""), {
        limit: typeof call.input.limit === "number" ? call.input.limit : 10,
      });
      const lines = res.items.map((i, n) => {
        const arts = (i as { ai_articles?: Array<{ article: string; title: string | null }> }).ai_articles;
        const artStr = arts?.length
          ? ` [ai_articles: ${arts.map((a) => `${a.article}(${a.title ?? ""})`).join(", ")}]`
          : "";
        return `${n + 1}. ${i.law_name} (law_id=${i.law_id})${artStr}`;
      });
      return {
        id: call.id,
        ok: true,
        summary: `total=${res.total}\n${lines.join("\n")}`,
        warnings: res.warnings,
      };
    }

    if (call.name === "get_law_article") {
      const res = await provider.getLawArticle(
        String(call.input.law_id ?? ""),
        String(call.input.article_no ?? ""),
      );
      if (!res) return { id: call.id, ok: false, summary: "조문을 찾지 못함" };
      const body = (res.content ?? "").slice(0, 1200);
      return {
        id: call.id,
        ok: true,
        summary: `${res.article_no} ${res.title ?? ""}\n시행일자=${res.effective_date ?? "?"}\n${body}`,
        warnings: res.warnings,
      };
    }

    // submit_answer 는 러너가 가로챈다 — 여기 오면 안 된다.
    return { id: call.id, ok: false, summary: `알 수 없는 도구: ${call.name}` };
  } catch (err) {
    return { id: call.id, ok: false, summary: `에러: ${(err as Error).message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 루프
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TURN_CAP = 6;

export async function runCase(
  agent: Agent,
  provider: LawGoProvider,
  input: {
    case_id: string;
    context: string;
    expected: { law_name: string; article_no: string } | null;
    expect_abstain?: boolean;
  },
  turnCap = DEFAULT_TURN_CAP,
): Promise<Trajectory> {
  const traj: Trajectory = {
    case_id: input.case_id,
    context: input.context,
    expected: input.expected,
    expect_abstain: input.expect_abstain ?? false,
    agent: agent.name,
    model: agent.model,
    turns: [],
    submitted: null,
    stop: "turn_cap",
    turn_count: 0,
  };

  try {
    while (traj.turns.length < turnCap) {
      const { calls, usage } = await agent.next({ context: input.context, history: traj.turns });
      if (usage) {
        traj.usage = traj.usage
          ? {
              input_tokens: traj.usage.input_tokens + usage.input_tokens,
              output_tokens: traj.usage.output_tokens + usage.output_tokens,
              cache_read_input_tokens:
                (traj.usage.cache_read_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
            }
          : usage;
      }

      // 침묵 — 지목 없이 손을 놓았다. 기권 선언과 구분해서 기록한다.
      if (calls.length === 0) {
        traj.turns.push({ turn: traj.turns.length + 1, tool_calls: [], tool_results: [] });
        traj.stop = "turn_cap";
        break;
      }

      // 확정 지목이 있으면 그 턴에서 끝난다.
      const submit = calls.find((c) => c.name === "submit_answer");
      if (submit) {
        traj.turns.push({
          turn: traj.turns.length + 1,
          tool_calls: calls,
          tool_results: [{ id: submit.id, ok: true, summary: "answer submitted" }],
        });
        traj.submitted = submit.input as Trajectory["submitted"];
        traj.stop = "submitted";
        break;
      }

      const results = [];
      for (const call of calls) results.push(await execTool(provider, call));
      traj.turns.push({ turn: traj.turns.length + 1, tool_calls: calls, tool_results: results });
    }
  } catch (err) {
    traj.stop = "error";
    traj.error = (err as Error).message;
  }

  traj.turn_count = traj.turns.length;
  return traj;
}

export function appendTrajectory(path: string, traj: Trajectory): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(traj)}\n`, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// 자기검증 — `npx tsx bench/agentic-run.ts --selftest`
// 실 LLM 없이 루프 기계장치를 검증한다: 정상 종료 · 턴 상한 · 침묵 · 트래젝토리 기록.
// ─────────────────────────────────────────────────────────────────────────────

async function selftest(): Promise<void> {
  const provider = new LawGoProvider();
  const out = resolve(process.cwd(), "evidence/bench/2026-07-22-ar1-selftest.jsonl");
  writeFileSync(out, "", "utf8");
  const fails: string[] = [];

  // ① 정상 경로 — 검색 후 지목
  const happy = await runCase(
    new ScriptedAgent([
      [{ id: "t1", name: "search_law", input: { query: "세금 신고기한이 지난 뒤에 하는 신고", limit: 3 } }],
      [{ id: "t2", name: "submit_answer", input: { law_name: "국세기본법", article_no: "제45조의3" } }],
    ]),
    provider,
    {
      case_id: "selftest-happy",
      context: "세무 상담 중. 신고 기한을 놓쳤을 때 어떻게 하는지 묻고 있다.",
      expected: { law_name: "국세기본법", article_no: "제45조의3" },
    },
  );
  appendTrajectory(out, happy);
  if (happy.stop !== "submitted") fails.push(`정상경로 stop=${happy.stop} (expected submitted)`);
  if (happy.turn_count !== 2) fails.push(`정상경로 turn_count=${happy.turn_count} (expected 2)`);
  if (happy.submitted?.article_no !== "제45조의3") fails.push("정상경로 submitted 누락");
  const searched = happy.turns[0]?.tool_results[0];
  if (!searched?.ok) fails.push("정상경로 search_law 실패");
  if (!searched?.warnings?.length) fails.push("정상경로 warnings 미전달 — 에이전트가 재질의 신호를 못 본다");

  // ② 실패 프로브 — 절대 지목하지 않는 에이전트가 **턴 상한에서** 멈추는가(무한 루프 금지)
  const runaway = await runCase(
    new ScriptedAgent(
      Array.from({ length: 50 }, (_, i) => [
        { id: `r${i}`, name: "search_law", input: { query: "가산세", limit: 1 } },
      ]),
    ),
    provider,
    { case_id: "selftest-runaway", context: "지목하지 않는 에이전트.", expected: null },
    3,
  );
  appendTrajectory(out, runaway);
  if (runaway.stop !== "turn_cap") fails.push(`상한 프로브 stop=${runaway.stop} (expected turn_cap)`);
  if (runaway.turn_count !== 3) fails.push(`상한 프로브 turn_count=${runaway.turn_count} (expected 3)`);
  if (runaway.submitted !== null) fails.push("상한 프로브에 submitted 가 있으면 안 된다");

  // ③ 침묵 — 지목도 기권도 없이 손을 놓은 경우가 기권과 구분되는가
  const silent = await runCase(new ScriptedAgent([]), provider, {
    case_id: "selftest-silent",
    context: "즉시 손을 놓는 에이전트.",
    expected: null,
  });
  appendTrajectory(out, silent);
  if (silent.submitted !== null) fails.push("침묵인데 submitted 가 채워졌다");
  if (silent.stop !== "turn_cap") fails.push(`침묵 stop=${silent.stop}`);

  // ④ 기권 선언 — 침묵과 다른 값으로 기록되는가
  const abstain = await runCase(
    new ScriptedAgent([[{ id: "a1", name: "submit_answer", input: { not_found: true, reason: "현행법에 없음" } }]]),
    provider,
    { case_id: "selftest-abstain", context: "답이 없는 질의.", expected: null, expect_abstain: true },
  );
  appendTrajectory(out, abstain);
  if (abstain.submitted?.not_found !== true) fails.push("기권 선언이 기록되지 않았다");
  if (abstain.stop !== "submitted") fails.push(`기권 stop=${abstain.stop} (expected submitted)`);

  console.log(`\n=== AR1 step-1 자기검증 ===`);
  console.log(`① 정상 경로   stop=${happy.stop} turns=${happy.turn_count} warnings=${searched?.warnings?.length ?? 0}건`);
  console.log(`② 턴 상한     stop=${runaway.stop} turns=${runaway.turn_count} (cap=3)`);
  console.log(`③ 침묵        submitted=${JSON.stringify(silent.submitted)} stop=${silent.stop}`);
  console.log(`④ 기권 선언   submitted=${JSON.stringify(abstain.submitted)} stop=${abstain.stop}`);
  console.log(`트래젝토리 → ${out}`);

  if (fails.length) {
    console.error(`\nFAIL (${fails.length}):`);
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nPASS — 루프 기계장치 4종 전부 통과`);
}

if (process.argv.includes("--selftest")) {
  selftest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
