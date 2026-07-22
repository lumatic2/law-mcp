# AR1 완료 — 에이전트형 평가 하네스

> milestone: AR1 (horizon `agentic-reach`) · 2026-07-22

## 1. 결과

에이전트가 **여러 턴 돌면서** 법령을 찾는 과정을 재는 자를 만들었다. 3층 전부 닫혔고
**LLM judge 는 0개**다 — 채점이 모델 기분이 아니라 문자열 비교로 결정된다.

- **루프**(`bench/agentic-run.ts`) — 턴 상한, 트래젝토리 기록, **침묵 ≠ 기권** 분리. selftest 4/4
- **채점**(`bench/agentic-score.ts`) — **(법령, 조문) 튜플** 대조. selftest 9/9
- **집계**(`bench/agentic-report.ts`) — `SR@1`·`SR@t`·`pass@k`·`pass^k`·`AT`·기권 정밀도/재현율.
  **반복 1회 입력을 기계 거부**한다. selftest 5/5

측정 규율을 문서가 아니라 **코드로** 박은 것이 이 milestone 의 실질이다. 단발 판정 금지는
리포터가 거부하고, 조문번호 단독 비교는 채점기가 거부한다 — 둘 다 실제로 저지른 실수다.

부산물로 얻은 실측 (`evidence/bench/2026-07-22-ar3-rephrasing-contribution.md`):
**일상어 단발 0/5 → 법률어 재질의 3/5.** horizon 명제("단발로 재면 도구가 실제보다 나빠
보인다")가 숫자로 지지됐다. 동시에 재질의로도 2건은 미해결이다.

## 2. 이슈와 해결

**① 계획이 `ANTHROPIC_API_KEY` 를 요구해 정지했다.** 평가 에이전트를 Anthropic SDK 로
새로 호출해 만드는 설계였다. 사용자 지적("너가 LLM인데 왜 새 LLM이 필요하지")으로
**살아있는 세션이 곧 소비자**임을 확인 — SDK 경로를 폐기했다. 비용 추정 $1~3/완주 → **0**.
`bench/tool-cli.ts` 로 셸만 쥔 에이전트(Codex)도 실 도구를 칠 수 있게 했다.
정본: `changesets/20260722-ar1-live-agent-pivot/README.md`.

**② 내 진단이 틀렸다.** "법령은 맞히고 조문을 놓친다"로 보고 수리를 설계했으나, 기여도
프로브에서 **`lawRank=-1` 이 5건 중 4건** — 정답 법령이 상위 5위에 아예 없었다. 준비한
수리(버려지는 `best` 조문 살리기)는 기여도 **0/5**, **미채택**. 신호가 나빠서가 아니라
적용될 자리가 아니었다. AR3 수리 대상을 **"일상어 질의의 법령 도달"** 로 재지정했다.

**③ 내 측정에 결함이 있었다.** 조문 적중 검사가 법령을 대조하지 않아 `제57조` 가 엉뚱한
법에서 나와도 적중으로 세, 3/5 를 4/5 로 부풀렸다. 스스로 적발해 정직한 수치로 정정하고,
**같은 실수를 채점기가 구조적으로 막도록** selftest ②에 박았다.

**④ 계획 인플레.** "20케이스 × 5회 반복"을 지금 단계로 끌어와 세고 있었다. 그 반복 회수는
horizon 종료 판정(AR4)용이다. 사용자 지적으로 축소했다.

## 3. 증거

- `evidence/bench/2026-07-22-ar1-live-agent-probe.md` — 배선 확인 + 실 MCP 1케이스 3턴 완주
- `evidence/bench/2026-07-22-ar3-rephrasing-contribution.md` — 기여도 0/5 미채택 + 재질의 0/5→3/5
- `changesets/20260722-ar1-live-agent-pivot/README.md` — SDK 폐기 결정
- 실행: `npx tsx bench/agentic-score.ts --selftest` (9/9) ·
  `npx tsx bench/agentic-report.ts --selftest` (5/5) · `npm test` **302/302** · `tsc` exit 0
- **`git diff --stat src/` = 0 줄** — 자를 만드는 동안 대상을 안 바꿨다
- 실표면: `mcp__law-mcp__search_law` / `get_law_article` 직접 호출로 부가가치세법 §61 본문 수신
- 재현: `npx tsx bench/ar3-title-best-probe.ts`

## 남긴 부채

- **블라인드 arm 미도착** — Codex 세션이 백그라운드에서 미완. 오염 없는 측정은 아직 없다.
- `bench/agentic-agent-claude.ts` (SDK 구현) 는 **폐기 예정**이나 아직 레포에 남아 있다.
- 실 트래젝토리로 채점기·리포터를 돌린 적이 없다 — fixture 검증까지다. AR2 의 첫 일.
