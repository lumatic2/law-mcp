# PLAN — UD2 `aiSearch` 편입 + A/B 판정

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-lawgo-api-survey.md` §★·§E M0
> execution mode: continuous
> milestone-레벨 durable plan doc.

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 법제처가 가진 능력을 그대로 전달 (← `plans/horizons/upstream-delivery.md`)
- **milestone**: UD2 — 법제처의 지능형 검색(`aiSearch`)을 **1순위 후보 생성기로** 편입한다.
  같은 dev 셋에서 무튜닝 92% 대 우리 튜닝 76%, 게다가 응답이 처음부터 조문 단위다. 이 격차는
  우리가 만든 5 milestone 어치 랭킹보다 크다. 다만 **대체가 아니라 병합**이다 — `aiSearch` 도
  틀리는 유형이 있다("정당방위 성립 요건" → 정당법·방위사업법).
  규모 근거: 클라이언트·후보 편입·조문 출하·종합 판정이 독립 changeset 4, 통합검증 = A/B 4배치 재측정.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 후보 **생성**과 `search_law` **응답 내용**에만 관여한다. 신규 MCP 도구를 노출하지
  않는다(도구 11개 유지).
- **제외**: 위원회 결정문·위임조문(UD3 소관) · 홀드아웃 열람(horizon close 소관) ·
  기존 용어 연계 부스트 **삭제**(사용자 확정 2026-07-21: 유지하고 A/B 로 판정).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **dev A/B 에서 `aiSearch` 편입이 2σ 이내 = 이득 없음**(가설 기각 후 정지·기록) /
  **새로 깨지는 쿼리가 0 이 아닌 배치만 남음**(병합 규칙 재설계).
- 롤백/정리: `aiSearch` 는 **후보 생성 앞단에 얹는 채널**이라 편입 지점 1곳을 끄면 LB5 상태로
  즉시 복귀한다. 기존 사다리(이름 매칭 → 본문검색 → 완화 → 용어 브리지)는 **삭제하지 않는다**.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → `~/projects/custom-mcps/law-mcp` 에서 `git pull &&
  npm run build` → **MCP 서버 재시작(사용자)**. 응답 스키마에 필드가 추가되므로 재시작이 필요하다.
- 검증: `npm test`(fixture 단위 — 실 API 미접속) + `npm run bench:golden -- --set golden-v2
  --split dev --repeat 5`(A/B) + `npm run smoke:mcp`(실 표면 스모크).
- 배포/운영: 도구 **개수** 불변(11개). `search_law` 응답에 선택 필드가 늘어나므로 description 을
  갱신하고 사용자에게 재시작을 요청한다.

**② 자기선언 도메인**
- **판정 방식**: 모든 편입은 **A/B 필수**이고, 채택 문턱은 UD1 이 확정한 **2σ 초과**다.
  집계 수치만으로 채택하지 않는다 — **쿼리 단위 승패 표**(좋아진 쿼리 / 나빠진 쿼리)를 함께 낸다.
- **회귀 금지선**: **새로 깨지는 쿼리 0** 을 채택 조건에 넣는다. LB5 가 이 조건을 지켜 성공했다.
  0 이 아니면 병합 규칙을 고치고 다시 잰다.
- **병합 구도**: `aiSearch` 결과를 **상위 후보로 앞세우되**, 기존 사다리 결과를 뒤에 보존한다.
  용어 연계 부스트는 유지하고, `aiSearch`·부스트가 충돌할 때 어느 쪽이 상위인지를 **실측으로** 정한다
  (선험적으로 정하지 않는다 — ib3 에서 신호 없이 재정렬했다 실패한 전례).
- **upstream 의존 방어**: `aiSearch` 는 법제처 블랙박스다. 무응답·타임아웃·스키마 변경 시
  **기존 경로로 graceful degrade** 하고, 그 폴백을 failure probe 로 고정한다. 두 경로 모두 테스트에 남긴다.
- **응답 구조 계약**: 조사 시점의 컨테이너·행 키를 **테스트로 고정**한다(LB3 `source-adapter` 에서
  배운 방식 — upstream 키는 규칙이 없어 실측으로만 알 수 있고, 조용히 틀린 답을 줄 수 있다).
- **비용 예산**: 검색 1회당 추가 upstream 호출 **≤1**(`aiSearch` 1회). 캐시 필수. 지연 측정을 DoD 에 포함.
- **조문 출하**: `aiSearch` 는 조문 단위로 답하므로 `SearchLawItem` 에 조문 정보를 싣는다.
  LB5 가 만든 `linked_articles` 와 **출처를 구분**해서 전달한다(어디서 온 조문인지 소비 LLM 이 알아야 한다).
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음 — 기존 `LAW_API_OC` 사용) ·
  관측 · 신규 도구 노출.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **인증** — `aiSearch` 가 별도 신청·권한을 요구하면
  그 시점에 risk_gate 로 정지한다(현재까지 프로브는 기존 OC 로 성공).

## 결정 로그

- status: resolved
- **`aiSearch` 로 대체할 것인가** → 확정: **아니오, 병합.** 근거: 조사에서 오답 유형을 이미 관측.
- **기존 용어 연계 부스트를 유지하나** → 확정(2026-07-21 사용자 선택): **유지하고 A/B 로 판정.**
  `aiSearch` 가 못 잡는 케이스를 부스트가 메우는지 실측으로 확인한다.
- **홀드아웃을 여기서 여나** → 확정: **아니오.** horizon close 시 1회(UD1 이 코드로 강제).
- **도구를 새로 노출하나** → 확정: 아니오. 기존 `search_law` 강화.
- 그 외 사용자 소유 결정: 없음. (`aiSearch` 가 별도 권한을 요구하면 그때 risk_gate 로 정지)

## Step 트리

- [ ] **step-1** aisearch-client — `aiSearch` 클라이언트 + 응답 계약 고정
  - Artifact: `src/ai-search.ts` — 질의 → (법령, 조문, 순위) 정규화. 응답 컨테이너·행 키를
    실측값으로 **핀 고정**, 모든 실패를 빈 결과로 흡수(예외 누출 금지)
  - Files: write `src/ai-search.ts`·`test/ai-search.test.ts` / read `src/providers/source-adapter.ts`·
    `src/term-linkage.ts`·`src/config.ts`
  - Dependencies: 없음 (UD1 완료 후 시작 — 판정 문턱이 필요하므로)
  - Verify: `npm test` — fixture 로 정규화 정확성 + 캐시 히트 시 추가 호출 0 + 실 API 스모크 1회
  - Failure probe: HTTP 503 · 빈 응답 · 스키마가 바뀐 응답(핀 고정한 키가 없는 JSON)을 주입해
    **예외 없이 빈 결과**가 나오는지 확인
  - Commit: `changesets/20260721-ud2-aisearch-client/`
- [ ] **step-2** candidate-merge — 후보 생성 편입 + dev A/B
  - Artifact: `searchLaw` 후보 생성에 `aiSearch` 를 앞단 채널로 병합 + **배치 비교 리포트**
    (기존 단독 / aiSearch 단독 / 병합·aiSearch 우선 / 병합·부스트 우선)
  - Files: write `src/providers/lawgo-provider.ts`·`test/ai-search-merge.test.ts`·`evidence/bench/*` /
    read `src/ai-search.ts`·`bench/run.ts`
  - Dependencies: step-1
  - Verify: `npm run bench:golden -- --set golden-v2 --split dev --repeat 5` — 채택은
    **2σ 초과 상승 AND 새로 깨지는 쿼리 0** 일 때만. 쿼리 단위 승패 표를 evidence 에 첨부
  - Failure probe: `aiSearch` 를 통째로 죽인 상태(step-1 폴백)에서 검색이 **LB5 와 바이트 단위로
    동일**한 결과를 내는지 확인 — 폴백이 진짜 폴백인지
  - Commit: `changesets/20260721-ud2-candidate-merge/`
- [ ] **step-3** article-shipping — 조문을 제품 경로로 출하 (F4 해소)
  - Artifact: `search_law` 응답이 조문을 **출처와 함께** 담는다(`aiSearch` 유래 / 용어 연계 유래
    구분). 러너의 조문 축이 **출하되는 값**을 재도록 전환 — 미출하 `scoreArticles` 측정 중단
  - Files: write `src/types.ts`·`src/providers/lawgo-provider.ts`·`src/index.ts`·`bench/scoring.ts`·
    `test/*`·`evidence/bench/*` / read `src/article-match.ts`
  - Dependencies: step-2
  - Verify: `npm run bench:golden -- --set golden-v2 --split dev --repeat 5` 의 조문 축이
    **제품 응답 기준**으로 수치를 낸다 + `npm run smoke:mcp` 로 실제 도구 응답에 조문이 실려 오는 것을 관측
  - Failure probe: 조문 정보가 없는 쿼리에서 필드를 **달지 않는지**(빈 배열·null 오염 금지) +
    출처 구분이 뒤섞이지 않는지 테스트로 고정
  - Commit: `changesets/20260721-ud2-article-shipping/`
- [ ] **step-4** verdict — 종합 판정 + 배포
  - Artifact: `evidence/bench/2026-07-21-ud2-verdict.md` — 채택 배치 확정, 지연 측정,
    세무 회귀 6종, 기각된 배치의 근거. 배포 사본 반영 + 사용자 재시작 요청
  - Files: write `evidence/bench/2026-07-21-ud2-verdict.md`·`changesets/20260721-ud2-verdict/README.md`·
    `CLAUDE.md`(필요 시) / read 전 step 산출물
  - Dependencies: step-1, step-2, step-3
  - Verify: `npm test` 전건 + 세무 재현 6종 무변 + 검색 1회 지연 ≤3초 측정 기록 +
    **배포 사본 build 후 실 MCP 스모크**(CLAUDE.md 배포 계약 — 소스 수정만으로 완료 금지)
  - Failure probe: 배포 사본에서 build 가 실패하거나 재시작 전 도구가 구 동작을 보이는 것을
    **관측하고 기록**한다(배포 미반영이 조용히 지나가지 않게)
  - Commit: `changesets/20260721-ud2-verdict/`

## 검증/DoD

- **DoD**: ① dev A/B 에서 `aiSearch` 병합이 **2σ 초과** 상승 ② **새로 깨지는 쿼리 0**
  ③ 쿼리 단위 승패 표가 evidence 에 있음 ④ `aiSearch` 장애 시 LB5 동작으로 graceful degrade
  (테스트 고정) ⑤ 조문이 **제품 응답으로 출하**되고 그 정확도가 제품 경로 기준으로 측정됨(F4 해소)
  ⑥ 검색 1회 추가 호출 ≤1 · 지연 ≤3초 ⑦ 세무 회귀 6종 무변 ⑧ `npm test` 전건
  ⑨ **배포 사본 build + 실 MCP 스모크**.
- **이득이 없으면**: 채택하지 않고 기각 근거를 evidence 에 남긴다 — 이것도 정상 종료다.
  (이 레포에서 가설 6개가 이 방식으로 죽었고 그게 품질을 지켰다.)

## hard-stop policy

- dev A/B 이득이 2σ 이내 → 채택 중단, 기각 기록 후 정지·보고.
- 모든 병합 배치에서 새로 깨지는 쿼리가 남음 → 병합 규칙 재설계 1회 후에도 안 되면 정지·보고.
- `aiSearch` 가 별도 권한·신청을 요구 → `stop_reason=risk_gate` 기록 후 정지.
- 홀드아웃을 여는 것 **금지**(러너가 기계적으로 거부 — UD1 step-2).
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 편입 지점 1곳(후보 병합)을 끄면 LB5 동작으로 복귀.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F4: 이 milestone step-3 이 해소한다(조문 출하).
- F6: `aiRltLs`(AI 연관법령)·`lsRlt`(관련법령 그래프)는 같은 계열의 미사용 API — UD2 결과에 따라
  후속 후보.

## 진행 로그 (append-only)

- 2026-07-21 plan 작성 — horizon `upstream-delivery` 개설과 함께 일괄 작성(CS6 horizon-run).
