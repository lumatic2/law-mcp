# 20260723-tf3-install

## Target

- Goal: 처음 붙이는 사람이 `LAW_API_OC` 에서 막히지 않게 한다.
- ROADMAP milestone: TF3 (horizon `trap-free`)

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `README.md` | 도구 4/11 만 문서화, 발급 안내 없음 | 11개 전부 + 발급 절차 + 진단표 |
| `scripts/check-readme-tools.ts` | 문서가 뒤처지는 걸 사람 눈으로 못 막는다 | 등록 목록과 불일치 시 exit 1 |
| `.env.example` | 값 이름만 있었다 | 발급 URL·영향 범위 주석 |
| `src/config.ts` | 무자격 문구가 한 줄 | 무엇이·어디서·어디에 3요소 |
| `src/providers/lawgo-provider.ts` | 인증 실패가 상류 문구 그대로 | 확인 목록 + 5xx 오분류 힌트 |
| `src/no-credential-smoke.ts` | 무자격 상태를 관측할 수단이 없었다 | 실 MCP 클라이언트 왕복 |

되돌리기: 문구 변경 위주. 단 배포 사본이 이미 재빌드됐으므로 롤백 시 배포 사본도 같이 되돌린다.

## step-1 — README 실물화

- Verification
  - [x] 도구 11종 전부 표에 기재 · `npx tsx scripts/check-readme-tools.ts` PASS
  - [x] 실패 검증: 표에서 1개 지우면 FAIL + exit 1
  - [x] 발급 절차 = 법제처 신청·인증키관리 링크 + 접근일 병기(화면 단계 복제 안 함)
- Result: 도구 4/11 → 11/11. 대조 스크립트가 앞으로의 drift 를 막는다.

## step-2 — 무자격 진단 메시지

- Verification
  - [x] 무자격 문구에 ① 무엇이 없는지 ② 어디서 받는지(URL) ③ 어디에 넣는지 포함
  - [x] 실패 검증(잘못된 인증값): **실제 결함 적발** — 상류가 경로에 따라 200+오류본문 / 5xx 로
        갈려 후자가 "일시 장애(재시도 가능)"로 오분류된다. 반복 시 의심 대상을 메시지에 추가
  - [x] 그 과정에서 IP·도메인 등록 필요를 상류 문구로 확인해 README 반영
  - [x] `npm test` 314/314 · 정상 인증값 회귀 없음
- Result: 두 실패 모두 사람이 읽는 안내가 된다. 5xx 근본 재분류는 후속 후보.

## step-3 — 무자격 실표면 관측

- Verification
  - [x] `npx tsx src/no-credential-smoke.ts` — 클라이언트 수신 원문 증거에 첨부
  - [x] 스택트레이스·내부 경로 노출 없음 · 서버는 죽지 않고 기동, 로컬 도구는 동작
  - [x] 배포 사본 `git pull && npm run build` + dist 스모크 통과 (`2c668b9`)
  - [x] **재시작 부채 명시** — 사용자가 MCP 서버를 재시작해야 이 세션에 반영
- Result: `evidence/2026-07-23-tf3-no-credential-e2e.md`

## Result

- Status: done (step 3/3)
- Evidence: `evidence/2026-07-23-tf3-no-credential-e2e.md`
