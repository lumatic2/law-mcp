/**
 * 실 LLM 에이전트 (AR1 step-1).
 *
 * `agentic-run.ts` 의 `Agent` 인터페이스 구현. **별도 파일인 이유**: 러너가 SDK 를 import 하면
 * 자격증명·SDK 없이 도는 `--selftest` 가 같이 죽는다. 러너는 의존성 없이 남긴다.
 *
 * 계약 (claude-api 스킬 확인, 2026-07-22):
 *  - Opus 4.8 은 `thinking` 을 **생략하면 사고 없이** 돈다 → `{type:"adaptive"}` 를 명시한다.
 *  - `temperature`/`top_p`/`top_k` 는 Opus 4.8 에서 **400**. 보내지 않는다.
 *  - `budget_tokens` 도 **400**. 깊이는 `output_config.effort` 로만 조절한다.
 *  - 수동 루프를 쓴다(툴러너 아님) — 벤치는 트래젝토리·턴 상한을 직접 소유해야 하고,
 *    beta 의존을 늘리지 않는다.
 *  - 프롬프트 캐싱은 **안 건다**: 안정 프리픽스(도구 스키마)가 Opus 4.8 최소 캐시 길이
 *    4096 토큰에 한참 못 미쳐(실측 1,362자) 조용히 캐시되지 않는다. 붙이면 착시만 준다.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_TOOLS,
  type Agent,
  type AgentObservation,
  type ToolCall,
  type Trajectory,
} from "./agentic-run.js";

/** 모델을 바꾸면 자가 바뀐다. 기본은 소비 현실에 맞춘 Opus 4.8. */
export const DEFAULT_AGENT_MODEL = "claude-opus-4-8";

const SYSTEM = [
  "너는 한국 법령을 찾아 주는 조사자다. 사용자의 상황 설명을 받고, 주어진 도구로 근거 조문을",
  "찾아 **조문 하나를 확정 지목**한다.",
  "",
  "규칙:",
  "- 반드시 도구로 확인한 뒤 지목한다. 기억으로 답하지 마라.",
  "- `search_law` 응답의 `warnings` 를 읽어라. 본문검색 폴백·절단 경고가 떴다면 그 목록은",
  "  관련도순이 아니다 — 질의를 좁혀 다시 물어라.",
  "- 상위 결과의 법 분야가 질문과 다르면(세무 질문에 식품법 등) 그건 신호다. 재질의하라.",
  "- 확신이 서면 `submit_answer` 로 지목한다. **이 도구를 부르기 전에는 끝난 게 아니다.**",
  "- 못 찾겠으면 `submit_answer` 에 `not_found: true` 로 기권을 선언하라.",
  "  **틀린 답보다 없는 답이 낫다.** 아무거나 찍지 마라.",
].join("\n");

type Msg = Anthropic.MessageParam;

/** 트래젝토리 기록을 Messages API 대화로 되짚는다. 러너는 SDK 모양을 모른다. */
function toMessages(obs: AgentObservation): Msg[] {
  const messages: Msg[] = [
    { role: "user", content: `상황:\n${obs.context}\n\n근거 조문을 찾아 지목해라.` },
  ];

  for (const turn of obs.history) {
    if (turn.tool_calls.length === 0) continue;
    messages.push({
      role: "assistant",
      content: turn.tool_calls.map((c) => ({
        type: "tool_use" as const,
        id: c.id,
        name: c.name,
        input: c.input,
      })),
    });
    messages.push({
      role: "user",
      content: turn.tool_calls.map((c) => {
        const r = turn.tool_results.find((x) => x.id === c.id);
        const body = r
          ? [r.summary, r.warnings?.length ? `\n⚠ warnings:\n- ${r.warnings.join("\n- ")}` : ""]
              .join("")
          : "결과 없음";
        return {
          type: "tool_result" as const,
          tool_use_id: c.id,
          content: body,
          ...(r && !r.ok ? { is_error: true as const } : {}),
        };
      }),
    });
  }

  return messages;
}

export class ClaudeAgent implements Agent {
  readonly name: string;
  readonly model: string;
  private readonly client: Anthropic;
  private readonly effort: "low" | "medium" | "high" | "xhigh" | "max";

  constructor(options: { model?: string; effort?: ClaudeAgent["effort"] } = {}) {
    // 인자 없는 생성자가 정본 — ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login`
    // 프로필 순으로 SDK 가 알아서 찾는다. 키를 코드로 주입하지 않는다.
    this.client = new Anthropic();
    this.model = options.model ?? DEFAULT_AGENT_MODEL;
    this.effort = options.effort ?? "high";
    this.name = `claude:${this.model}:${this.effort}`;
  }

  async next(obs: AgentObservation): Promise<{ calls: ToolCall[]; usage?: Trajectory["usage"] }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: SYSTEM,
      // Opus 4.8 은 생략하면 사고 없이 돈다 — 명시해야 adaptive 가 켜진다.
      thinking: { type: "adaptive" },
      output_config: { effort: this.effort },
      tools: AGENT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
      messages: toMessages(obs),
    });

    const usage: Trajectory["usage"] = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    };

    // 안전장치: 분류기 거절은 200 으로 온다. content 를 읽기 전에 확인한다.
    if (response.stop_reason === "refusal") {
      return { calls: [], usage };
    }

    // `input` 은 SDK 가 이미 파싱해 준다 — 직렬화 문자열을 정규식으로 긁지 않는다.
    const calls: ToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

    // 도구를 안 부르고 말로 끝냈으면 침묵이다. 러너가 기권과 구분해 기록한다.
    return { calls, usage };
  }
}
