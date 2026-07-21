# PLAN — TV1 세법 평가 세트

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-tax-domain-tax-practice-sources.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: 승인 대기

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 세법을 끝까지 (← `plans/horizons/tax-vertical.md`)
- **milestone**: TV1 — 이 horizon 의 **모든 판정이 딛고 설 바닥**을 만든다. 직전 horizon 의 홀드아웃
  15건은 close 개봉으로 소진됐고, 세법 전용 라벨은 애초에 없다. 세트 없이 TV2~TV5 를 채택하면
  그게 정확히 F5 과적합이다(행정 도메인 진단이 이미 이 이유로 멈췄다).
  규모 근거: 라벨 세트·세법 채점축·기준선 측정이 독립 changeset 3, 통합검증 = 신뢰구간이 붙은
  세법 기준선 산출.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 평가 자산과 채점 코드만. `bench/` 아래와 `evidence/` 만 건드린다.
- **제외**: `src/` **일체 수정 금지**(측정 도구를 만들면서 측정 대상을 바꾸면 기준선이 무의미해진다) ·
  세법 결함 수리(TV2~TV5 소관) · 구 `golden-v2` 세트 변경.
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **라벨 정답을 조문 직접 확인으로 고정하지 못하는 질의가 20% 초과** → 유형 재설계 후 재개.
- 롤백/정리: 신규 파일만 추가하므로 되돌리면 흔적이 없다.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 이 milestone 은 **배포 사본 반영이 불요**하다(`src/` 미변경 —
  런타임 산출물이 없다). MCP 재시작도 불요.
- 검증: `npm test`(신규 라벨 스키마 테스트) + `bench/verify-labels.ts` + 반복측정 기준선.
- 배포/운영: **해당 없음 — 평가 자산은 MCP 표면에 노출되지 않는다.**

**② 자기선언 도메인**
- **질의 유형 분포**: 도메인 리서치 §2 가 관측한 실무 분포를 따른다 — 비과세/공제 요건 판단
  40%(양도세·법인세 손금·세액공제), 나머지 60% 를 상속·증여 / 불복·경정청구 / 원천징수·가산세 /
  신고기한 / 절차(사전답변 vs 서면질의)에 분산. ⚠ 리서치가 **원천징수·가산세는 실사례 출처를
  못 찾았다**고 명시했으므로, 이 유형은 블로그가 아니라 **법령 조문에서 직접 구성**한다.
- **라벨링 방향 (프리모템 ① 예방)**: **도구를 먼저 두드려서 질의를 만들지 않는다.** 질의를
  유형 분포에서 먼저 뽑고, 정답은 `get_law_article` 로 조문을 **직접 열어 확인**해 고정한다.
  도구가 지금 못 찾는 질의가 세트에 남는 것이 정상이고 그게 이 세트의 존재 이유다.
- **필수 포함**: 2026-07-21 실측에서 실패한 2건 — `과세표준 신고 후 경정청구 기한`(국세기본법
  §45조의2) · `세금계산서 지연발급 가산세`(부가가치세법 §60②1). 성공한 2건도 회귀 고정용으로 포함.
- **분할·봉인**: dev / holdout 분리. 홀드아웃은 `assertHoldoutSeal`(UD1 산출)을 **그대로 재사용**해
  `--i-am-closing-the-horizon` 없이는 열리지 않게 한다. 새 봉인 기계를 만들지 않는다.
- **세트 크기**: dev 30 / holdout 20. 근거 — 구 세트는 dev 25 / holdout 15 였고 노이즈가 ±1건(4%p)
  였다. 세법은 유형이 넓어(6유형) 유형당 최소 5건을 확보하려면 30 이 필요하다.
- **세법 전용 채점축**: 기존 recall@k(법령 도달)에 더해 ② **조문 정확도**(정답 조문번호 일치)
  ③ **시점 정확도**(TV3 이 채울 자리 — 지금은 필드만 두고 측정은 `n/a`).
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음) · 관측 · 신규 MCP 도구 ·
  응답 스키마 · 배포.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **`src/` 변경** — 이 milestone 에서 코드를 고치고 싶어지면
  그건 TV1 범위가 아니다. 발견은 finding 큐로만 남긴다.

## 결정 로그

- status: resolved
- **세트를 새로 만드나, 구 세트를 확장하나** → 확정: **새로 만든다**(`golden-tax`). 구 `golden-v2`
  는 범용 회귀 감시용으로 그대로 살려 둔다(닫는 기준 5 가 이걸 쓴다). 섞으면 세법 점수와 범용
  점수를 분리해 볼 수 없다.
- **홀드아웃 봉인 기계를 새로 만드나** → 확정: **아니오.** `assertHoldoutSeal` 재사용.
- **라벨 정답을 누가 정하나** → 확정: **조문 직접 확인.** 외부 블로그를 정답 근거로 쓰지 않는다
  (리서치의 실무 자료는 *유형 분포* 근거로만 쓰고 정답 근거로는 쓰지 않는다).
- **몇 건짜리 세트인가** → 확정: dev 30 / holdout 20 (위 근거).
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** golden-tax 라벨 세트 — 실무 유형 분포에서 뽑고 조문 직접 확인으로 고정
  - Artifact: `bench/golden-tax.json` — dev 30 / holdout 20. 항목마다 `query`·`expected_laws`·
    `expected_articles`·`type`(6유형)·`tax_year`(TV3 이 쓸 자리, 미지정 가능)·`label_source`
    (확인한 조문 경로)
  - Files: write `bench/golden-tax.json`·`test/golden-tax.test.ts` / read `bench/golden-v2.json`·
    `bench/verify-labels.ts`·`research/2026-07-21-tax-domain-tax-practice-sources.md`
  - Dependencies: 없음
  - Verify: `npx tsx bench/verify-labels.ts --set golden-tax` 가 전건의 정답 조문을 실 API 로
    **실제로 열어 존재 확인** + `npm test` 로 스키마·유형 분포(유형당 ≥5)·dev/holdout 중복 0 검증
  - Failure probe: 존재하지 않는 조문번호를 정답으로 넣은 항목을 일부러 주입해
    `verify-labels` 가 **실패로 잡는지** 확인(라벨 검증이 실제로 도는지)
  - Commit: `changesets/20260721-tv1-golden-tax/`
- [ ] **step-2** 세법 채점축 — 조문 정확도·시점 정확도 축 추가 + 홀드아웃 봉인 연결
  - Artifact: `bench/scoring.ts` 에 조문 정확도(정답 조문번호 일치율)·시점 정확도(자리만, `n/a`)
    추가. `bench/run.ts` 가 `--set golden-tax` 를 받고 홀드아웃에 `assertHoldoutSeal` 적용
  - Files: write `bench/scoring.ts`·`bench/run.ts`·`test/bench-runner.test.ts` / read
    `bench/golden-tax.json`
  - Dependencies: step-1
  - Verify: `npm test` — 조문 정확도 계산이 부분일치(제60조 vs 제60조제2항)를 규칙대로 처리하는지 +
    `--set golden-tax --split holdout` 이 **개봉 플래그 없이 거절**되는지
  - Failure probe: `--split holdout` 을 플래그 없이 실행해 **실제로 exit 1** 로 거절되는 것을 관측
    (봉인이 선언만 있고 안 도는 상태를 배제)
  - Commit: `changesets/20260721-tv1-tax-scoring/`
- [ ] **step-3** 세법 기준선 — dev 반복측정으로 신뢰구간 붙은 출발점 확정
  - Artifact: `evidence/bench/2026-07-21-tv1-tax-baseline.md` + `.json` — recall@1/@3, 조문 정확도,
    유형별 분해(어느 유형이 약한가), 표준편차. **유형별 분해가 TV2~TV5 의 우선순위 근거가 된다**
  - Files: write `evidence/bench/2026-07-21-tv1-tax-baseline.{md,json}`·
    `changesets/20260721-tv1-tax-baseline/README.md`·`ROADMAP.md` / read 전 step 산출물
  - Dependencies: step-1, step-2
  - Verify: `npm run bench:golden -- --set golden-tax --split dev --repeat 3` 완주 +
    표준편차가 보고서에 기재 + `npm test` 전건
  - Failure probe: 실 API rate limit 으로 회차가 실패했을 때 러너가 **부분 결과를 성공으로
    보고하지 않는지** 확인(에러 건수를 보고서에 별도 기재)
  - Commit: `changesets/20260721-tv1-tax-baseline/`

## 검증/DoD

- **DoD**: ① `bench/golden-tax.json` dev 30 / holdout 20, 유형당 ≥5, dev·holdout 중복 0
  ② 전건의 정답 조문이 실 API 조회로 존재 확인됨(`verify-labels` PASS)
  ③ 2026-07-21 실패 2건이 세트에 포함
  ④ 홀드아웃이 플래그 없이 **exit 1 로 거절**(관측 완료)
  ⑤ 조문 정확도 축이 채점에 실제로 반영
  ⑥ dev 기준선이 **n=3 표준편차와 함께** 기록되고 유형별로 분해됨
  ⑦ `npm test` 전건 ⑧ `src/` diff **0 줄**(측정 대상 불변 증명 — `git diff --stat src/` 로 확인).
- **배포**: 해당 없음(런타임 미변경). 실표면 스모크도 해당 없음 — TV2 에서 처음 발화한다.

## hard-stop policy

- 정답을 조문 직접 확인으로 고정 못 하는 질의가 20% 초과 → 유형 재설계 1회 후에도 안 되면 정지·보고.
- `verify-labels` 가 실패로 잡는 라벨이 남음 → 라벨 수정, 코드 완화 **금지**.
- 홀드아웃 봉인이 안 도는 것을 발견 → 즉시 정지(이 세트는 봉인 없이는 무가치).
- `src/` 를 고쳐야만 진행된다고 판단됨 → **그건 TV1 이 아니다.** finding 큐에 남기고 정지·보고.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 전부 신규 파일 — 되돌리면 흔적 없음.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- 라벨링 중 발견한 도구 결함은 **고치지 말고** 여기 적는다 — TV2~TV5 의 입력이 된다.

## 진행 로그 (append-only)
