# 20260721-lb2-verify-citation

## Target

- Goal: LB2(승계 plan) step-2 — 인용 검증 도구 `verify_citation` 신설.
- ROADMAP milestone: LB2 (active) — `plans/2026-07-21-lb2-consumer-mode-and-citation.md`
- 근거: 상위 레포 3곳(chrisryugj 2252★·startup-law·lexdiff)이 공통으로 헤드라인에 다는 기능인데
  우리에겐 없었다(`research/2026-07-21-lb2-prior-art-candidate-generation.md` 발견 3).
  LB2 step-1 의 조문 인덱스가 이미 있어 구현이 쌌다.

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/citation-verify.ts` (신규) | 판정 4종 + 조문번호/제목 정규화 + 완전일치 법령 해석 | LLM 환각 인용 탐지 |
| `src/index.ts` | `verify_citation` MCP 도구 등록 + 조문 인덱스 로더 | 도구 표면 8개로 |
| `test/citation-verify.test.ts` (신규) | 판정·정규화·거짓ok 방지 테스트 9건 | 회귀 방지 |

## Contract

- 판정 4종: `ok` / `not_found`(조문번호 환각 — 인접 조문 제안 동반) / `title_mismatch`(조문제목 환각) /
  `law_not_found`(법령 미해석 **또는 조회 실패**).
- **거짓 안심 금지**: upstream 장애·법령 미해석을 `ok` 로 처리하지 않는다. 검증 도구에서 가장 나쁜
  실패이므로 로더는 실패 시 `null` 을 넘겨 `law_not_found` 가 되게 한다.
- **법령명 완전일치만 채택**: 일반 검색의 폴백 사다리(본문검색·완화·브리지)를 인용 검증에 쓰면
  엉뚱한 법령과 대조하게 된다.

## Verification

- [x] `npm test` → **54/54 pass** (신규 9건), `tsc --noEmit` 클린
- [x] **실 API 5/5 정확**:
  | 입력 | 판정 |
  |---|---|
  | 형법 제21조 "정당방위" | `ok` |
  | 민법 제839조의2 "재산분할청구권" | `ok` (가지번호) |
  | 형법 제9999조 | `not_found` + 인접 제372·371·370조 |
  | 형법 제21조 "사기" | `title_mismatch` (실제 '정당방위') |
  | 존재하지않는법률 제1조 | `law_not_found` |

## 실패 검증이 잡은 실제 결함 2종 (수정 포함)

1. **거짓 ok (심각)** — 초기 구현은 검색 결과 첫 항목을 썼다. "존재하지않는법률 제1조" 가 폴백으로
   **건축법 시행령 제1조에 매칭돼 `ok` 판정**이 났다. → `pickExactLawId` 로 완전일치 강제, 테스트 고정.
2. **가지번호·한자 병기 오판** — `canonicalArticleNo("제839조의2")` 가 "839조의2" 를 남겨 인덱스 키와
   불일치했고, `isSameTitle` 이 "정당방위" vs "정당방위(正當防衛)" 를 다르다고 봤다(한자도 \p{L}).
   → 조문 정규화에 `조의`→`의`, 제목 비교에 괄호 내용 제거 추가.

## 배포

MCP 도구 표면이 바뀌므로(7개 → 8개) push → 배포 사본 pull+build → **MCP 재시작(사용자)** 필요.

## 배포 후 실표면 스모크 (2026-07-21 — MCP 재시작 완료)

재시작된 MCP 의 `mcp__law-mcp__verify_citation` 을 직접 호출해 4/4 정확 확인. 소스 테스트가 아니라
**배포본 도구 표면**에서의 재현이다(Judge 규약: 배포본까지 확인).

| 입력 | verdict | 비고 |
|---|---|---|
| 형법 제307조 "명예훼손" | `ok` | actual_title 일치 |
| 형법 제9999조 | `not_found` | nearby 제372·371·370조 |
| 존재하지않는법률 제1조 | `law_not_found` | 거짓 ok 회귀 없음 |
| 민법 제839조의2 "위자료청구권" | `title_mismatch` | 실제 '재산분할청구권' |

도구 수 8개 노출 확인. LB2 배포 경로 종료.
