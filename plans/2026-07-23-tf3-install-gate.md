# PLAN — TF3 설치 관문

> 생성: 2026-07-23 · 산출물: changeset(tooling) · scope: OC 발급 안내 · 무자격 진단 · README 실물화

Status: pending-approval
- execution mode: continuous

## 위계
- **북극성**: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 함정 없음 (← `plans/horizons/trap-free.md`)
- **milestone**: TF3 — 처음 붙이는 사람이 `LAW_API_OC` 에서 막히지 않게 한다. milestone 규모 근거:
  독립 step 3개(문서 / 런타임 진단 / 무자격 실표면 관측)이고 통합 검증은 무자격 E2E 다.

## run 전 scope 결정 (확정)
- **결정**: 문서 + 런타임 진단 메시지 + 무자격 환경 실측까지.
- **non-goals**: degraded 모드 미채택 — 노출 도구 11개 중 9개가 OC 필수라
  (`research/2026-07-23-trap-free-install-gate.md` §1) 2개만 도는 상태는 관문을 낮추는 게 아니라
  첫인상을 망친다 · npm 배포와 `private:true` 해제는 이 milestone 범위 밖(넓이 축, 사용자 결정).
- **중단점(stop points)**: 발급 절차의 사실관계가 확인 안 되면 decision_required 로 정지하고 사용자
  확인을 요청한다(추정 서술 금지) / 배포 사본 스모크 실패는 blocked.
- **롤백/정리**: `src/config.ts`·`src/mcp-error.ts` 는 문구 변경 위주라 되돌리기 쉽다. 단 배포 사본이
  이미 재빌드된 뒤 되돌리면 두 사본이 어긋나므로 롤백 시 배포 사본도 같이 되돌린다.

## 스캐폴딩 결정
- source-of-truth: `README.md` 가 설치 안내의 정본, `.env.example` 이 필요한 env 이름의 정본.
  런타임 에러 문구는 `src/config.ts` 가 정본이며 README 와 문구를 일치시킨다.
- 검증: OC 미설정 상태로 실제 MCP 클라이언트(`npm run smoke:mcp`)를 띄워 사용자가 받는 메시지를
  관측 · README 도구 목록과 `src/index.ts` 등록 도구 목록의 기계 대조 · `npm test`.
- 배포/운영: `src/config.ts` 를 건드리므로 배포 사본 반영이 필수다 — push →
  `custom-mcps/law-mcp` 에서 `git pull && npm run build` → MCP 서버 재시작(사용자).
  재시작 부채를 완료 보고에 명시한다.
- 문서: README 구성 순서는 ① 무엇인지 ② 도구 11개 표 ③ OC 발급 절차(단계별) ④ MCP 클라이언트 등록
  예시 ⑤ 흔한 실패와 진단.
- 검토 후 제외: frontend·design·data·관측 — 문서와 진단 문구 작업이라 해당 없음.

## 결정 로그
- D-TF3-1 degraded 모드 채택 여부 — 선택지 ① 미채택(안내와 진단으로 간다) ② 채택(무자격이면 로컬
  2도구 + NTS 만 노출). 추천 ① — 근거는 위 non-goals.
  확정값: (승인 게이트에서 기록)
- D-TF3-2 OC 발급 절차의 사실관계 — 상류 공개 페이지 3곳에 절차 서술이 없다(리서치 §2). 발급 화면
  실제 문구와 IP/도메인 등록 필요 여부는 실제 발급자인 사용자만 안다. 사용자 확인이 step-1 착수
  조건이며 확인 전에는 추정으로 쓰지 않는다.
  확정값: (승인 게이트에서 기록)
- D-TF3-3 npm 공개 배포를 이 horizon 에 담을지 — 범위 밖으로 두는 것이 기본이다
  (`plans/horizons/CANDIDATES.md` E: 사용자 발화가 착수 신호).
  확정값: (승인 게이트에서 기록)
- status: (승인 게이트에서 resolved 로 기록)

## Step 트리
- [ ] **step-1 — README 실물화**
  - Artifact: 도구 11개와 발급 절차를 담은 `README.md` · `.env.example` · `scripts/check-readme-tools.ts`
  - Files: read `src/index.ts`·`research/2026-07-23-trap-free-install-gate.md` / write `README.md`·`.env.example`·`scripts/check-readme-tools.ts`
  - Dependencies: 없음 (D-TF3-2 사용자 확인이 착수 조건)
  - Verify: `npx tsx scripts/check-readme-tools.ts` 가 README 표와 `src/index.ts` 등록 목록이 일치할
    때만 exit 0 · 발급 절차의 모든 외부 URL 에 접근일 병기
  - Failure probe: README 표에서 도구 1개를 지우고 대조 스크립트가 exit 1 하는지 확인
  - Commit: `docs: README 를 실제 노출 도구 11개 + OC 발급 절차로 실물화`
- [ ] **step-2 — 무자격 진단 메시지**
  - Artifact: 사람이 읽는 OC 미설정·인증 실패 진단 문구
  - Files: read `src/config.ts`·`src/mcp-error.ts`·`src/providers/lawgo-provider.ts` / write `src/config.ts`·`src/mcp-error.ts`
  - Dependencies: step-1
  - Verify: OC 없이 기동한 메시지가 ① 무엇이 없는지 ② 어디서 받는지(URL) ③ 어디에 넣는지를 담는다 ·
    `npm test` 전건 통과
  - Failure probe: 잘못된 OC 값을 넣고 인증 실패 응답이 무엇이 잘못됐는지 말하는지 확인 — 현재는
    상류 문구가 그대로 노출된다
  - Commit: `feat: OC 미설정·인증 실패를 사람이 읽는 진단으로`
- [ ] **step-3 — 무자격 실표면 관측**
  - Artifact: `evidence/2026-07-23-tf3-no-credential-e2e.md`(클라이언트 로그 원문 첨부)
  - Files: read `src/mcp-smoke-client.ts` / write `evidence/2026-07-23-tf3-no-credential-e2e.md`
  - Dependencies: step-2
  - Verify: `LAW_API_OC` 를 비운 환경에서 `npm run smoke:mcp` 실행 후 클라이언트가 받은 메시지 원문을
    증거에 붙인다 · 배포 사본 build + dist 스모크 · 재시작 부채 명시
  - Failure probe: 메시지가 스택트레이스나 내부 경로를 노출하면 실패로 기록하고 step-2 로 되돌린다
  - Commit: `test: 무자격 환경 MCP E2E 관측 + 배포 사본 스모크`

## 검증/DoD
- README 가 노출 도구 11개를 전부 담고 대조 스크립트가 그것을 강제한다.
- OC 미설정 환경에서 실제 MCP 클라이언트가 받는 안내 메시지가 증거로 남는다(스택트레이스 아님).
- `npm test` 전건 통과 · 배포 사본 build + dist 스모크 · 재시작 부채 명시.

## finding 큐
- (실행 중 발견분 append)

## 진행 로그 (append-only)
- 2026-07-23 plan 작성.
