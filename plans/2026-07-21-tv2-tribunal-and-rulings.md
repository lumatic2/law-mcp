# PLAN — TV2 심판례·예규 편입

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-tax-vertical-upstream-probe.md` §1·§4 ·
> `research/2026-07-21-tax-domain-tax-practice-sources.md` §1
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-21 사용자 "응 그렇게 해")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 세법을 끝까지 (← `plans/horizons/tax-vertical.md`)
- **milestone**: TV2 — 세법 실무에서 실제로 답이 나오는 층이 통째로 비어 있다. 조세심판원
  4,688건("가산세")·국세청 예규 1,938건이 실측으로 열려 있는데 `source` enum 14종에 둘 다 없다.
  노동에서 `nlrc` 로 이 층을 채운 선례를 세법에 적용한다.
  규모 근거: 심판례 어댑터·예규 어댑터·구속력 등급·기여도 게이트가 독립 changeset 4,
  통합검증 = 대표 세무 질의의 해석자료 도달률 + 등급 표기율.

## 범위 / 중단점

- execution mode: continuous
- **범위**: `source-adapter` 확장(descriptor 추가)과 `search_legal_source`/`get_legal_source` 의
  enum·응답. **신규 MCP 도구 없음**(11개 유지 — 자료원은 enum 으로 흡수한다는 UD3 선례).
- **제외**: 세법 기본통칙(법제처 경로 없음 — 실측 0건) · 국세법령정보시스템 스크래핑(별건) ·
  판례(이미 있음) · 랭킹 개선(TV4 소관).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **기여도 게이트 미달**(대표 질의 도달 <70%) → 해당 자료원 미채택 후 기록·정지 /
  **`ntsCgmExpc` 전문 조회 계약이 실재하지 않음** → 메타데이터만 출하로 축소하고 진행.
- 롤백/정리: descriptor 는 표에서 행을 빼면 복귀. 등급 표시는 응답 필드 1개.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → `~/projects/custom-mcps/law-mcp` 에서 `git pull &&
  npm run build`. ⚠ **이 milestone 은 `source` enum 과 응답 스키마를 바꾼다 → MCP 재시작 필요.**
  UD2·UD3 때와 같은 부채가 생기므로 완료 보고에 **재시작 필요를 명시**한다.
- 검증: `npm test`(fixture) + 실 API 프로브 + 기여도 게이트 + 배포 사본 dist 스모크 + **실 MCP
  표면 스모크**(재시작 후 사용자 확인 — 재시작 전에는 dist 직접 실행으로 대체하고 그 사실을 기록).
- 배포/운영: 도구 개수 불변(11개), `source` enum 14 → 최대 20 종.

**② 자기선언 도메인**
- **target 명명 규칙**: 실측 확정 — `기관약어 + 서비스명` 어순(`ttSpecialDecc`·`ntsCgmExpc`).
  공식 문서 표기(`specialDeccTt`·`cgmExpc` + 부처코드)는 **뒤집혀 있다.** descriptor 에 실측 이름을 쓰고
  근거를 주석으로 남긴다(다음 세션이 문서를 보고 되돌리는 것을 막는다).
- **ID 필드 함정**: `ttSpecialDecc` 검색 결과의 `id` 는 **행 번호**다. 상세 조회 ID 는
  `특별행정심판재결례일련번호`. 프로브에서 `ID=1` 로 무관한 문서를 받은 실사고가 있다 — 테스트로 고정.
- **단건객체 함정**: `ntsCgmExpc` 는 `display=1` 일 때 배열이 아닌 단건 객체를 준다. UD3 이
  위원회 9종에 대해 고친 것과 **같은 결함** — 그 수리를 재사용한다.
- **HTML 폴백 금지**: `ttSpecialDecc` 의 `type=HTML` 은 본문 없는 JS 로더 셸(1,973B)이다.
  IB1b 에서 NTS 판례에 HTML 폴백을 붙인 선례가 있어 재사용하기 쉬운데, **여기선 쓰면 안 된다.**
- **구속력 등급 (프리모템 ③ 예방)**: 도메인 리서치 §1 이 확인 — 예규·통칙은 법원을 구속하지
  않는 "자료"(대법원 1998.9.8), 예규문 자체에 "사실관계가 다르면 답변이 달라질 수 있다"는 면책
  단서가 붙는다. 반면 **세법해석 사전답변은 과세관청을 구속**한다(신뢰보호). → 해석자료 응답에
  `authority` 필드를 싣는다: `binding_on_authority`(사전답변) / `reference_only`(예규·통칙) /
  `adjudication`(심판례). **등급 없이 출하 금지.**
- **신선도 한계**: `ttSpecialDecc` 기준일 2024.12.18 · `ntsCgmExpc` 2025.06.28. "최근 결정례"
  질의에 구조적으로 못 답한다 — 응답 경고에 **데이터 기준일을 싣는다**(추정 금지, upstream 값 그대로).
- **관련도 보증 (프리모템 ② 예방)**: 4,688건 중 상위 3건이 무관하면 소비 LLM 이 자신 있게 오인용한다.
  정렬 근거를 경고에 명시하고, **관련도를 보증 못 하면 주지 않는다**(F20 에서 확정한 원칙).
- **덤으로 담는 것**: `acrSpecialDecc`(감사원 심사청구 79) · `adapSpecialDecc`(소청 201) ·
  `moefCgmExpc`(기재부 예규 66) — 같은 어댑터라 추가 비용이 거의 0 이다. `kmstSpecialDecc` 는
  0건이라 제외.
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음 — 기존 `LAW_API_OC` 재사용) ·
  관측 · 신규 MCP 도구.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **신규 도구 추가** — 자료원이 6종 늘어도 도구는 11개다.
  도구를 늘리고 싶어지면 그건 UD3 이 이미 기각한 설계다.

## 결정 로그

- status: resolved
- **신규 도구를 만드나, enum 을 늘리나** → 확정: **enum.** UD3 선례(위원회 9종 흡수, 도구 불변).
- **예규를 조문과 같은 모양으로 주나** → 확정: **아니오. 구속력 등급 필수.** 이건 부가 기능이
  아니라 게이트다(프리모템 ③).
- **덤 4종(감사원·소청·기재부)을 담나** → 확정: **담는다.** 같은 어댑터라 비용 ≈0.
- **최신 자료가 없는 걸 어떻게 하나** → 확정: **한계로 선언하고 기준일을 응답에 싣는다.**
  숨기면 소비 LLM 이 최신인 줄 안다.
- **전문 조회가 안 되면** → 확정: **메타데이터만 출하하고 그 사실을 경고에 싣는다.** 안건명·
  안건번호만으로도 실무자는 원문을 찾아갈 수 있다(상세 링크가 taxlaw.nts.go.kr 로 온다).
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [x] **step-1** 심판례 어댑터 — `…SpecialDecc` 3종 + 전문 조회
  - Artifact: `src/providers/source-adapter.ts` 에 `tt`(조세심판원)·`acr`(감사원 심사청구)·
    `adap`(소청) descriptor. 검색은 `Decc.decc[]`, 전문은 `SpecialDeccService`(재결청·청구취지·
    참조결정·재결요지·이유). ID 는 `특별행정심판재결례일련번호`
  - Files: write `src/providers/source-adapter.ts`·`src/index.ts`(enum)·`src/types.ts`·
    `test/source-adapter.test.ts` / read `research/2026-07-21-tax-vertical-upstream-probe.md`
  - Dependencies: 없음
  - Verify: `npm test` — ID 필드가 `id`(행 번호)가 아니라 `특별행정심판재결례일련번호` 인지 고정 ·
    HTML 폴백을 타지 않는지 고정 · 단건객체 처리 + 실 API 로 `조심 2018광1070` 전문 도달 관측
  - Failure probe: `ID=1`(행 번호)로 조회를 시도해 **엉뚱한 문서를 조용히 반환하지 않는지** 확인 —
    프로브에서 실제로 발생한 사고다
  - Commit: `changesets/20260721-tv2-tribunal-adapter/`
- [x] **step-2** 예규 어댑터 — `…CgmExpc` 2종 + 전문 계약 확정
  - Artifact: `nts`(국세청 1,938건)·`moef`(기재부 66건) descriptor. 검색 필드(안건명·안건번호·
    해석일자·해석기관명·상세링크) 매핑. **전문 조회 계약은 이 step 에서 실측으로 확정**하고,
    없으면 메타데이터 출하로 축소 + 경고
  - Files: write `src/providers/source-adapter.ts`·`src/index.ts`(enum)·`test/source-adapter.test.ts`·
    `evidence/bench/2026-07-21-tv2-expc-contract.md` / read step-1 산출물
  - Dependencies: step-1
  - Verify: `npm test` + 실 API 로 `기준-2023-법규법인-0191` 도달 관측 + 전문 조회 계약의
    **실측 결과가 evidence 에 기록**(있으면 필드 목록, 없으면 그 사실과 축소 판정)
  - Failure probe: `display=1` 로 호출해 **단건객체가 배열로 정규화되는지** 확인 —
    프로브에서 이 결함으로 ID 추출이 조용히 실패했다
  - Commit: `changesets/20260721-tv2-rulings-adapter/`
- [x] **step-3** 구속력 등급 — 예규를 법조문처럼 인용하지 못하게 한다
  - Artifact: 해석자료 응답에 `authority` 필드(`binding_on_authority`/`reference_only`/
    `adjudication`) + `data_as_of`(upstream 기준일 그대로) + 등급 설명 경고
  - Files: write `src/types.ts`·`src/providers/source-adapter.ts`·`src/index.ts`(description)·
    `test/authority-grade.test.ts` / read `research/2026-07-21-tax-domain-tax-practice-sources.md` §1
  - Dependencies: step-1, step-2
  - Verify: `npm test` — **등급 없는 해석자료 응답이 존재할 수 없음**을 타입·테스트로 고정 +
    사전답변/서면질의 구분이 안건번호 체계로 판정되는지(판정 불가면 보수적으로 `reference_only`)
  - Failure probe: 등급을 못 정하는 항목을 주입해 **`reference_only` 로 보수적 처리**되는지 확인 —
    "모르면 구속력 있다"로 새면 그게 오답의 원천이다
  - Commit: `changesets/20260721-tv2-authority-grade/`
- [ ] **step-4** 기여도 게이트 — 도달 못 하면 채택하지 않는다
  - Artifact: `bench/tv2-contribution.ts` + `evidence/bench/2026-07-21-tv2-contribution.md` —
    세무 대표 질의(TV1 dev 에서 추출)별 심판례·예규 상위 3 도달률, 등급 표기율, 무관 결과 비율
  - Files: write `bench/tv2-contribution.ts`·`evidence/bench/2026-07-21-tv2-contribution.md`·
    `changesets/20260721-tv2-contribution/README.md`·`ROADMAP.md` / read 전 step 산출물
  - Dependencies: step-1, step-2, step-3
  - Verify: 도달률 **≥70%** AND 등급 표기율 **100%** AND `npm run bench:golden -- --set golden-v2
    --split dev` 로 **범용 회귀 없음(≥88%)** + `npm test` 전건 + **배포 사본 build + dist 스모크**
  - Failure probe: 도달률이 문턱 미달인 자료원을 **미채택으로 되돌리는 경로**가 실제로 동작하는지
    확인(게이트가 선언만 있고 안 도는 상태 배제)
  - Commit: `changesets/20260721-tv2-contribution/`

## 검증/DoD

- **DoD**: ① 조세심판원·국세청 예규가 `source` enum 에서 조회 가능 ② 전문(재결요지·이유) 도달 관측
  ③ ID 필드 함정·단건객체 함정·HTML 폴백 금지가 **테스트로 고정** ④ 해석자료 응답 **100% 에
  `authority` 등급 + `data_as_of`** ⑤ 대표 질의 도달률 ≥70% ⑥ 범용 dev 셋 ≥88%(회귀 없음)
  ⑦ `npm test` 전건 ⑧ 도구 개수 11 불변 ⑨ **배포 사본 build + dist 스모크** ⑩ 완료 보고에
  **MCP 재시작 필요 명시**(enum·스키마 변경).
- **도달률이 미달이면**: 해당 자료원을 채택하지 않고 기각 근거를 evidence 에 남긴다 — 정상 종료다.

## hard-stop policy

- 기여도 게이트 도달률 <70% → 해당 자료원 미채택, 기록 후 정지·보고.
- 등급을 못 정하는 항목이 다수(>20%) → 등급 체계 재설계 1회 후에도 안 되면 정지·보고.
- 범용 dev 셋 회귀 발생 → 즉시 정지(손실 0 은 낮추지 않는다).
- 홀드아웃(`golden-tax` holdout) 개봉 **금지** — TV6 소관.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- descriptor 는 표에서 행 제거로 복귀. enum 은 되돌리면 UD3 상태.
- 등급 필드는 응답 필드 1개 — 빼면 복귀(단 빼면 프리모템 ③ 이 되살아난다).
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F-어순: 남은 빈 응답 target(`lsRlt`·`couseLs`·`drlaw`)도 어순 오류 의심 — 이 horizon 범위 밖.

## 진행 로그 (append-only)
