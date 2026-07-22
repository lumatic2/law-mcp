# PLAN — AR1 에이전트형 평가 하네스

> 생성: 2026-07-22 · 갈래: tooling · 소비 증거: `evidence/bench/2026-07-22-context-effect-probe.md` · `research/2026-07-22-agentic-eval-horizon-agentic-benchmark.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-22 사용자 "ㄱㄱ")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 에이전트가 쓰는 대로 재고, 그 기준으로 올린다 (← `plans/horizons/agentic-reach.md`)
- **milestone**: AR1 — **자를 만든다.** 맥락을 가진 에이전트가 도구를 쓰는 루프를 재현 가능하게
  돌리고, 그 결과를 **LLM judge 없이** 채점한다.
  규모 근거: 루프 러너·결정적 채점기·반복 보고가 독립 changeset 3, 통합검증 = 구 홀드아웃 20건 완주.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 평가 하네스(`bench/`) 신설. 지표 정의와 러너·채점기.
- **제외**: `src/` 수정(도구를 고치면 자와 대상을 동시에 바꾸게 된다) · 맥락 문단 제작(AR2) ·
  도구 개선(AR3) · 새 홀드아웃 봉인(AR2).
- **중단점**: blocked / error / risk_gate(비용 초과 — step-1 실측이 예산을 넘으면 정지하고 사용자에게
  케이스 수 재조정을 올린다) / 결정적 채점이 원리적으로 불가능하다고 판명(→ 설계 재논의).
- 롤백/정리: `bench/` 신규 파일만 추가. `src/` 불변이므로 배포·재시작 불요.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포 `bench/`. **`src/` 미변경 → 배포·재시작 불요.**
- 검증: 자기 자신을 대상으로 한 결정성 프로브(같은 트래젝토리 2회 채점 → 동일) + 구 홀드아웃
  20건 완주 + 비용 실측.
- 배포/운영: **해당 없음 — `src/` 를 안 바꾼다.** 벤치는 개발자 도구다.

**② 자기선언 도메인**
- **비결정성 통제**: 채점은 `law_id`+`article_no` 튜플 문자열 비교로만 한다(BFCL 패턴). LLM judge
  **0개**. 남는 비결정 요소는 에이전트의 쿼리 작성 한 곳뿐이고, 그것은 **측정 대상**이지 잡음이 아니다.
- **반복·신뢰도**: 케이스당 ≥3회 독립 실행. `pass@3`(3회 중 1회 이상 도달)·`pass^3`(3회 다 도달)·
  범위를 **동시 보고**한다. 셋 중 하나라도 빠지면 러너가 출력을 거부한다.
- **채택 문턱**: 2σ. 스프레드가 문턱을 넘으면 **반복 횟수를 올린다** — 3회는 방향성 확인용이지
  통계적으로 충분하지 않다(리서치 권고 2 함정). horizon 종료 판정에는 반복을 늘린다.
- **종료 조건**: 에이전트가 조문을 **하나 확정 지목**해야 성공이다. "상위 N 에 있었다"로 퇴화하면
  멀티턴으로 바꾼 의미가 없다(리서치 권고 1 함정).
- **비용**: step-1 에서 1케이스 왕복 비용을 먼저 실측하고 케이스 수를 거기 맞춘다. 캐싱은 쓰되
  **재추론을 가리는 캐싱 금지** — 캐시 히트를 로그에 남긴다(리서치 권고 3 함정).
- **에이전트 모델**: 소비 현실에 맞춰 고정한다. 모델을 바꾸면 자가 바뀌므로 러너 출력에 **모델
  ID 를 반드시 기록**한다.
- 검토 후 제외: 화면·디자인 · 인증 · 데이터 마이그레이션 · 신규 MCP 도구 · `src/` 변경 · 배포 ·
  사용자 시뮬레이터(사용자 확정 2026-07-22: 고정 맥락 방식 채택, 시뮬레이터는 다음 horizon 후보).

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **LLM judge** — 편하지만 LiveMCPBench 가 23회 반복에서
  57.9~76.8% 로 흔들린 원인이며, 이 레포의 최대 자산인 측정 규율과 정면 충돌한다.

## 결정 로그

- status: resolved
- **사용자 역할을 어떻게 만드나** → 확정(2026-07-22 사용자): **고정 맥락 + 에이전트만 LLM.**
  시뮬레이터는 비결정 요소를 둘로 늘리고, 캘리브레이션할 실 사용자 로그가 이 레포에 없다.
- **채점을 LLM 에게 맡기나** → 확정: **아니오.** 구조화 튜플 비교만.
- **반복 횟수** → 확정: 최소 3회, 스프레드가 2σ 문턱을 넘으면 상향.
- 그 외 사용자 소유 결정: 없음(예상 없음 — 있으면 정지해 올린다).

## Step 트리

- [ ] **step-1** 루프 러너 골격 + 비용 실측
  - Artifact: `bench/agentic-run.ts` — 맥락 문단을 받아 에이전트가 `search_law`·`get_law_article`
    를 호출·재질의하고, 조문 하나를 확정 지목하면 종료하는 루프. 트래젝토리(턴별 도구 호출·인자·
    응답 요약·경고)를 JSONL 로 남긴다. + `evidence/bench/2026-07-22-ar1-cost.md` 1케이스 왕복
    비용·턴수 실측
  - Files: write `bench/agentic-run.ts`·`evidence/bench/2026-07-22-ar1-cost.md`·
    `changesets/20260722-ar1-loop-runner/README.md` / read `bench/run.ts`·`src/types.ts`
  - Dependencies: 없음
  - Verify: 1케이스가 끝까지 돌고 트래젝토리 JSONL 이 남는다 + 비용·턴수가 기록된다 +
    `git diff --stat src/` **0 줄**
  - Failure probe: 턴 상한에 걸리는 케이스를 일부러 넣어 **무한 루프가 아니라 상한에서 종료**하고
    그 사실이 트래젝토리에 남는지 확인
  - Commit: `changesets/20260722-ar1-loop-runner/`
- [ ] **step-2** 결정적 채점기
  - Artifact: `bench/agentic-score.ts` — 트래젝토리 JSONL 을 읽어 **에이전트가 확정 지목한**
    `law_id`+`article_no` 를 정답 튜플과 비교. LLM 호출 **0개**. 기권("못 찾음") 선언도 별도
    결과값으로 채점한다
  - Files: write `bench/agentic-score.ts`·`changesets/20260722-ar1-scorer/README.md` /
    read `bench/agentic-run.ts`·`bench/scoring.ts`·`bench/golden-tax.json`
  - Dependencies: step-1
  - Verify: **같은 트래젝토리 로그를 2회 채점해 결과가 완전히 동일** + 채점기 소스에 LLM 호출이
    없음을 `grep` 으로 확인 + 지목 없이 끝난 트래젝토리가 기권으로 분류됨
  - Failure probe: 정답과 **조문번호만 다른** 트래젝토리를 넣어 오답으로 잡히는지 확인
    (법령만 맞고 조문이 틀린 경우를 성공으로 세면 구 recall@3 로 퇴화한다)
  - Commit: `changesets/20260722-ar1-scorer/`
- [ ] **step-3** 반복·신뢰도 보고
  - Artifact: `bench/agentic-report.ts` — 케이스당 ≥3회 실행을 묶어 `pass@3`·`pass^3`·범위·
    `AT`(평균 도달 턴수)·`SR@t`(t턴 누적 성공률) 곡선·기권 정밀도/재현율을 출력. 셋 중 하나라도
    없으면 **출력을 거부**한다
  - Files: write `bench/agentic-report.ts`·`changesets/20260722-ar1-report/README.md` /
    read `bench/agentic-score.ts`
  - Dependencies: step-2
  - Verify: 구 홀드아웃 20건(맥락 없이, 원 쿼리 그대로)으로 **완주**하고 위 지표가 전부 출력됨 +
    `pass@3`·`pass^3`·범위 중 하나를 빼면 러너가 exit≠0
  - Failure probe: 반복 1회만 준 입력을 넣어 **거부**되는지 확인(단일 측정 출하 차단이 이
    milestone 의 존재 이유다)
  - Commit: `changesets/20260722-ar1-report/`

## 검증/DoD

- **DoD**: ① 맥락→에이전트 루프가 트래젝토리를 남기며 완주 ② 채점기에 LLM 호출 0개이고 2회 채점
  결과 동일 ③ 조문번호까지 일치해야 성공(법령만 맞으면 오답) ④ `pass@3`·`pass^3`·범위 동시 출력,
  하나라도 빠지면 거부 ⑤ 단일 반복 입력 거부 ⑥ `AT`·`SR@t`·기권 정밀도/재현율 출력 ⑦ 1케이스
  비용·턴수 실측 기록 ⑧ 에이전트 모델 ID 가 출력에 기록됨 ⑨ `git diff --stat src/` **0 줄**

## hard-stop policy

- step-1 비용 실측이 예산을 넘음 → **정지.** 케이스 수 재조정을 사용자에게 올린다.
- 결정적 채점이 원리적으로 불가능하다고 판명 → 정지 후 설계 재논의(LLM judge 로 도피 금지).
- 이 milestone 에서 `src/` 를 고치고 싶어짐 → **금지.** 자와 대상을 동시에 바꾸면 AR3 판정이 무효.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- `bench/` 신규 파일만 추가 — 되돌리면 흔적 없음. `src/` 불변.

## finding 큐

- 러너를 만들며 드러나는 도구 결함은 전부 여기 — **고치지 않고** AR3 의 입력으로 넘긴다.

## 진행 로그 (append-only)
