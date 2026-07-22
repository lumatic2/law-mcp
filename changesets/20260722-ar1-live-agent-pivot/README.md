# AR1 — 평가 에이전트를 살아있는 세션으로 전환 (SDK 경로 폐기)

- 일자: 2026-07-22 · milestone: AR1 step-1 · 갈래: tooling
- 계기: **사용자 재지시** — "너가 LLM인데 왜 새 LLM이 필요하다는건지 이해가 안 가.
  그냥 너가 하면 되는거지 (…) 아니면 orca cli로 옆 pane 열고 코덱스한테 요청해보든가"

## 무엇이 바뀌었나

AR1 plan 은 평가 에이전트를 **Anthropic SDK 로 새로 호출**해 만드는 것으로 설계됐다.
그 결과 `ANTHROPIC_API_KEY` 가 없어 `stop_reason=secret_required` 로 정지했다.

전환: **소비 에이전트는 새로 만들지 않는다. 이미 살아있는 에이전트 세션이 소비자다.**

| | 구 설계 | 신 설계 |
|---|---|---|
| 에이전트 | `ClaudeAgent`(SDK `messages.create`) | 살아있는 세션 — Codex(블라인드) + Claude(대조군) |
| 도구 접근 | 러너가 프로바이더 직접 호출 | **실 MCP 도구** 또는 `bench/tool-cli.ts` |
| 비용 | 새 API 청구 (추정 $1~3/완주) | **0** — 기존 세션 컴퓨트 |
| blocker | 자격증명 필요 | 없음 |

## 왜 이 전환이 더 나은가 (비용 절감이 아니라 타당성)

1. **측정 대상에 더 가깝다.** Objective 는 "AI 에이전트로 법 작업을 할 때 설치하는 MCP" 다.
   실 소비자는 MCP 클라이언트 안의 에이전트지, 우리가 SDK 로 재현한 복제품이 아니다.
2. **벤더 교차가 공짜로 생긴다.** Codex 는 다른 벤더의 에이전트다 — "우리 모델에서만 되는
   도구"인지 아닌지가 측정에 들어온다.
3. **오염 문제를 Codex 가 실제로 푼다.** Claude 본인은 프로브·`golden-tax.json` 을 읽어
   정답을 안다(상한선만 잴 수 있음). Codex 는 이 대화도 정답 세트도 본 적이 없다 —
   맥락 문단 + 도구만 주면 **진짜 블라인드 소비자**다.

## 산출물

- **`bench/tool-cli.ts` (신규)** — `search` / `article` 두 명령. 셸만 쥔 에이전트가
  레포 내부를 안 읽고도 실 도구를 칠 수 있게 한다(정답 세트 우연 노출 차단이 설계 목적).
- `bench/agentic-agent-claude.ts` — **폐기 예정**. `Agent` 인터페이스·트래젝토리 기록·
  턴 상한·침묵/기권 구분(`bench/agentic-run.ts`)은 **그대로 유지**한다. 바뀐 것은
  "누가 `next()` 를 채우나" 하나뿐이다.

## 검증

- `npx tsx bench/tool-cli.ts search "종합소득세 중간예납" 3` → 실 API 응답, `ai_articles` 반환
- Claude 본인 실 MCP 2턴 왕복: `search_law("부가가치세 간이과세자가 될 수 있는 매출액 기준")`
  → `ai_articles` 가 §61 지목 → `get_law_article(001571, 제61조)` → 8천만원 기준 본문 확인.
  **새 API 호출 0회.**
- Codex 블라인드 1케이스: 별도 evidence 에 기록.
- `git diff --stat src/` = **0 줄**

## 승인된 plan 과의 관계

`plans/2026-07-22-ar1-agentic-harness.md` 는 승인 hash 보존을 위해 **본문을 고치지 않는다.**
step-1 의 DoD 중 "비용 실측"은 **비용이 0 이 되어 소멸**했고, 그 자리를 "살아있는 에이전트가
실제로 1케이스를 완주한다"가 대체한다. 이 전환의 정본 기록이 이 changeset 이다.
