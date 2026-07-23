# PLAN — TF4 `as_of` 가 법령ID 를 받게

> 생성: 2026-07-23 · 산출물: changeset(tooling) · scope: 검색→시점조회 경로 복구

Status: approved (2026-07-23 사용자 승인 — horizon 전체 연쇄)
- execution mode: continuous

## 위계
- **북극성**: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 함정 없음 (← `plans/horizons/trap-free.md`)
- **milestone**: TF4 — `search_law` 가 준 `law_id` 를 `as_of` 조회에 그대로 넘길 수 있게 한다.
  milestone 규모 근거: 독립 step 2개(수리 / 실 MCP 표면 관측)이고 통합 검증은 실제 MCP 클라이언트에서의
  검색→시점조회 체인이다.

## 왜 (결함의 실체)
`getLawArticle` 은 `this.resolveAsOfVersion(lawId, options.asOf)` 로 **법령ID 를 넘기는데**
(`src/providers/lawgo-provider.ts:1477`), 받는 쪽 시그니처는 `resolveAsOfVersion(lawName, asOf)` 이고
내부에서 `fetchLawVersions(lawName)` 를 호출한다(:1537). 즉 **ID 를 이름 자리에 넣는다.**
그래서 `search_law` → `law_id` → `as_of` 로 이어지는 정상 경로가 끊긴다.
재현: `get_law_article(law_id="001586", as_of="2024")`.

세법에서 이건 주변 결함이 아니다 — 같은 조문이 귀속연도마다 다르고, 서버 instructions 가 도구를
쓰는 에이전트에게 "세금·연도가 걸린 질문은 `as_of` 를 쓰라"고 지시하고 있다(`src/index.ts:42`).
지시대로 따르면 끊기는 경로다.

## run 전 scope 결정 (확정)
- **결정**: `law_id` 로도 시점 해석이 되게 고치고, 실 MCP 표면에서 체인을 관측하는 데까지.
- **non-goals**: 시점 해석 규칙 자체(연도→날짜 매핑) 변경 금지 · 랭킹·검색 로직 변경 금지 ·
  `as_of` 응답 스키마 변경 금지.
- **중단점(stop points)**: 상류가 ID→법령명 해석을 안 주면 decision_required 로 정지하고 대안을
  제시 / 기존 테스트가 깨지면 blocked.
- **롤백/정리**: 변경 표면이 좁다(해석 경로 1개 + 테스트). 되돌리면 원상 복귀하며 데이터 잔재가 없다.

## 스캐폴딩 결정
- source-of-truth: `src/providers/lawgo-provider.ts` 의 `resolveAsOfVersion` 이 시점 해석의 정본.
  법령ID↔법령명 해석은 이미 있는 조회 경로를 재사용하고 새 캐시를 만들지 않는다.
- 검증: 회귀 테스트 신규(법령ID·법령명 양쪽 입력) · `npm test` 전건 · 실 MCP 클라이언트 체인 관측.
- 배포/운영: `src/` 를 고치므로 배포 사본 반영 필수 — push → `custom-mcps/law-mcp` 에서
  `git pull && npm run build` → MCP 서버 재시작(사용자). 재시작 부채를 완료 보고에 명시한다.
- 실패 처리: 해석 실패 시 **현행 법령으로 대체하지 않는다**(기존 규율 유지 — 잘못된 연도의 조문은
  오답이다). 무엇이 왜 안 됐는지를 말하는 에러로 거절한다.
- 검토 후 제외: frontend·design·data·관측 — 좁은 런타임 수리라 해당 없음.

## 결정 로그
- 사용자 소유 결정 없음 — 결함 수리이며 정답이 재현 케이스로 고정돼 있다.
- status: none-required

## Step 트리
- [x] **step-1 — 법령ID 입력 경로 수리**
  - Artifact: `law_id` 와 법령명 양쪽을 받는 시점 해석 + 회귀 테스트
  - Files: read `src/providers/lawgo-provider.ts`·`src/effective-law.ts`·`src/index.ts` / write `src/providers/lawgo-provider.ts`·`test/` 신규 테스트
  - Dependencies: 없음
  - Risk: 위험 (시점 해석 경로 변경이 법령명 입력 경로를 막을 수 있다)
  - Verify: `get_law_article(law_id="001586", as_of="2024")` 가 2024년 시행판 조문을 준다 ·
    법령명 입력 경로가 기존과 동일하게 동작한다 · `npm test` 전건 통과
  - Failure probe: 존재하지 않는 연도(예 `as_of="1800"`)를 주면 현행으로 대체하지 않고 거절하는지 확인
  - Commit: `fix: as_of 가 법령ID 를 받게 — 검색→시점조회 경로 복구`
- [x] **step-2 — 실 MCP 표면 체인 관측**
  - Artifact: `evidence/2026-07-23-tf4-asof-chain-e2e.md`(클라이언트 응답 원문 첨부)
  - Files: read `src/mcp-smoke-client.ts` / write `evidence/2026-07-23-tf4-asof-chain-e2e.md`
  - Dependencies: step-1
  - Risk: 없음
  - Verify: 실제 MCP 클라이언트에서 `search_law` → 받은 `law_id` → `get_law_article(as_of=...)` 가
    한 체인으로 성공 · 응답에 `as_of_rule` 이 실린다 · 배포 사본 build + dist 스모크 · 재시작 부채 명시
  - Failure probe: 세법 케이스로 과거 연도와 현행을 각각 조회해 **조문 내용이 실제로 다른지** 확인
    (같으면 시점 해석이 안 먹은 것이므로 실패로 기록)
  - Commit: `test: as_of 검색→시점조회 체인 실 MCP 관측`

## 검증/DoD
- `get_law_article(law_id=..., as_of=...)` 가 동작하고 회귀 테스트가 이를 고정한다.
- 실 MCP 클라이언트에서 검색→시점조회 체인이 성공하고 응답 원문이 증거로 남는다.
- 과거 연도와 현행의 조문 내용이 실제로 다름을 확인한다.
- `npm test` 전건 통과 · 배포 사본 build + dist 스모크 · 재시작 부채 명시.

## finding 큐
- (실행 중 발견분 append)

## 진행 로그 (append-only)
- 2026-07-23 plan 작성.
