# PLAN — LB2 소비 모드 교정 + 인용 검증

> 생성: 2026-07-21 · 갈래: tooling
> milestone-레벨 durable plan doc.

Status: approved (2026-07-21 · 위임 범위 A — horizon 전체 연쇄)
Supersedes: plans/2026-07-20-lb2-article-level-reach.md

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 범용 법률 커버리지 (← `plans/horizons/general-legal-coverage.md`)
- **milestone**: LB2 (재설계). 구 plan 의 step-1(조문 인덱스)은 완료·유효하고, step-2(조문 재정렬)는
  실측 기각됐다. 선행 사례 조사 결과 **측정 전제 자체가 틀렸을 가능성**이 드러나 방향을 교정한다.
  규모 근거: 2모드 벤치 / 인용 검증 도구 / 큐레이션 판정 + 홀드아웃 = 독립 changeset 4,
  통합검증 = 홀드아웃 2모드 측정.

## 왜 재설계인가 (근거)

`research/2026-07-21-lb2-prior-art-candidate-generation.md`:
- 상위 레포 4곳(6390★·2252★·125★ 등) **전부 "쟁점→법령" 매핑을 소비자 LLM 에 맡긴다**. API 자연어
  검색에 기대는 설계가 없다. 우리 골든셋(blind 모드)은 이 분야가 의도적으로 기대지 않는 경로를
  재고 있었다.
- 조문 사전 색인 사례는 1곳뿐이고 **도메인을 창업 19개 법으로 좁혀서** 했다 — 범용 목표와 안 맞는다.
- 상위 3곳의 공통 차별화 = **인용 검증**. 우리에겐 없고, LB2 step-1 조문 인덱스로 저비용 구현 가능.
- 아무도 정확도를 공개 측정하지 않는다 — LB1 골든셋이 드문 자산.

## 범위 / 중단점

- execution mode: continuous
- **범위**: ① 벤치를 2모드(blind / assisted)로 확장해 재측정 ② 인용 검증 도구 신설
  ③ 큐레이션 조문 색인(C안) **필요 여부 판정까지**. C안 구현은 이 milestone 범위 밖 —
  판정 결과가 "필요"면 사용자 결정을 받는다.
- **중단점(stop points)**: blocked / error / decision_required(C안 착수 판단·기본법 범위) /
  risk_gate(실 API 인증·rate limit) / 홀드아웃 2모드 측정 완료.
- 롤백/정리: 신규 도구는 `src/index.ts` 등록 제거로 표면에서 제거. 벤치 확장은 기존 blind 경로를
  기본값으로 두어 기존 측정과 비교 가능성을 유지한다.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → `custom-mcps/law-mcp` pull+build → MCP 재시작(사용자).
- 검증: `npm test` + `npm run bench:golden`(2모드) + 재시작된 MCP 도구 실표면 스모크.
- 배포/운영: MCP 도구 표면 변경 있음(`verify_citation` 신설) — description 정비 + 배포본 반영 필수.

**② 자기선언 도메인**
- **2모드 정의**: `blind` = 현행(자연어 쿼리 → `search_law`). `assisted` = **법령명은 소비자가
  제공한다고 가정**하고, 도구가 그 법령 안에서 정답 조문에 도달하는지 잰다(선행 사례의 표준 소비
  패턴). assisted 는 "법령 찾기"가 아니라 **"조문 도달"** 을 재는 별개 지표다 — 두 수치를 합산하지 않는다.
- **assisted 채점**: `expected_article` 보유 항목(39건)만 대상. `scoreArticles`(구 step-2 산출물)로
  조문을 정렬해 accuracy@1 / accuracy@3 를 낸다. 순환 논리 아님 — 정답 법령을 입력으로 주는 것은
  소비자 LLM 의 역할을 대신하는 것이고, 측정 대상은 그 이후 도구의 조문 도달 능력이다.
- **인용 검증 계약**: 입력 = "법령명 + 조문번호"(선택: 조문제목). 출력 분류 =
  `ok` / `not_found` / `title_mismatch` / `law_not_found`. 선행 사례(chrisryugj·startup-law)의
  분류 체계를 따르되 이름은 우리 규약대로 직관적으로 짓는다.
- **비용**: assisted 모드는 법령당 1 fetch + 캐시 재사용(LRU). 39건이 14법령에 몰려 있어 실측
  fetch 는 14회 안팎.
- 검토 후 제외: 화면·디자인(UI 없음) · 데이터 스토어(영속 색인 미도입 — C안 판정 후 결정) ·
  인증(신규 시크릿 없음) · 관측(로컬 도구).

## 결정 로그

- status: resolved
- **A→B→C 순서** → 확정: 측정 교정(A) → 인용 검증(B) → C안은 판정만(2026-07-21 사용자 승인).
  근거: A 결과가 C 의 필요성 자체를 판정한다 — assisted 가 이미 높으면 C 는 불필요한 일이 된다.
- **구 plan 처리** → 확정: 수정 대신 승계(`Supersedes`). 승인 hash·기각 기록을 원형 보존한다.
- **assisted 모드의 순환성 우려** → 확정: 지표를 분리 보고(합산 금지)하고, assisted 는 "조문 도달"
  지표로 명명해 "법령 찾기" 성능으로 오독되지 않게 한다.
- **C안(큐레이션 색인) 착수** → **미해결 — 이 milestone 에서 결정하지 않는다.** step-3 판정 리포트
  후 사용자 결정(기본법 범위는 사용자 소유).
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [x] **step-1** two-mode-bench — 벤치 2모드 확장 + dev 재측정
  - Artifact: `bench/run.ts` `--mode blind|assisted` + `evidence/bench/2026-07-21-dev-two-mode.json`
  - Files: write `bench/run.ts`·`bench/scoring.ts`·`test/bench-scoring.test.ts`·`evidence/bench/*` / read `src/article-index.ts`·`src/article-match.ts`
  - Dependencies: 없음
  - Verify: `npm test` 통과 + `npm run bench:golden -- --split dev --mode assisted` 가 조문 도달
    accuracy@1/@3 를 산출하고 blind 44.0% 와 **분리 표기**됨
  - Failure probe: `expected_article` 없는 항목·조문 인덱스가 빈 법령에서 assisted 채점이 크래시 없이
    "측정 대상 아님"으로 분류되는지 확인
  - Commit: `changesets/20260721-lb2-two-mode-bench/`
- [x] **step-2** verify-citation — 인용 검증 도구 신설
  - Artifact: MCP 도구 `verify_citation` + 분류 4종 + 단위테스트
  - Files: write `src/citation-verify.ts`·`src/index.ts`·`src/types.ts`·`test/citation-verify.test.ts` / read `src/article-index.ts`
  - Dependencies: step-1
  - Verify: `npm test` + 실 API — 실재 인용(형법 제21조 정당방위) `ok`, 없는 조문(형법 제9999조)
    `not_found`, 제목 불일치(형법 제21조 "사기") `title_mismatch`, 없는 법령 `law_not_found`
  - Failure probe: upstream 장애 시 `ok` 로 오판하지 않고 오류를 그대로 드러내는지(거짓 안심 방지)
  - Commit: `changesets/20260721-lb2-verify-citation/`
- [x] **step-3** curation-verdict — C안 필요 여부 판정
  - Artifact: `evidence/bench/2026-07-21-curation-verdict.md` — assisted/blind 수치 대비 C안 기대이득·비용 추정
  - Files: write `evidence/bench/*` / read `evidence/bench/*`·`research/2026-07-21-*`
  - Dependencies: step-1, step-2
  - Verify: 판정이 수치에 근거하고(추정 금지), "필요/불필요/조건부" 중 하나로 명시되며 조건부면
    조건이 관측 가능하게 적힘
  - Failure probe: 판정을 뒷받침할 수치가 없으면 "판정 불가 + 무엇을 더 재야 하는가"로 정직하게 닫는지
  - Commit: `changesets/20260721-lb2-curation-verdict/`
- [x] **step-4** holdout — 홀드아웃 2모드 1회 측정
  - Artifact: `evidence/bench/2026-07-21-lb2-holdout.json` + 완료 리포트
  - Files: write `evidence/bench/*` / read `bench/golden.json`(holdout)
  - Dependencies: step-3
  - Verify: `--split holdout` 을 blind·assisted 각 1회만 실행해 기록. 세무 회귀 6종 무변 확인
  - Failure probe: holdout 이 dev 대비 크게 낮으면 과적합 사실을 결론에 명시(수치를 감추지 않는다)
  - Commit: `changesets/20260721-lb2-holdout/`

## 검증/DoD

- **DoD**: ① blind/assisted 2모드 수치가 dev·holdout 양쪽에 기록됨 ② `verify_citation` 이 실 API 로
  4개 분류를 정확히 반환 ③ C안 판정이 수치 근거와 함께 문서화 ④ 세무 회귀 6종 무변 ⑤ `npm test` 전량.
- 실패 경로: 각 step Failure probe.

## hard-stop policy

- C안 착수가 필요하다고 판정되면 **구현하지 말고 정지** — 기본법 범위는 사용자 소유 결정.
- blocked/error → `.harness/work.json` `stop_reason` 기록 후 정지.
- 실 API 인증·rate limit → 정지(재시도 루프 금지).

## rollback/cleanup

- `verify_citation` 은 `src/index.ts` 등록 제거로 표면에서 즉시 제거.
- 벤치 2모드는 `--mode blind` 가 기본값이라 기존 측정 재현성이 유지된다.

## finding 큐

- F1: 약칭 사전이 이 분야 표준 장비(chrisryugj 52개) — 우리 `term-bridge.ts` 는 3쌍뿐. 확장 후보.
- F2: 캐시 TTL 정교화(선행 사례: 검색 1h / 전문 24h). 현재는 프로세스 생존 LRU.
- F3: 구 plan step-2 산출물 `src/article-match.ts` 를 assisted 모드에서 재사용 — 기각된 것은
  "법령 재정렬" 용도이지 점수 함수 자체가 아니다.

## 진행 로그 (append-only)

- 2026-07-21 구 plan step-2 기각 → 선행 사례 조사 → 이 승계 plan 작성·승인
