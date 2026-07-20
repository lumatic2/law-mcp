# PLAN — LB1 정답 도달 측정 하네스

> 생성: 2026-07-20 · 갈래: tooling · scope 결정: 골든셋·러너·기준선 리포트까지 (개선은 LB2)
> execution mode: continuous
> milestone-레벨 durable plan doc. Claude/Codex 가 이 문서만 읽고 이어받는 단일 장부.

Status: approved (2026-07-20 · 위임 범위 A — horizon 전체 연쇄)

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 범용 법률 커버리지 (← `plans/horizons/general-legal-coverage.md`)
- **milestone**: LB1 — 검색 품질을 **측정 가능한 수치**로 만든다. 지금은 "잘 되는 것 같다"는 인상뿐이라
  개선을 주장할 수도 반증할 수도 없다. 규모 근거: 골든셋 데이터·러너·기준선 리포트가 각각 독립
  changeset(≥3)이고, 통합검증 = 기준선 수치가 실제로 산출됨.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 측정만 만든다. **이 milestone 에서 검색 로직을 고치지 않는다** — 측정과 개선을 같은
  changeset 에 섞으면 기준선이 오염된다.
- **중단점(stop points)**: blocked / error / decision_required(골든셋 정답 라벨에 사용자 판단이
  필요한 항목 >5건) / risk_gate(실 API 인증·rate limit) / 기준선 산출 완료.
- 롤백/정리: 신규 파일만 추가하므로 롤백 = 해당 커밋 revert(`src/` 무변경). 임시 프로브
  스크립트는 레포에 남기지 않는다(scratchpad 또는 삭제).

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포(`~/projects/law-mcp`). 배포본 `~/projects/custom-mcps/law-mcp` 는
  실행 설치본이며 편집 금지 — 반영은 push → 사본 `git pull && npm run build` → MCP 재시작(사용자).
- 검증: `npm test`(node:test) + 실 API 러너 `npm run bench:golden`. 골든셋 자체는 라벨 데이터라
  단위테스트 대상이 아니고, 러너의 채점 로직만 단위테스트한다.
- 배포/운영: 해당 없음 — 벤치 러너는 개발 도구이며 MCP 도구로 노출하지 않는다(도구 표면 오염 방지).

**② 자기선언 도메인**
- **데이터(골든셋)**: 형식 = JSON(`bench/golden.json`). 항목당 `{query, domain, expected_laws[],
  expected_article?, split}`. 규모 = 5도메인 × 8쿼리 = 40건(개발 26 / 홀드아웃 14). 정답 라벨 근거는
  항목마다 `source` 필드에 법령명·조문 또는 확인 방법을 적는다.
- **채점**: 1차 지표 = 정답 법령 top-3 포함률(recall@3). 보조 = recall@1, 조문 정확도(조문 라벨이
  있는 항목만), 도구별 hit율. 법령명 비교는 정규화 후 완전일치(`normalizeLawName` 재사용).
- **과적합 방지**: `split` 필드로 dev/holdout 분리. **홀드아웃은 LB2 완료 시점에 단 한 번만 측정**하며,
  LB1·LB2 튜닝 중 열람·측정 금지(프리모템 시나리오 1의 예방 장치).
- **비용/레이트**: 러너는 쿼리 간 순차 실행 + 실패 시 재시도 없음. 40건 × 2도구 ≈ 80콜.
- 검토 후 제외: 화면·디자인(사용자 인터페이스 없음) · 관측(로컬 개발 도구라 에러 수집 불요) ·
  인증/크레덴셜(`LAW_API_OC` 는 이미 `.env` 에 있음, 신규 시크릿 없음) · 데이터 마이그레이션(신규 파일만).

## 결정 로그

- status: resolved
- **골든셋 도메인 구성** → 확정: 부동산/임대차·노동·계약민사·형사·가족 5종 + 기존 세무는 회귀
  스위트로 별도 유지(2026-07-20, 리서치 §1 도메인 그대로).
- **정답 라벨을 누가 정하나** → 확정: 에이전트가 법령 원문으로 근거를 붙여 초안 작성하고, **판단이
  갈리는 항목만** 사용자에게 묶어 확인(중단점 ①). 근거 없이 추정 라벨 금지.
- **지표 선택(recall@3 1차)** → 확정: 에이전트 판단으로 진행 — MCP 소비자(에이전트)가 상위 몇 건을
  실제로 읽는지를 반영한 값이며, 사용자 취향 결정이 아니다.
- 그 외 사용자 소유 결정: **없음**.

## Step 트리

- [ ] **step-1** golden-set — 골든셋 데이터 작성
  - Artifact: `bench/golden.json`(40항목, dev 26/holdout 14) + `bench/README.md`(라벨 규약·홀드아웃 규칙)
  - Files: write `bench/golden.json`·`bench/README.md` / read `research/2026-07-20-general-legal-coverage-probe.md`
  - Dependencies: 없음
  - Verify: `node -e` 로 JSON 파싱 + 스키마 필드 완전성(모든 항목에 query·domain·expected_laws·split·source) 확인, dev/holdout 비율 출력
  - Failure probe: `expected_laws` 가 빈 항목·`source` 없는 항목이 있으면 실패로 보고(라벨 근거 누락 검출)
  - Commit: `changesets/20260720-lb1-golden-set/`
- [ ] **step-2** bench-runner — 채점 러너 구현
  - Artifact: `bench/run.ts` + `package.json` 에 `bench:golden` 스크립트 + 채점 로직 단위테스트
  - Files: write `bench/run.ts`·`test/bench-scoring.test.ts`·`package.json` / read `src/providers/lawgo-provider.ts`
  - Dependencies: step-1
  - Verify: `npm test`(채점 로직 단위테스트 통과 — 정규화 일치·recall@k 계산·조문 비교) + `npm run bench:golden -- --split dev --dry-run` 이 API 호출 없이 항목 수를 출력
  - Failure probe: 정답이 0건인 가짜 항목·API 에러 응답을 주입해 러너가 크래시 없이 0점 처리하고 사유를 리포트하는지 확인
  - Commit: `changesets/20260720-lb1-bench-runner/`
- [ ] **step-3** baseline — 기준선 실측·기록
  - Artifact: `evidence/bench/2026-07-20-baseline.json` + `evidence/bench/README.md` 요약표
  - Files: write `evidence/bench/*` / read `bench/*`
  - Dependencies: step-2
  - Verify: `npm run bench:golden -- --split dev` 실행 → recall@3·recall@1·조문 정확도·도구별 hit율이 수치로 출력되고 파일로 저장됨. 리서치 실측치(31%)와 같은 자릿수인지 대조.
  - Failure probe: 실 API 인증 실패·rate limit 시 러너가 부분 결과를 저장하고 실패 항목을 명시하는지 확인
  - Commit: `changesets/20260720-lb1-baseline/`

## 검증/DoD

- **DoD**: `npm run bench:golden -- --split dev` 가 실 API 로 완주해 **recall@3 기준선 수치**를
  파일로 남긴다. 홀드아웃은 미측정 상태로 봉인(파일에 측정 이력 없음으로 확인).
- 실패 경로: 위 각 step 의 Failure probe 3종.
- 회귀: `npm test` 전량 통과(기존 25건 + 신규).

## hard-stop policy

- blocked/error → `.harness/work.json` 에 `stop_reason` 기록 후 정지.
- 골든셋 라벨 판단이 갈리는 항목 >5건 → 묶어서 사용자 질의(정지).
- 실 API 인증 실패·rate limit → 정지(재시도 루프 금지).

## rollback/cleanup

- 신규 파일만 추가하므로 롤백 = 해당 커밋 revert. `src/` 는 이 milestone 에서 건드리지 않는다.
- 임시 프로브 스크립트는 레포에 남기지 않는다(scratchpad 또는 삭제).

## finding 큐

- (실행 중 발견 시 추가)

## 진행 로그 (append-only)

- 2026-07-20 plan 작성 (승인 대기)
