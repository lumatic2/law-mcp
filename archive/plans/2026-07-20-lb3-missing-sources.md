# PLAN — LB3 누락 법원(法源) 5종 도구화

> 생성: 2026-07-20 · 갈래: tooling · scope 결정: 법령해석례·헌재결정례·행정심판재결례·자치법규·법령용어
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: completed (2026-07-21 — 3/3 step. 상세는 changesets/20260720-lb3-*)

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 범용 법률 커버리지 (← `plans/horizons/general-legal-coverage.md`)
- **milestone**: LB3 — 실무에서 결정적인 법원 5종이 빠져 있다. 리서치에서 DRF 타깃 실재·응답 동형을
  실측했다. 규모 근거: 법원군별 어댑터 + 도구 노출 + 기여도 검증이 독립 changeset ≥3, 통합검증 =
  골든셋에서 새 법원이 실제로 정답을 만들어내는지.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 검색(search) + 단건 조회(get)까지. 별표·서식(`licbyl`)·신구법비교(`oldAndNew`)·조약(`trty`)은
  **이번 범위 제외**(기여도 미확인 — finding 큐로). 기여 0 법원은 미등록.
- **중단점(stop points)**: blocked / error / decision_required(응답 구조가 기존과 달라 매핑 불명확) /
  risk_gate(실 API 인증·rate limit) / 기여도 게이트 완료.
- 롤백/정리: 도구 등록 제거만으로 표면에서 즉시 제거(구현 코드 잔존 가능). 공통 어댑터 추출은
  기존 경로 회귀 테스트로 보호 — 실패 시 추출 커밋만 revert.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → 사본 pull+build → MCP 재시작(사용자).
- 검증: `npm test`(매핑 단위테스트, fixture 기반) + 실 API 스모크(법원별 ≥1건 도달) + `bench:golden`.
- 배포/운영: MCP 도구 표면 확대(도구 수 증가) — description 정비 필수, 배포본 반영 필수.

**② 자기선언 도메인**
- **타깃 확정 방식 (리서치 주의사항)**: 타깃명과 법원 대응이 직관과 반대다 — `detc`=헌재결정례,
  `decc`=행정심판재결례로 관측됨. **구현 시 이름이 아니라 응답 필드로 확정**하고, 확정 근거를
  changeset 에 기록한다.
- **어댑터 패턴**: 응답 컨테이너·행 배열 키만 다르고 구조가 동형 → 기존 `fetchAdminRuleSearchOnce`
  식 사설 메서드를 **파라미터화한 공통 헬퍼**로 정리해 5종을 얹는다(중복 5벌 금지).
- **폴백 사다리**: 신규 검색 도구도 ib3 대칭 규칙을 따른다 — 이름 매칭 → 본문검색(지원 시) → 완화
  재시도 → 용어 브리지. 본문검색 미지원 타깃은 그 사실을 도구 description 에 명시.
- **도구 수 억제 (프리모템 시나리오 3 예방)**: 법원마다 도구 2개(search/get)면 +10개다. **기여가
  확인된 법원만 노출**하고, 기여 미확인은 코드에 두되 등록하지 않는다.
- **법령용어(`lstrm`) 특수 취급**: `term-bridge.ts` 수기 사전의 상위 호환 후보 — 다만 이번엔 조회
  도구로만 노출하고 브리지 자동 대체는 하지 않는다(회귀 위험, finding 큐).
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음) · 관측.

## 결정 로그

- status: resolved
- **어느 법원을 담나** → 확정: 해석례·헌재결정례·행정심판재결례·자치법규·법령용어 5종. 별표서식·
  신구법·조약 제외(2026-07-20, 기여도 미확인).
- **기여 없는 법원 처리** → 확정: 노출하지 않고 기록만 남긴다(도구 인플레 방지).
- **법령용어로 term-bridge 대체 여부** → 확정: 이번 범위 아님(회귀 위험) — finding 큐.
- 그 외 사용자 소유 결정: **없음**.

## Step 트리

- [ ] **step-1** source-adapter — 공통 검색 어댑터 추출 + 타깃 확정
  - Artifact: `src/providers/source-adapter.ts`(파라미터화 검색 헬퍼) + 타깃↔법원 대응 확정 기록
  - Files: write `src/providers/source-adapter.ts`·`test/source-adapter.test.ts` / read `src/providers/lawgo-provider.ts`
  - Dependencies: 없음
  - Verify: `npm test` — fixture 로 5종 응답 매핑 정확성 + 기존 admrul/prec 경로가 헬퍼 경유로도 동일 결과(회귀)
  - Failure probe: 빈 응답·알 수 없는 컨테이너 키를 주입해 예외 없이 0건 + 경고 반환 확인
  - Commit: `changesets/20260720-lb3-source-adapter/`
- [ ] **step-2** source-tools — 법원별 search/get 도구 구현
  - Artifact: 5종 search + get 구현(등록은 step-3 에서 기여 확인 후)
  - Files: write `src/providers/lawgo-provider.ts`·`src/types.ts`·`test/*` / read `src/providers/source-adapter.ts`
  - Dependencies: step-1
  - Verify: 실 API 로 법원별 검색 ≥1건 + 단건 조회 ≥1건 도달(총 10콜) — 결과를 changeset 에 기록
  - Failure probe: 존재하지 않는 ID 로 단건 조회 시 null/안내 반환(크래시·빈 객체 금지) 확인
  - Commit: `changesets/20260720-lb3-source-tools/`
- [ ] **step-3** contribution-gate — 기여도 측정 후 선택적 노출
  - Artifact: 기여도 리포트 `evidence/bench/2026-07-20-lb3-contribution.md` + `src/index.ts` 도구 등록(기여 확인분만)
  - Files: write `src/index.ts`·`evidence/bench/*` / read `bench/golden.json`(dev only)
  - Dependencies: step-2
  - Verify: dev 골든셋 + 도메인별 대표 쿼리로 법원별 "정답 기여 건수"를 산출 → 기여 ≥1 인 법원만 등록.
    등록된 도구가 재시작된 MCP 에서 실제 호출되는지 스모크
  - Failure probe: 기여 0 법원이 실제로 미등록 상태인지(도구 목록에 없음) 확인
  - Commit: `changesets/20260720-lb3-contribution-gate/`

## 검증/DoD

- **DoD**: ① 등록된 법원 도구가 각 **실 API 1건 이상 도달**(스모크 로그) ② 기여도 리포트가 법원별
  정답 기여 수를 수치로 제시 ③ 기여 0 법원은 미등록 ④ 기존 도구 회귀 없음(`npm test` + 세무 6종).
- 실패 경로: 각 step Failure probe.

## hard-stop policy

- 응답 구조가 기존과 달라 매핑이 불명확 → 정지·질의.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 도구 등록 제거만으로 표면에서 즉시 제거(구현 코드는 잔존 가능).
- 공통 어댑터 추출은 기존 경로 회귀 테스트로 보호 — 실패 시 추출 커밋만 revert.

## finding 큐

- F1: 법령용어(`lstrm`)로 `term-bridge.ts` 수기 사전 대체 가능성 검토.
- F2: 별표·서식(`licbyl`)·신구법비교(`oldAndNew`) 기여도 조사.

## 진행 로그 (append-only)

- 2026-07-20 plan 작성 (승인 대기)
- 2026-07-21 3/3 step 완료. 체크박스는 승인 시점 그대로 둔다 — 진행 상태의 정본은 `work.json`·
  changeset 이며 plan 본문을 고치면 승인 hash 가 깨진다(2026-07-21 LB2 에서 겪은 위반).
  Status 행만 갱신하고 receipt 를 재등록했다.
- 2026-07-21 측정 정정: dev 골든셋 기여 0% 는 본문검색 가나다순이 만든 허수 도달 때문이며,
  법원별 대표 쿼리로 재측정해 5종 전부 기여 확인 → 등록. 도구는 2개로 억제(표면 9→11).
- 2026-07-21 finding F1(lstrm 으로 term-bridge 대체) **기각** — 근거는 contribution 리포트.
  F2(별표서식·신구법비교)는 미착수로 남긴다.
