# PLAN — TV4 세법 도달 결함 수리

> 생성: 2026-07-21 · 갈래: tooling · 소비 증거: `evidence/bench/2026-07-21-admin-domain-diagnosis.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-21 사용자 "응 그렇게 해")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 세법을 끝까지 (← `plans/horizons/tax-vertical.md`)
- **milestone**: TV4 — 2026-07-21 실측에서 `세금계산서 지연발급 가산세` 가 **부가가치세법을 후보에
  올리지도 못했다.** 행정 도메인 진단이 규명한 것과 같은 결함이다: 본문검색은 가나다순인데
  우리는 앞 30건만 받으므로 뒷글자 법령(부·행·환)이 구조적으로 탈락한다. 그 진단은 **평가 세트가
  없어서** 규칙을 채택하지 못하고 멈췄다(F5 과적합 위험). TV1 이 그 전제조건을 채웠으므로 이제 열린다.
  규모 근거: 조문제목 신호·풀 도달·채택 판정이 독립 changeset 3, 통합검증 = 교차 A/B 손실 0 + 순 이득.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 후보 생성·재정렬만. 응답 스키마 변경 없음, 도구 description 변경 없음
  (**MCP 재시작을 새로 요구하지 않는다**).
- **제외**: 새 자료원 · 시점 축(TV3) · 별표(TV5) · `aiSearch` 자체 교체.
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **교차 A/B 순 이득 <2건 → 미채택 후 기록·정지**(행정 진단이 이미 이득 0 을 실측했다 — 반복 가능) /
  **손실 ≥1건 → 재설계 1회 후에도 안 되면 정지**.
- 롤백/정리: 두 변경 모두 켜고 끄는 지점이 1곳씩.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → 배포 사본 build. **응답 스키마·description 불변 →
  MCP 재시작 불요.**
- 검증: `npm test` + `bench/ud2-ab.ts` 방식 **교차 A/B**(드리프트 방어) + `bench:golden` 양 세트 + dist 스모크.
- 배포/운영: 도구 개수·스키마 불변. 사용자 조치 불요.

**② 자기선언 도메인**
- **왜 지금은 되나**: 행정 진단은 "새 평가 세트 없이 이 규칙을 채택하면 안 된다"로 닫혔다.
  TV1 이 세법 dev 30 / holdout 20 을 만들었으므로 **판정 근거가 생겼다.** 이 순서를 어기면
  이 milestone 은 무효다.
- **조문제목 신호**: 실패 사례 전부에서 정답 법의 **조문제목이 쿼리와 거의 일치**한다
  (`세금계산서 지연발급 가산세` → 부가가치세법 §60 `가산세`, 행정 3건도 동일 패턴). 이름 길이보다
  훨씬 강한 관련도 신호다. 재료(`src/article-index.ts` `extractArticles`)는 LB2 에 이미 있다.
- **후보를 어떻게 좁히나**: 법령 전문 1건이 300~600KB 라 전 후보의 조문을 받을 수 없다.
  행정 진단이 제안한 이름 형태 규칙(`~기본법`·`~절차법`)은 **세법에서 오작동한다**
  (`국세기본법`·`건설산업기본법` 이 함께 걸린다 — 진단 문서가 이미 경고). → **이름 형태로 좁히지
  않는다.** 대신 upstream 이 이미 준 신호(`aiSearch` 상위·용어 연계·본문검색 상위)로 **상위 N개만**
  조문을 열어 제목을 대조한다. N 은 비용 예산에서 도출(아래).
- **과적합 방어 (F5)**: 규칙에 **법명·도메인·쿼리 토큰 하드코딩 금지**. 선례 `src/parent-law.ts`
  와 같은 규율. 규칙이 일반적이지 않으면 채택하지 않는다.
- **비용 예산**: 검색 1회당 추가 전문 조회 **≤3건**, 검색 1회 지연이 TV3 대비 **늘지 않아야** 한다.
  초과하면 N 을 줄이거나 미채택.
- **판정 방식**: UD2·UD4 와 동일 — **쿼리마다 배치를 연달아 재는 교차 측정**(F13, 이 벤치의 문제는
  노이즈가 아니라 드리프트다). 채택 조건 = **손실 0 AND 순 이득 ≥2**. 손실 0 은 낮추지 않는다.
- **풀 도달**: 본문검색 페이징(행정 진단에서 구현했다가 되돌린 코드)을 되살리되, **조문제목
  신호와 함께만** 채택한다 — 진단이 확정한 바 단독으로는 이득 0 이다.
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증 · 관측 · 신규 도구 · 응답 스키마 · 새 자료원.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **응답 스키마** — 필드를 추가하고 싶어지면 그건 TV4 가 아니다.

## 결정 로그

- status: resolved
- **이름 형태 규칙(`~기본법`)을 쓰나** → 확정: **아니오.** 세법에서 `국세기본법` 오작동이 예견된다.
- **풀 도달을 단독 채택하나** → 확정: **아니오.** 행정 진단 실측 이득 0. 조문제목 신호와 묶음.
- **채택 문턱** → 확정: **손실 0 AND 순 이득 ≥2**(UD4 선례).
- **이득이 없으면** → 확정: **미채택하고 기각 근거를 남긴다.** 이것도 정상 종료다.
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** 조문제목 신호 — upstream 상위 후보의 조문제목을 쿼리와 대조한다
  - Artifact: `src/article-title-signal.ts` — 상위 N(비용 예산에서 도출) 후보의 조문을 열어
    제목·쿼리 대조 점수 산출 후 재정렬. 법명·도메인·토큰 하드코딩 없음
  - Files: write `src/article-title-signal.ts`·`test/article-title-signal.test.ts`·
    `src/providers/lawgo-provider.ts` / read `src/article-index.ts`·`src/parent-law.ts`(규율 선례)
  - Dependencies: 없음 (TV1 완료가 전제)
  - Verify: `npm test` — 하드코딩 부재를 테스트로 고정 · 추가 조회 ≤3 · 캐시 동작 +
    `npx tsx bench/ud2-ab.ts --set golden-tax --split dev` 교차 A/B
  - Failure probe: 전문 조회가 HTTP 503 으로 실패했을 때 **기존 순위 그대로 반환**되는지 확인 —
    신호가 없으면 조용히 나빠지는 게 아니라 원상태여야 한다
  - Commit: `changesets/20260721-tv4-article-title-signal/`
- [ ] **step-2** 본문검색 풀 도달 — 가나다순 절단을 없앤다
  - Artifact: 본문검색 페이징(페이지 크기·상한·병렬) 재도입. **상한 초과 시 절단 경고**를
    응답 경고에 싣는다(조용한 절단 금지)
  - Files: write `src/providers/lawgo-provider.ts`·`test/body-search-pool.test.ts` /
    read `evidence/bench/2026-07-21-body-pool-ab.json`(직전 실측)
  - Dependencies: step-1
  - Verify: `npm test` + `세금계산서 지연발급 가산세` 에서 **부가가치세법이 후보 풀에 들어오는지**
    실 API 관측 + 검색 1회 지연이 TV3 대비 증가하지 않음
  - Failure probe: `totalCnt` 가 상한을 크게 넘는 쿼리(600+)에서 **절단 경고가 실제로 발화**하는지
    확인 — 조용한 절단이 이 결함의 원인이었다
  - Commit: `changesets/20260721-tv4-body-pool/`
- [ ] **step-3** 채택 판정 — 손실 0 AND 순 이득 ≥2 아니면 되돌린다
  - Artifact: `evidence/bench/2026-07-21-tv4-verdict.md` — 교차 A/B(세법 dev + 범용 dev), 지연,
    채택/기각 근거. 기각이면 **되돌린 상태로 커밋**
  - Files: write `evidence/bench/2026-07-21-tv4-verdict.md`·
    `changesets/20260721-tv4-verdict/README.md`·`ROADMAP.md` / read 전 step 산출물
  - Dependencies: step-1, step-2
  - Verify: 교차 A/B **손실 0 AND 순 이득 ≥2** + `--set golden-v2 --split dev` **≥88%** +
    `npm test` 전건 + **배포 사본 build + dist 스모크**
  - Failure probe: 되돌림 경로를 실제로 실행해 **TV3 상태로 정확히 복귀**하는지 확인
  - Commit: `changesets/20260721-tv4-verdict/`

## 검증/DoD

- **DoD**: ① 조문제목 신호에 **법명·도메인·쿼리 토큰 하드코딩 없음**(테스트 고정)
  ② 추가 전문 조회 ≤3건/검색 ③ 상류 실패 시 원상태 반환 ④ 절단 경고 발화 관측
  ⑤ `세금계산서 지연발급 가산세` → 부가가치세법 도달 ⑥ 교차 A/B **손실 0 AND 순 이득 ≥2**
  ⑦ 범용 dev 셋 ≥88% ⑧ 검색 지연 증가 없음 ⑨ `npm test` 전건 ⑩ **배포 사본 build + dist 스모크**
  ⑪ 응답 스키마·도구 개수 불변(재시작 불요).
- **이득이 없으면**: 되돌리고 기각 근거를 evidence 에 남긴다 — 정상 종료다. 행정 진단이 이미
  같은 결말을 한 번 냈다.

## hard-stop policy

- 교차 A/B 순 이득 <2 → 미채택, 되돌림 후 정지·보고.
- 손실 ≥1 → 재설계 1회 후에도 안 되면 정지·보고.
- 추가 조회가 예산(≤3)을 넘어야만 이득이 남 → **미채택**(비용으로 산 이득은 안 산다).
- 홀드아웃 개봉 **금지** — TV6 소관.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 조문제목 신호: 재정렬 후처리 1단계 — 빼면 복귀.
- 풀 도달: 페이징 상수 1곳 — 되돌리면 앞 30건으로 복귀.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F5(과적합): 세법 dev 30 에 맞춘 규칙이 holdout 20 에서 무너질 수 있다 — TV6 이 판정한다.

## 진행 로그 (append-only)
