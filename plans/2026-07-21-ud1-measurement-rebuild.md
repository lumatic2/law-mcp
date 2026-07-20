# PLAN — UD1 측정 기반 재건

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-lawgo-api-survey.md` §E 선행 필요
> execution mode: continuous
> milestone-레벨 durable plan doc.

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 법제처가 가진 능력을 그대로 전달 (← `plans/horizons/upstream-delivery.md`)
- **milestone**: UD1 — **다음 개선을 판정할 수 있는 상태로 되돌린다.** 지금 이 레포는 측정 불능이다:
  홀드아웃 15건은 LB5 에서 소진·은퇴했고, 같은 코드를 두 번 돌리면 72.0%/76.0% 가 나오는데
  그 노이즈 폭이 정량화되지 않았다. `aiSearch` 편입처럼 큰 변경일수록 이게 먼저다.
  규모 근거: 세트 라벨링·반복측정 러너·기준선 재측정이 독립 changeset 3, 통합검증 = 신뢰구간이
  붙은 기준선 산출.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 측정 도구만 건드린다. **`src/` 의 검색 로직은 이 milestone 에서 한 줄도 바꾸지 않는다** —
  LB1 과 같은 원칙(측정과 개선을 같은 milestone 에 섞으면 무엇이 무엇을 움직였는지 못 가린다).
- **제외**: 새 MCP 도구 · 검색 알고리즘 변경 · `aiSearch`(UD2 소관).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  라벨 근거를 실 API 로 확인할 수 없는 항목이 30% 를 넘음(=세트 설계 재검토).
- 롤백/정리: 이 milestone 은 `bench/`·`evidence/` 만 추가한다. 제품 코드 회귀 경로가 없다.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 평가 세트 정본은 `bench/golden-v2.json`(신규), 구 `bench/golden.json`
  은 **비교가능성 보존을 위해 그대로 둔다**(삭제·수정 금지).
- 검증: `npm test`(라벨 스키마·러너 단위) + `npm run bench:golden`(실 API 반복 측정) +
  `npm run bench:verify-labels`(라벨 근거 실 API 확인).
- 배포/운영: **해당 없음** — 도구 표면·제품 코드 불변이라 배포 사본 반영이 필요 없다.

**② 자기선언 도메인**
- **세트 설계**: 신규 40건(dev 25 / holdout 15) — 구 세트와 **같은 크기·같은 분할비**로 만들어
  수치를 나란히 읽을 수 있게 한다. 도메인 균형(노동·형사·민사·행정·세무)을 유지하되 **구 세트와
  쿼리 중복 금지**(중복 검사를 러너에 넣는다).
- **라벨 신뢰성**: 라벨(정답 법령·조문)은 추측하지 않고 **실 API 응답으로 근거를 확인**한다.
  확인 불가 항목은 세트에 넣지 않고 제외 사유를 기록한다.
- **홀드아웃 봉인 규약**: `bench/golden-v2.json` 의 holdout 15건은 **horizon close 시 1회만** 연다.
  UD2·UD3 의 모든 A/B 는 dev 25건으로만 한다. 이 규약을 러너에 **기계적으로** 박는다 —
  `--split holdout` 은 `--i-am-closing-the-horizon` 플래그 없이는 거부한다(사람 기억에 맡기지 않는다).
- **노이즈 정량화 방법**: 같은 설정으로 **n=5 반복 측정** → 평균·표준편차·min/max 를 출력에 싣는다.
  이후 모든 A/B 판정은 "차이 > 2σ" 를 채택 문턱으로 쓴다. upstream 비결정성이 원인이므로
  캐시로 없애지 않는다(실사용과 같은 조건을 재야 한다).
- **비용 예산**: n=5 × 40건 × 2모드 = 실 API 호출이 늘어난다. 반복 측정은 **dev 25건 blind 에만**
  적용하고 전 조합에 걸지 않는다. rate limit 을 만나면 n 을 3 으로 낮추고 그 사실을 기록한다.
- 검토 후 제외: 화면·디자인(측정 산출물은 md/json) · 데이터 스토어 · 인증(신규 시크릿 없음) ·
  관측 · 신규 도구 노출 · 배포.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄 참조 — 이 milestone 은 제품 표면을 건드리지 않아 배포·인증·관측·
  화면 도메인이 모두 해당 없음.

## 결정 로그

- status: resolved
- **첫 milestone 을 측정 세트로 할 것인가** → 확정(2026-07-21 사용자 선택): **예.**
  근거: 새 세트 없이는 다음 개선이 진짜인지 판정 불가 — LB1~LB5 의 실수 반복 위험.
- **구 골든셋을 폐기하나** → 확정: **아니오, 보존.** 구 수치와의 연속성이 필요하고, 구 dev 25건은
  이미 튜닝에 소진돼 신뢰할 수 없지만 *회귀 탐지용*으로는 여전히 쓸모가 있다.
- **라벨을 누가 만드나** → 확정: 에이전트가 실 API 근거를 붙여 작성하고, 근거 미확인 항목은 버린다.
  사용자 라벨링 요청 없음.
- **홀드아웃 열람 시점** → 확정: horizon close 시 1회. 러너가 기계적으로 강제한다.
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** golden-v2 — 신규 평가 세트 라벨링
  - Artifact: `bench/golden-v2.json` — 40건(dev 25 / holdout 15), 항목마다 정답 법령·조문 라벨 +
    **라벨 근거**(확인에 쓴 실 API 호출과 응답 요지) + 도메인 태그
  - Files: write `bench/golden-v2.json`·`bench/verify-labels.ts`(v2 지원)·`test/golden-v2.test.ts` /
    read `bench/golden.json`·`bench/scoring.ts`
  - Dependencies: 없음
  - Verify: `npm run bench:verify-labels -- --set golden-v2` 가 전 항목의 라벨을 실 API 로 확인 +
    `npm test` 로 스키마·구 세트 중복 0 을 고정
  - Failure probe: 구 세트와 중복된 쿼리를 넣었을 때 테스트가 **실패**하는지 확인(중복 검사가
    실제로 도는지) + 라벨 근거가 빈 항목이 통과하지 않는지
  - Commit: `changesets/20260721-ud1-golden-v2/`
- [ ] **step-2** repeat-runner — 반복 측정 + 신뢰구간
  - Artifact: `bench/run.ts` 에 `--repeat n` 추가 — 평균·표준편차·min/max 출력, holdout 봉인 게이트
    (`--split holdout` 은 `--i-am-closing-the-horizon` 없이 거부)
  - Files: write `bench/run.ts`·`bench/scoring.ts`·`test/bench-runner.test.ts` / read `bench/golden-v2.json`
  - Dependencies: step-1
  - Verify: `npm test` — 반복 집계 산술이 고정 입력에서 정확한지 + **홀드아웃 거부가 테스트로 고정**
  - Failure probe: `--split holdout` 을 플래그 없이 실행해 **거부되는 것**을 관측한다(봉인이
    문서가 아니라 코드인지 확인). 1회 실행 시 표준편차가 0 이 아니라 `n/a` 로 나오는지도 확인
  - Commit: `changesets/20260721-ud1-repeat-runner/`
- [ ] **step-3** baseline-v2 — 신 세트 기준선 실측
  - Artifact: `evidence/bench/2026-07-21-ud1-baseline-v2.md` — 현 파이프라인(LB5 상태)의 신 세트
    dev 수치 + n=5 신뢰구간 + 구 세트 수치와의 대조 + **채택 문턱(2σ) 확정값**
  - Files: write `evidence/bench/2026-07-21-ud1-baseline-v2.md`·`changesets/20260721-ud1-baseline-v2/README.md` /
    read `bench/run.ts`
  - Dependencies: step-1, step-2
  - Verify: `npm run bench:golden -- --set golden-v2 --split dev --repeat 5` 완주 + 리포트에
    평균·σ·구간·2σ 문턱이 수치로 기록됨
  - Failure probe: 신 세트 수치가 구 세트(76%)와 **크게 다르면** 그 차이를 세트 난이도 차이로
    설명할 수 있는지 도메인별로 대조한다 — 설명 안 되면 라벨 오류를 의심하고 step-1 로 되돌린다
  - Commit: `changesets/20260721-ud1-baseline-v2/`

## 검증/DoD

- **DoD**: ① `bench/golden-v2.json` 40건이 전부 실 API 근거로 확인된 라벨을 가진다 ② 러너가
  반복 측정 신뢰구간을 출력한다 ③ **홀드아웃 봉인이 코드로 강제**되고 그 거부가 테스트에 고정된다
  ④ 신 세트 dev 기준선이 σ 와 함께 기록되고 이후 A/B 의 채택 문턱(2σ)이 수치로 확정된다
  ⑤ `src/` 무변경(git diff 로 증명) ⑥ `npm test` 전건 통과.
- **실패 경로**: 홀드아웃 무단 열람 시도가 거부되는 것 · 라벨 근거 없는 항목이 반려되는 것 ·
  구 세트 중복이 반려되는 것 — 3가지를 실제로 실행해 관측한다.

## hard-stop policy

- 라벨 근거를 실 API 로 확인 못 하는 항목이 30% 초과 → 세트 설계 재검토, 정지·보고.
- 실 API rate limit → `work.json` `stop_reason=risk_gate` 기록 후 정지.
- `src/` 변경이 필요하다고 판단되면 → **그것은 이 milestone 이 아니다.** finding 큐에 넣고 계속.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 추가 전용 milestone — `bench/golden-v2.json`·러너 플래그·evidence 만 늘어난다.
- 회귀 시 해당 step 커밋만 revert. 구 `bench/golden.json` 경로는 끝까지 그대로 동작한다.

## finding 큐

- F3(상속): 노이즈 정량화 — 이 milestone 이 해소한다.
- F4(상속): `scoreArticles` 미출하 — UD2 에서 조문 출하 경로로 해소 예정.
- F5: 구 골든셋 dev 25건은 튜닝에 소진됐다 — 회귀 탐지 외 용도로 인용하지 않는다.

## 진행 로그 (append-only)

- 2026-07-21 plan 작성 — horizon `upstream-delivery` 개설과 함께 일괄 작성(CS6 horizon-run).
