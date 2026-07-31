# HANDOFF — 세션 핸드오프 (git-tracked, session-end 소유)

> 2026-07-31 이관: 구 `CLAUDE.local.md`(tracked) 핸드오프를 플릿 규약(HO1)대로 `HANDOFF.md` 로 이동. `CLAUDE.local.md` 는 이제 gitignored 기기-로컬 전용.

## 이어서 할 일
> 2026-07-23 세션 종료 시 기록

- **다음 horizon = "세법 완성" 설계.** `/harness` §B0.5 로 `plans/horizons/<slug>.md` 작성.
  담을 후보는 `plans/horizons/CANDIDATES.md` 의 `[horizon]` D·C·B + `[finding]` F·I·J·G.
- **먼저 정할 것: ①(세법 완성)의 닫는 기준.** 지금 기준이 없어 ②(다음 분야)로 넘어갈 시점을
  판단할 수 없다. 세션 마지막 미결이며 사용자 승인 필요.
- **미푸시 3건**(`3c65c59`·`1a5e9cc`·`d5cea31`) — `git push` 필요.
  `~/projects/custom-skills` 도 ahead 1(`5efd1c0` harness §B0.5 규칙) — 별도 push 필요.
- 배포·npm 은 꺼내지 말 것 — `CLAUDE.md` §진행 순서로 잠갔다. 회계도 범위 밖(§범위).

### 계획 위치 (cascade)
- Objective: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP의 대표 중 하나가 된다
- Horizon: **없음** — `trap-free` 2026-07-23 closed (`archive/reports/2026-07-23-trap-free-close.md`)
- Milestone(active): **없음** — TF1~TF4 전부 completed
- Step: 해당 없음
- 다음 차례: `/harness` §B0.5 새 horizon 필요 — CANDIDATES.md `[horizon]` 5건에서 선정

### 현재 상태 / 주의점
- MCP 서버 재시작 완료. TF4 수리 실 세션 검증됨(`as_of` + `law_id` 정상, effective_date 20240401).
- ROADMAP read-only preflight: 110줄(budget 150 이내), marker 4개 전부 `completed`,
  active=0. session-end는 ROADMAP을 수정하지 않았다.
- 신뢰 가능한 기준선 = dev 20건 `pass^3` 90% · `SR@1` 80%. 홀드아웃은 소진(비가역).
- 후보 파일 형태 규약이 harness §B0.5로 승격됨 — 후보는 단일 목록·발견 즉시 적재·크기 태그.
