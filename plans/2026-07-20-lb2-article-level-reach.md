# PLAN — LB2 조문 단위 도달 + 랭킹 실질 개선

> 생성: 2026-07-20 · 갈래: tooling · scope 결정: 조문 인덱스·조문 검색 도구·검색 랭킹 반영까지
> execution mode: continuous
> milestone-레벨 durable plan doc.

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 범용 법률 커버리지 (← `plans/horizons/general-legal-coverage.md`)
- **milestone**: LB2 — "어느 법 **몇 조**"에 답하고, 그 조문 매칭을 관련도 신호로 써서 랭킹을 실질
  개선한다. 규모 근거: 조문 인덱스 구성 / 조문 검색 도구 / 기존 검색 랭킹 반영이 각각 독립
  changeset(≥3), 통합검증 = LB1 골든셋 재측정으로 수치 상승 확인.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 클라이언트측 조문 인덱스까지. **외부 색인 엔진·임베딩·벡터DB 도입 금지**(범용 MCP 의
  설치 부담을 늘린다 — 필요성이 실측되면 별도 horizon).
- **중단점(stop points)**: blocked / error / risk_gate(비용 예산 초과가 구조적) /
  decision_required(조문 매칭 가정이 반증돼 방향 재선택 필요) / 홀드아웃 측정 완료.
- 롤백/정리: 랭킹 반영은 기존 정렬 위에 얹는 방식이라 revert 로 즉시 원복(ib3 동일 패턴).
  신규 도구는 `src/index.ts` 등록 제거로 표면에서 제거.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → `custom-mcps/law-mcp` pull+build → MCP 재시작(사용자).
- 검증: `npm test` + `npm run bench:golden`(LB1 러너) + 실 API 스모크(재시작된 MCP 도구 직접 호출).
- 배포/운영: MCP 도구 표면 변경 있음(조문 검색 도구 신설) — 도구 description 갱신 + 배포본 반영 필수.

**② 자기선언 도메인**
- **조문 인덱스 구성**: `lawService.do?target=law&ID=<id>` 응답의 조문 구조를 파싱해
  `{article_no, title, text}` 배열로 만든다. 기존 `extractFullArticleContent` 를 조문 단위로 분해해 재사용.
- **비용 예산 (프리모템 시나리오 2 예방 — 하드 제약)**: 검색 1회당 추가 fetch **≤5건**, 병렬 실행,
  **인메모리 캐시**(law_id → 조문 배열, 프로세스 생존 동안 유지, 상한 20법령 LRU). 예산 초과 시
  기존 경로로 **graceful degrade**(경고 포함). 지연 목표: 추가 fetch 포함 검색 1회 **≤3초**.
- **조문 매칭 점수**: 쿼리 토큰이 조문 본문에 나타나는 조문 수 + 조문당 매칭 토큰 종류 수. ib3 에서
  기각된 "법령 단위 빈도"와 달리 **조문 단위**라 문맥이 좁다 — 단 이 가정 자체를 step-2 에서 검증하고,
  개선이 없으면 기각 기록 후 정지(억지 채택 금지).
- **도구 표면**: 신규 `search_law_articles`(쿼리 → 법령+조문번호+발췌). 기존 `search_law` 는 시그니처
  불변, 랭킹만 개선(하위호환).
- 검토 후 제외: 화면·디자인(UI 없음) · 데이터 스토어(영속 색인 미도입 — scope 결정) ·
  인증(신규 시크릿 없음) · 관측(로컬 도구).

## 결정 로그

- status: resolved
- **영속 색인 vs 온디맨드** → 확정: 온디맨드 + 인메모리 캐시(2026-07-20). 근거: 영속 색인은 설치·갱신
  부담을 만들어 "누구나 붙이는 MCP" 목표와 충돌.
- **신규 도구 추가 vs 기존 도구 확장** → 확정: 신규 `search_law_articles` 추가(기존 하위호환 유지).
- **개선이 없을 때의 처리** → 확정: 기각 기록 후 정지·보고. 골든셋 수치를 보고 임계값을 사후
  조정하는 행위 금지.
- 그 외 사용자 소유 결정: **없음**.

## Step 트리

- [ ] **step-1** article-index — 법령 조문 분해 + 캐시
  - Artifact: `src/article-index.ts`(조문 배열 파싱·LRU 캐시) + 단위테스트
  - Files: write `src/article-index.ts`·`test/article-index.test.ts` / read `src/providers/lawgo-provider.ts`
  - Dependencies: 없음
  - Verify: `npm test` — 고정 fixture(법령 응답 JSON)에서 조문 수·조문번호·본문이 정확히 분해되고, LRU 상한 초과 시 축출되는지
  - Failure probe: 조문 구조가 없는 응답(빈 법령·행정규칙형)을 주입해 빈 배열 반환 + 예외 없음 확인
  - Commit: `changesets/20260720-lb2-article-index/`
- [ ] **step-2** article-match — 조문 매칭 점수 + 가정 검증
  - Artifact: `src/article-match.ts`(점수 함수) + 검증 리포트 `evidence/bench/2026-07-20-article-match-probe.md`
  - Files: write `src/article-match.ts`·`test/article-match.test.ts`·`evidence/bench/*` / read `bench/golden.json`(dev only)
  - Dependencies: step-1
  - Verify: dev split 골든셋에서 "조문 매칭 점수로 재정렬 시 recall@3" 를 산출해 LB1 기준선과 대조 — **상승하면 채택, 아니면 기각 기록 후 정지**
  - Failure probe: 매칭 0건 쿼리에서 점수 함수가 기존 순서를 보존하는지(회귀 없음) 확인
  - Commit: `changesets/20260720-lb2-article-match/`
- [ ] **step-3** search-articles-tool — 조문 검색 도구 노출 + 랭킹 반영
  - Artifact: `search_law_articles` MCP 도구 + `search_law` 본문검색 랭킹에 조문 점수 반영(예산 내)
  - Files: write `src/index.ts`·`src/providers/lawgo-provider.ts`·`src/types.ts`·`test/*` / read `src/article-*.ts`
  - Dependencies: step-2 채택
  - Verify: `npm test` + 실 API — "가지급금 인정이자" → 법인세법 + 조문번호 반환, 검색 1회 지연 ≤3초 측정
  - Failure probe: 추가 fetch 가 실패·타임아웃일 때 기존 결과로 graceful degrade + 경고 반환 확인
  - Commit: `changesets/20260720-lb2-search-articles-tool/`
- [ ] **step-4** holdout — 홀드아웃 1회 측정 + 회귀
  - Artifact: `evidence/bench/2026-07-20-lb2-holdout.json` + 완료 리포트
  - Files: write `evidence/bench/*` / read `bench/golden.json`(holdout)
  - Dependencies: step-3
  - Verify: `npm run bench:golden -- --split holdout` **1회만** 실행 → recall@3 기록. 세무 회귀 스위트(ib1~ib3 재현 6종) 무변 확인
  - Failure probe: 홀드아웃이 dev 대비 크게 낮으면(과적합) 그 사실을 결론에 명시 — 수치를 감추지 않는다
  - Commit: `changesets/20260720-lb2-holdout/`

## 검증/DoD

- **DoD**: ① `search_law_articles` 가 실 API 로 법령+조문번호+발췌를 반환 ② 골든셋 dev recall@3 가
  LB1 기준선 대비 상승 ③ **홀드아웃 recall@3 를 1회 측정해 기록**(과적합 여부 공개) ④ 검색 1회
  지연 ≤3초 ⑤ 세무 회귀 6종 무변.
- 실패 경로: 각 step Failure probe + graceful degrade 확인.

## hard-stop policy

- step-2 에서 개선 없음 → 기각 기록 후 정지(사용자 보고).
- 비용 예산(≤5 fetch / ≤3초) 초과가 구조적이면 정지.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 랭킹 반영은 기존 정렬 위에 얹는 방식이라 revert 로 즉시 원복(ib3 와 동일 패턴).
- 신규 도구는 `src/index.ts` 등록 제거로 표면에서 제거 가능.

## finding 큐

- (실행 중 발견 시 추가)

## 진행 로그 (append-only)

- 2026-07-20 plan 작성 (승인 대기)
