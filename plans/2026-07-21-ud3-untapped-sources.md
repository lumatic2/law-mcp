# PLAN — UD3 미접근 자료원 흡수 (위원회 결정문 + 위임조문)

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-lawgo-api-survey.md` §A-1·§A-2·§E M1/M2
> execution mode: continuous
> milestone-레벨 durable plan doc.

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 법제처가 가진 능력을 그대로 전달 (← `plans/horizons/upstream-delivery.md`)
- **milestone**: UD3 — **랭킹으로는 못 메우는 갭을 자료원으로 메운다.** 노동위원회 판정 39,363건은
  통째로 사각지대였다 — 우리 골든셋에서 노동 도메인이 계속 최저였던 이유가 용어 갭만이 아니라
  **자료원 부재**였다. `lsDelegated` 는 "대통령령으로 정하는"이 어느 시행령 몇 조인지를 upstream 이
  이미 계산해 주는데 우리는 그 점프를 못 한다.
  규모 근거: 위원회 descriptor 확장·위임조문 편입·기여도 게이트가 독립 changeset 3,
  통합검증 = 자료원별 대표 쿼리 실 API 도달.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 기존 표면 확장만. **도구 표면 증가 ≤1** — 위원회는 `search_legal_source` 의 `source`
  enum 확장으로, 위임조문은 `get_law_article` 응답 강화로 처리한다.
- **제외**: `eflaw`·별표 3종·`lsStmd`/`thdCmp`·`elaw`/`trty`(horizon 범위 밖, 후보 백로그) ·
  홀드아웃 열람 · 검색 랭킹 변경(UD2 소관).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **기여도 게이트에서 대표 쿼리 도달 실패**(해당 자료원 미등록 후 기록).
- 롤백/정리: descriptor 추가는 표 항목 추가라 해당 항목만 지우면 복귀한다. 위임조문은 선택 필드
  1개 추가라 기존 소비자 호환.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → `~/projects/custom-mcps/law-mcp` 에서 `git pull &&
  npm run build` → **MCP 서버 재시작(사용자)**. `source` enum 이 바뀌므로 도구 description 이
  변하고 **재시작이 필수**다.
- 검증: `npm test`(fixture 단위) + 자료원별 **대표 쿼리 실 API 도달** + `npm run smoke:mcp`.
- 배포/운영: 도구 개수 +0(enum 확장). 위임조문은 `get_law_article` 선택 필드 추가.

**② 자기선언 도메인**
- **자료원 선정 방식**: 조사에서 응답을 확인한 위원회 9종 중, **단건 조회까지 성공**하고 대표 쿼리
  도달을 보이는 것만 등록한다. `nlrc`(노동위, 39,363건)를 먼저 확정하고 나머지는 게이트로 거른다.
- **기여도 측정 용도 일치**: LB3 에서 **골든셋으로 법원 기여를 재려다 용도 불일치로 "기여 0" 착시**를
  겪었다. 골든셋은 쟁점→법령 쿼리라 결정문 자료원을 못 잰다. 이번엔 **자료원별 대표 쿼리**로 잰다.
- **응답 구조 계약**: 타깃마다 컨테이너·행 키가 제각각이고 **조용히 틀린 답을 준다**(LB3 에서
  `ordin` 이 `ID` 로 부르면 다른 조례를 HTTP 200 으로 반환한 전례). descriptor 마다 **조회
  파라미터와 컨테이너를 실측으로 핀 고정하고 테스트로 박는다.**
- **도구 표면 억제**: 위원회 9종을 도구 9개로 내보내지 않는다 — 소비 LLM 의 선택 부담이 품질을
  떨어뜨린다(LB3 에서 +10 대신 +2 로 끝낸 근거와 동일). `source` enum 확장으로만 처리한다.
- **위임조문 편입 형태**: 신규 도구 없이 `get_law_article` 응답에 "이 조문이 위임한 하위 법령 조문"
  을 선택 필드로 덧붙인다. 조회 실패 시 필드를 달지 않는다(빈 값 오염 금지).
- **비용 예산**: `get_law_article` 1회당 추가 upstream 호출 **≤1**(`lsDelegated`), 캐시 필수,
  실패 시 기존 응답 그대로 반환.
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음 — 기존 `LAW_API_OC`) · 관측.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **신규 도구 노출** — 의도적으로 제외했고 그 이유를
  닫는 기준(도구 표면 증가 ≤1)에 박았다.

## 결정 로그

- status: resolved
- **위원회를 몇 종 붙이나** → 확정: 기여도 게이트가 정한다. `nlrc` 는 조사에서 단건 조회까지
  확인돼 사실상 확정, 나머지는 대표 쿼리 도달로 판정.
- **도구를 새로 만드나** → 확정: **아니오.** `source` enum 확장 + 기존 응답 강화.
- **`dlytrm`(일상용어) 재평가를 여기서 하나** → 확정: **아니오.** 조사에서 "재평가 필요"로 남았지만
  이 milestone 은 자료원 축이고 `dlytrm` 은 용어 축이다 — 후보 백로그로 넘긴다.
- **`specialDeccTt`(조세심판원) 파라미터 재확인** → 확정: 이 milestone 의 **finding 큐**에 넣고,
  step-1 진행 중 저비용으로 재시도한다(성공하면 descriptor 에 포함, 실패하면 기록만).
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** committee-sources — 위원회 결정문 descriptor 확장
  - Artifact: `SOURCE_DESCRIPTORS` 에 `nlrc` 외 응답 확인된 위원회를 추가 — 검색 컨테이너·행 키·
    **단건 조회 파라미터**를 실측으로 핀 고정. `source` enum 확장(도구 개수 불변)
  - Files: write `src/providers/source-adapter.ts`·`src/index.ts`·`test/source-adapter.test.ts` /
    read `research/2026-07-21-lawgo-api-survey.md`
  - Dependencies: 없음
  - Verify: `npm test` — descriptor 마다 조회 파라미터가 테스트로 고정됐는지 +
    자료원별 실 API 1건 도달 스모크
  - Failure probe: **틀린 파라미터로 부르면 다른 문서가 200 으로 온다**는 LB3 전례를 이번에도
    검사한다 — 각 자료원에서 잘못된 파라미터가 오답을 주는지 확인하고 옳은 파라미터를 테스트에 박는다
  - Commit: `changesets/20260721-ud3-committee-sources/`
- [ ] **step-2** delegated-articles — 위임조문 점프
  - Artifact: `get_law_article` 응답에 위임 하위 법령 조문을 선택 필드로 부착 (`lsDelegated`)
  - Files: write `src/providers/lawgo-provider.ts`·`src/types.ts`·`test/delegated.test.ts` /
    read `src/article-index.ts`
  - Dependencies: 없음 (step-1 과 독립)
  - Verify: `npm test` + 실 API — 소득세법 조문에서 "대통령령으로 정하는" → 시행령 제2조 도달을
    관측(조사에서 확인된 케이스 재현) + 추가 호출 ≤1 확인
  - Failure probe: 위임이 없는 조문·조회 실패 시 **필드를 달지 않고** 기존 응답이 무변인지 확인
  - Commit: `changesets/20260721-ud3-delegated-articles/`
- [ ] **step-3** contribution-gate — 기여도 측정 후 선택적 노출 + 배포
  - Artifact: `evidence/bench/2026-07-21-ud3-contribution.md` — 자료원별 **대표 쿼리** 도달률.
    도달 실패 자료원은 enum 에서 제거하고 근거만 기록. 배포 사본 반영 + 재시작 요청
  - Files: write `evidence/bench/2026-07-21-ud3-contribution.md`·`src/index.ts`(미도달 제거)·
    `changesets/20260721-ud3-contribution-gate/README.md` / read step-1·step-2 산출물
  - Dependencies: step-1, step-2
  - Verify: 자료원별 대표 쿼리 도달 표 + 도구 표면 증가 ≤1 확인 + `npm test` 전건 +
    **배포 사본 build 후 실 MCP 스모크**(CLAUDE.md 배포 계약)
  - Failure probe: 골든셋으로 재보면 기여가 0 으로 보이는 것을 **의도적으로 확인·기록**한다 —
    LB3 의 용도 불일치 착시가 재발하지 않도록 두 측정의 차이를 문서에 남긴다
  - Commit: `changesets/20260721-ud3-contribution-gate/`

## 검증/DoD

- **DoD**: ① 위원회 결정문이 `search_legal_source`/`get_legal_source` 로 실 API 도달 ②
  descriptor 마다 조회 파라미터가 테스트로 고정 ③ `get_law_article` 이 위임 하위 조문을 함께 반환
  ④ **도구 표면 증가 ≤1** ⑤ 자료원별 대표 쿼리 기여도 표 제시, 미도달 자료원 미등록
  ⑥ 추가 호출 ≤1 ⑦ 세무 회귀 6종 + `npm test` 전건 ⑧ **배포 사본 build + 실 MCP 스모크**.
- **실패 경로**: 잘못된 조회 파라미터가 오답을 주는 것 · 위임 없는 조문에서 필드가 안 붙는 것 ·
  미도달 자료원이 게이트에서 걸리는 것 — 3가지를 실제로 관측한다.

## hard-stop policy

- 대표 쿼리 도달 실패 자료원 → 등록하지 않고 기록만, 계속 진행(정지 아님).
- `nlrc` 조차 도달 실패 → 이 milestone 의 전제가 무너짐, 정지·보고.
- 실 API rate limit → `stop_reason=risk_gate` 기록 후 정지.
- 홀드아웃을 여는 것 **금지**.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- descriptor 항목 삭제 = 해당 자료원 제거. 위임조문은 부착 지점 1곳을 끄면 복귀.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F7: `specialDeccTt`(조세심판원) 파라미터 — 이 레포 최초 소비처(세무)와 직결, step-1 중 저비용 재시도.
- F8: `cgmExpc` + 부처코드 중앙부처 1차 해석 39종 — 부처코드 체계 미상.
- F9: `dlytrm` 일상용어 재평가(LB5 제외 근거가 부분적이었음) — 용어 축 후보.

## 진행 로그 (append-only)

- 2026-07-21 plan 작성 — horizon `upstream-delivery` 개설과 함께 일괄 작성(CS6 horizon-run).
