# changeset 20260731-m3-trap-fix — M3 · 함정 소진 (J·F·I·D)

- Plan: `plans/2026-07-31-m3-함정소진.md` · milestone M3 (연쇄 M1→M2·M3→M4)
- 갈래: tooling (`src/providers/lawgo-provider.ts` — 배포 사본 반영+재시작 부채)

## step-1 — J: law_name null (2026-07-31)

- 원인 확정: 법령 상세(law/eflaw MST)의 법령명은 `기본정보.법령명_한글`(중첩+언더스코어)인데
  `findArticleInRoot` 가 최상위 키(`법령명한글`)만 봤다 — 같은 필드를 경로마다 다른 키 목록으로
  읽던 불일치(`:1505` 는 이미 언더스코어 우선).
- 수리: 기본정보 폴백 추가(law_id 도 동일). 상류가 이름을 안 주면 null 유지(지어내지 않음).
- Verify: 실 MCP 재현 — `get_law_article(001586, 59, as_of=2024)` → `law_name: "국세기본법"` ✅

## step-2 — F: 5xx 오분류 재분류 (2026-07-31)

- 수리: 5xx 수신 시 안정 엔드포인트(target=law) **검증 재조회 1회**로 분류 —
  auth(재시도 무익·인증 안내) / ok(일시 장애, 인증 정상 명시) / unknown(기존 안내 유지).
  60초 결과 캐시(프로브 폭주 방지) · ECONNABORTED 는 프로브 생략(무한 재조회 없음).
- Verify: `buildFiveHundredError` 3분기 단위 테스트 ✅. 실 5xx 는 정상 인증 환경에서 재현 불가 —
  완료 노트에 "평가 못 함"으로 표면화.

## step-3 — I: 위임조문 조회 지연 (2026-07-31)

- 수리: 위임 조회(`lsDelegated`)를 본문 조회와 **병렬** 시작 — 조문 번호는 입력에서 이미 알므로
  본문 수신을 기다릴 이유가 없었다. 총 지연이 (본문+위임) 합에서 max 로. 기존 LRU 캐시(30) 유지 —
  같은 법령 반복 조회 상류 호출 1회.
- Verify: 캐시 계약 테스트(호출 수 1) ✅ · 콜드 측정에서 위임 왕복 직렬 가산 제거(구조) ·
  `delegated_to` 내용 동일성 — 기존 delegated 테스트 + m3 fixture 회귀 ✅
- Failure probe: 시점 오염 — 상류에 시점 축이 없으므로 as_of 조회에 위임 정보를 붙일 때
  **"현행 기준" 고지 warning** 을 싣는다(조용한 오답 방지).

## step-4 — D: delegated_to 전달 강화 (2026-07-31)

- 수리: `delegated_to` 존재 시 소비 안내 warning(`DELEGATION_NOTICE`) — "구체 기준 질문의 근거는
  본법이 아니라 위임 조문일 수 있다, 어느 쪽인지 명시하라". 등급 경고(TV2)와 같은 원리.
- Verify: 실 MCP — 위임 지점(소득세법 §12, 20건) 안내 실림 ✅ · 위임 없는 조문(국세기본법 §59)
  무소음 ✅ · 다단 위임(법→령→규칙)은 각 응답이 자기 위임을 안내(끊김 없음).
- 효과 측정(본법/시행령 진동 감소)은 M4 before/after 소관.

## 공통

- `npm test` 337/337 (회귀 9건 신규 `test/m3-trap-fixes.test.ts`) · 실 MCP 스모크 `src/m3-traps-smoke.ts`
- evidence: `evidence/2026-07-31-m3-traps-e2e.md`
