# PLAN — LB5 용어 연계로 품질 2축(넓이·도달) 개선

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-lb5-term-linkage-probe.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-21 — 사용자 '진행'. 위임 범위 A=horizon 연쇄)

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 범용 법률 커버리지 (← `plans/horizons/general-legal-coverage.md`) — LB1~LB3 완료로
  커버리지 축은 닫혔고, **닫는 기준 중 품질 2축이 미달**이라 이 milestone 이 그 갭을 친다.
- **milestone**: LB5 — 법제처가 제공하는 **용어 연계 색인**(`lstrmAI`/`lstrmRlt`/`lstrmRltJo`)과
  **법령 약칭**(`lsAbrv`)을 후보 생성에 편입해 blind recall@3 44% / assisted acc@3 62.5% 를 올린다.
  규모 근거: 클라이언트·넓이 통합·도달 통합·약칭·홀드아웃이 독립 changeset 5, 통합검증 = 2모드 재측정.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 후보 **생성**과 **순위**에만 관여한다. 신규 MCP 도구를 노출하지 않는다(도구 11개 유지) —
  이 milestone 은 표면 확대가 아니라 기존 표면의 정확도 개선이다.
- **제외**: `dlytrm`(일상용어) — 링크 계약이 불안정해 리서치에서 제외 판정. 골든셋 라벨 재작성.
  큐레이션 조문 색인(C안) — 조건부 판정 유지, 이 milestone 결과가 그 조건의 입력이 된다.
- **중단점(stop points)**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  dev A/B 에서 이득 없음(=가설 기각 후 정지·기록).
- 롤백/정리: 용어 연계는 **기존 결과 위에 얹는 추가 채널**이라, 편입 지점 1곳을 끄면 기존 동작으로
  즉시 복귀한다. 각 step 은 독립 커밋이라 회귀 시 해당 커밋만 revert.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → 사본 pull+build → MCP 재시작(사용자).
- 검증: `npm test`(fixture 단위) + `npm run bench:golden`(dev A/B, 2모드) + 실 API 스모크.
- 배포/운영: 도구 표면 **불변**(11개) — description 변경 없으면 재시작 불요. 내부 동작만 변한다.

**② 자기선언 도메인**
- **가설 검증 방식**: 모든 편입은 **A/B 필수**. 기존 경로 단독 대비 dev 수치가 오르지 않으면
  채택하지 않고 기각 기록만 남긴다(지금까지 가설 4개가 이 방식으로 죽었다).
- **무신호 시 순서 보존**: 용어 연계가 0건이거나 약하면 **기존 순서를 흔들지 않는다**(ib3 교훈 —
  신호 없이 재정렬했다가 법인세법이 1위→5위로 밀린 실패).
- **의미 충돌 방어**: 이 색인은 개념이 아니라 *낱말이 쓰인 자리*를 가리킨다("숙려기간"→자본시장법).
  리서치에서 관측된 **연계 건수 문턱**(적중 3건은 5~26건, miss 3건은 전부 1건)을 가설로 놓고
  dev 로 문턱값을 실측해 정한다.
- **비용 예산**: 검색 1회당 추가 upstream 호출 **≤2**(용어검색 1 + 조문연계 1), 결과 캐시 필수,
  실패 시 기존 경로로 graceful degrade. DoD 에 지연 측정 포함.
- **약칭 측정 분리**: 약칭 이득은 **별도 쿼리 세트**로 잰다. 기존 골든셋 40건에 약칭 쿼리를 섞으면
  LB1 이후의 수치 비교가능성이 깨진다.
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음) · 관측 · 신규 도구 노출.

## 결정 로그

- status: resolved
- **기존 경로 대체 vs 보완** → 확정: **보완**. 리서치 3/8 적중이라 대체는 회귀.
- **약칭 쿼리를 골든셋에 편입하나** → 확정: **아니오, 별도 세트**. 비교가능성 보존.
- **`dlytrm` 포함 여부** → 확정: 제외(링크 계약 불안정).
- **홀드아웃 재측정 허용** → 확정(2026-07-21 사용자 승인): **dev 에서 개선이 확인된 경우에만
  1회 더** 열고, 그 뒤 이 세트는 **은퇴**시킨다. dev 이득이 없으면 홀드아웃을 열지 않는다.
  (홀드아웃 15건은 LB2 에서 1회 소진 — 이번이 마지막 사용이다.)
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** term-linkage-client — 용어 연계 클라이언트 + 캐시
  - Artifact: `src/term-linkage.ts`(`lstrmAI`→`lstrmRlt`/`lstrmRltJo` 조회·정규화·LRU 캐시)
  - Files: write `src/term-linkage.ts`·`test/term-linkage.test.ts` / read `src/providers/source-adapter.ts`
  - Dependencies: 없음
  - Verify: `npm test` — fixture 로 용어→법령·조문 매핑 정확성 + 캐시 히트 시 추가 호출 0
  - Failure probe: 용어 0건·연계 0건·HTTP 실패 주입 시 예외 없이 빈 결과 + 기존 경로 보존 확인
  - Commit: `changesets/20260721-lb5-term-linkage-client/`
- [ ] **step-2** candidate-boost — 넓이(①) 편입 + dev A/B
  - Artifact: `searchLaw` 후보에 용어 연계 법령을 **추가 후보로 병합**(대체 아님) + 문턱값 실측 리포트
  - Files: write `src/providers/lawgo-provider.ts`·`test/*`·`evidence/bench/*` / read `src/term-linkage.ts`
  - Dependencies: step-1
  - Verify: `npm run bench:golden -- --split dev` — blind recall@3 가 44.0% 대비 **상승**해야 채택.
    연계 건수 문턱 1·2·3 을 비교해 최적값을 근거와 함께 고정
  - Failure probe: 용어 연계 무신호 쿼리에서 기존 순서가 **바이트 단위로 동일**한지 확인
  - Commit: `changesets/20260721-lb5-candidate-boost/`
- [ ] **step-3** article-hint — 도달(②) 편입 + dev 측정
  - Artifact: assisted 경로에서 용어→조문 연계를 조문 점수에 가산(무신호 시 기존 점수 유지)
  - Files: write `src/article-match.ts`·`test/*`·`evidence/bench/*` / read `src/term-linkage.ts`
  - Dependencies: step-1
  - Verify: `npm run bench:golden -- --split dev --mode assisted` — acc@1/acc@3 이 50.0%/62.5% 대비 상승
  - Failure probe: 연계가 오답 조문을 줄 때(숙려기간→자본시장법 류) 기존 정답을 밀어내지 않는지
    — 해당 쿼리 전후 순위를 표로 대조
  - Commit: `changesets/20260721-lb5-article-hint/`
- [ ] **step-4** abbrev — 법령 약칭 흡수 + 별도 세트 측정
  - Artifact: `lsAbrv` 약칭↔정식명 매핑을 이름매칭 단계에 적용 + 약칭 쿼리 세트 10건 신설·측정
  - Files: write `src/law-abbrev.ts`·`bench/abbrev-set.json`·`test/*`·`evidence/bench/*`
  - Dependencies: 없음(step-1~3 과 독립)
  - Verify: 약칭 세트에서 정식명 도달률 측정 + **기존 골든셋 dev 수치 무변**(회귀 아님을 증명)
  - Failure probe: 약칭이 여러 법에 걸리는 모호 케이스에서 오답 1위를 만들지 않는지 확인
  - Commit: `changesets/20260721-lb5-abbrev/`
- [ ] **step-5** holdout-and-verdict — 홀드아웃 1회 + 종합 판정
  - Artifact: 홀드아웃 2모드 측정 + horizon 닫는 기준 대조 + C안 조건 재평가
  - Files: write `evidence/bench/*`·`plans/horizons/general-legal-coverage.md`(닫는 기준 대조표)
  - Dependencies: step-2, step-3, step-4
  - Verify: dev 대비 홀드아웃 격차로 과적합 판정 + 닫는 기준(≥70%) 도달 여부를 수치로 대조
  - Failure probe: 홀드아웃이 dev 보다 크게 낮으면 **과적합으로 판정하고 채택을 되돌린다**
  - Commit: `changesets/20260721-lb5-holdout-verdict/`

## 검증/DoD

- **DoD**: ① dev blind recall@3 가 44.0% 대비 상승하고 그 근거가 A/B 로 제시됨 ② dev assisted
  acc@3 가 62.5% 대비 상승 ③ 무신호 쿼리에서 기존 결과 무변(회귀 없음) ④ 검색 1회 추가 호출 ≤2 ·
  지연 측정 기록 ⑤ 홀드아웃 1회 측정으로 과적합 여부 판정 ⑥ `npm test` 전건 통과.
- **이득이 없으면**: 채택하지 않고 기각 근거를 evidence 에 남긴다 — 이것도 정상 종료다.

## hard-stop policy

- dev A/B 에서 이득이 없거나 회귀 → 채택 중단, 기각 기록 후 정지·보고.
- dev 이득이 확인되지 않은 채 step-5 홀드아웃을 여는 것 금지(승인 조건부 — 위 결정 로그).
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 편입 지점(후보 병합·조문 가산) 각 1곳을 끄면 기존 동작으로 복귀.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F1: `dlytrm` 링크 계약 재조사(안정화되면 일상용어 채널 추가 가능).
- F2: 연계 건수 외의 신뢰도 신호(용어구분 `선정용어` 등) 활용.

## 진행 로그 (append-only)

- 2026-07-21 plan 작성 — 리서치 `2026-07-21-lb5-term-linkage-probe.md` 선행
- 2026-07-21 사용자 승인 "진행" — 범위 A(horizon 연쇄), 홀드아웃 조건부 1회 후 은퇴.
  이후 이 문서는 동결한다(체크박스·진행 상태는 work.json·changeset 이 정본).
