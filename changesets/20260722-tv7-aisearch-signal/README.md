# TV7 step-1 — aiSearch 신호 확장

- 일자: 2026-07-22 · horizon: `tax-vertical` · milestone: TV7
- plan: `plans/2026-07-22-tv7-ranking-signal.md` step-1
- 근거: `research/2026-07-22-tv7-aisearch-ranking-probe.md`

## 무엇을 바꿨나

`aiSearch` 조문 수집 폭을 **10 → 30** 으로 올렸다(`AI_SEARCH_DISPLAY`).

**추가 HTTP 호출이 아니라 같은 호출의 파라미터다.** TV4 는 조문제목 신호를 *사려다*
비용(전문 771KB·1.1초)에 막혀 미채택으로 죽었다. TV7 은 **이미 산 신호를 안 쓰고 있던 것**을
쓴다 — `aiSearch` 는 검색과 병렬로 이미 호출 중이고 응답에 `조문제목`·순위가 들어 있다.

## 왜 30인가

2026-07-22 실측(세법 dev 30) — 정답 법이 결과 안에 **존재**하는 비율:

| display | 정답 법 존재 |
|---|---|
| 10 | 28/30 |
| **30** | **30/30** |

재정렬은 후보가 목록 안에 있어야 시작되므로, 이 2건이 곧 도달 상한이었다.

## 비용 실측 (plan 예산: TV4 기본 대비 +200ms 이내)

| 측정 | 값 |
|---|---|
| `aiSearch` 조회 `display=10` | 중앙 **1268ms** |
| `aiSearch` 조회 `display=30` | 중앙 **1347ms** |
| 차이 | **+79ms** (예산 내) |
| **검색 1회 전체 지연** | 중앙 **1943ms** (TV4 기본 1879~1946ms — 사실상 동일) |

검색 전체 지연이 안 늘어난 이유: `aiSearch` 는 사다리와 **동시에** 뜬다(UD2 step-4). 대기시간이
`max(사다리, aiSearch)` 라 이 채널의 +79ms 는 사다리(~1.9s) 안에 흡수된다.

## 실패 프로브

`aiSearch` 가 HTTP 503 으로 죽었을 때 **검색은 그대로 산다**(실측: 3건 정상 반환).
`lookupAiSearch` 가 모든 실패를 빈 결과로 흡수하므로 기존 사다리로 degrade 한다.

## 파일

- edit `src/ai-search.ts` — `AI_SEARCH_DISPLAY = 30` 신설, 기본 폭 적용
- edit `test/ai-search.test.ts` — 폭 고정 · **호출 수 1 고정** · 법령 단위 신호(순위+조문제목) 보존
- write `bench/tv7-signal-cost.ts` — 비용·실패 프로브 러너

## 검증

- `npm test` **275/275**
- 비용·실패 프로브: 위 표
- 응답 스키마·도구 개수 불변 → **MCP 재시작 불요**
