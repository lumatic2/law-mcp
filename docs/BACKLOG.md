# BACKLOG

> 완료·보류·아카이브된 milestone 의 압축 이력. `ROADMAP.md` 는 current horizon 만 담고 150줄 이하로 유지한다.

## Issue-back Queue (ai-accounting-firm 실소비에서 돌아온 결함)

### 2026-07-12(c) — H11 C13-2 부가세 매입세액 불공제 실험 (세 번째 실소비, 원본: `~/projects/ai-accounting-firm/docs/cases/2026-07-12-taxi-vat-deduction/mcp-log.md`)

> 상태: **수리 완료 (2026-07-20, ib3 — #6·#7)**. 핵심 5도구 37콜(hit 27/73%). **수리 전 종목 회귀 없음 + ib2/ib2b
> 용어 브리지 첫 실전 관측**: `search_precedents("기업업무추진비 매입세액 불공제")` → 브리지
> warning + 56건 도달(오케스트레이터 독립 재현 동일). get_precedent 7/7(ib1b 유지),
> search_law 본문 폴백 정상.

6. **[경미] `search_admin_rules` 폴백 체인 비대칭 — 수리 완료(ib3, 2026-07-20)** — 실제 원인은
   본문 폴백 미트리거가 아니라 **사다리가 2칸뿐**이었던 것(규칙명 → 본문검색에서 끝). `search_law`
   의 완화 재시도·용어 브리지·브리지+완화 3단을 이식해 대칭화.
   재현: `search_admin_rules("기업업무추진비 손금불산입 기준")` 0건 → 3건(브리지 경고 동반).
   changeset: `changesets/20260720-ib3-admrul-ladder-ranking/`.
7. **[경미] 본문 폴백 랭킹 품질 — 부분 수리(ib3, 2026-07-20). 관련도 랭킹은 API 계약상 불가** —
   실제 원인 규명: 본문검색은 쿼리가 법령명에 안 걸려 match_type 이 전원 `contains` 동률이 되고,
   그러면 타이브레이커인 **법령명 길이**가 유일한 정렬 기준이 된다(= "이름 짧은 법 순").
   수리: 쿼리 토큰이 법령명에 겹치는 수를 기존 정렬 위에 얹음(`상속세 물납 허가 요건` → 상속세 및
   증여세법 계열 1~3위) + 응답에 "관련도순 아님" 경고 명시.
   **BACKLOG 개선 후보였던 "토큰 매칭 수 기반 재정렬"은 본문 대상으로는 기각** — upstream 응답에
   매칭 스니펫·관련도 점수가 없고(실측), 응답 순서는 가나다순이며, 본문 fetch 후 빈도 재정렬은
   의미 불일치를 못 걸러 예금자보호법이 `가지급금 인정이자` 2위로 올라온다. 근거 → changeset
   `기각된 대안` 절. 완전한 관련도 랭킹은 별도 신호원(색인 자체 구축 등) 없이는 불가.

### 2026-07-12(b) — H10 C6-2 법인세 세무조정 실험 (두 번째 실소비, 원본: `~/projects/ai-accounting-firm/docs/cases/2026-07-12-taxc-adjustment-review/mcp-log.md`)

> 상태: **수리 완료 (2026-07-12, ib2·ib2b — a195765·8ba2d49)**. 총 35회 호출(hit 24/69%)에서
> 발견. **수리 3종(IB1·ib1b) 회귀 없음 확인** (get_precedent 5/5 성공 — TA2 0/5 의 완전 역전,
> 완화 재시도·본문검색 폴백 정상).
> #5 수리 내역: `src/term-bridge.ts` 신·구 용어 사전(접대비↔기업업무추진비·법정/특례기부금·
> 지정/일반기부금) + 전 폴백 0건 시 치환 재검색, ib2b 로 치환 쿼리 점진 완화 추가.
> 오케스트레이터 게이트 재현(2026-07-12): `search_precedents("기업업무추진비 한도 손금불산입")`
> 0건→5건 + 브리지·완화 warning, 회귀 쿼리 2종 무변, 테스트 20/20(소스·배포 사본 양쪽).
> changeset: `changesets/20260712-ib2-term-bridge/`.

5. **[중요] 세법 용어 개정 신·구 용어 갭 — 수리 완료(ib2·ib2b)** — `search_precedents("기업업무추진비 …")` 0건 vs
   구용어 `("접대비 …")` 3건. 판례 색인이 선고 당시 용어에 묶여 현행 법령 용어 검색이 실패.
   완화 재시도(토큰 제거)로 구제 불가, `batch_validate_legal_terms`/`suggest_term_patches` 는
   목적이 달라 브리지 못함(후자는 NIKL_API_KEY 부재로 사전 경로 비활성). 개선 후보: 신·구 용어
   동의어 브리지(개정 이력 사전 — 기업업무추진비↔접대비 등, kifrs-rag term_bridge 동형).
   소비자 판정: 승격 조건 아님(실무자에겐 자명한 우회) — 도구 단독 사용자 함정 제거 목적.

### 2026-07-12 — H8 TA2 조세불복 쟁점 의견서 실험 (첫 실소비, 원본: `~/projects/ai-accounting-firm/docs/cases/2026-07-12-taxr-appeal-opinion/mcp-log.md`)

> **상태: 수리 완료 (2026-07-12, IB1 — 커밋 87abd83, changesets/20260712-ib1-h8ta2-repair).**
> #1: NTS 문서 API(taxlaw.nts.go.kr action.do ASIQTB002PR01) 폴백으로 실패 5건 전부 사건명·판결요지
> (+참조조문) 도달. **후속 ib1b(커밋 497063d)로 전문까지 도달 완성** — NTS 응답의
> `dcmHwpEditorDVOList` 내 서버 변환 HTML(dcmFleTy=html)을 추출(HWP 파싱 불요, 사용자 제안이
> 트리거). 실패 5건 전부 주문·이유 포함 전문 반환(337~13,621자). 잔여 한계: 판시사항 필드는
> NTS 구조상 부재(전문·판결요지로 갈음). #2: search=2
> 본문검색 자동 폴백. #3: 0건 시 토큰 완화 재시도 1단. #4: get_admin_rule offset/limit 클라이언트
> 슬라이싱. 게이트: 오케스트레이터 실 API 독립 재현 4/4 + npm test 9/9. 다음 단계는
> ai-accounting-firm RX2(MCP 재시작 후 재실험 → 승격 판단).
> 원기록 — 총 34회 호출(hit 16 / miss 11 / 도구 실패 5 / 처리 실패 1)에서 발견,
> **#1 수리가 어스회계법인 taxr-task-01의 ax_possible 승격 조건** (`ax-verdict.md`).

1. **[치명적] `get_precedent` 사실상 100% 실패 (5/5)** — `search_precedents`가 반환한 `precedent_id`
   (619683, 618097, 310830, 325202, 612611)로 단건 조회 시 전 필드 공란 +
   `"lawService JSON 단건 미지원 (NTS sourced 가능성)"`. 2014~2026년 연식 무관 → 구조적.
   원인 추정: 검색은 국세법령정보시스템(NTS) 소스 색인, 단건 조회는 법제처 lawService 경로 —
   두 소스 불일치. 판시사항·판결요지 인용이 불가능해 판례 검색 실효성이 무너짐.
2. **[중요] `search_law`/`search_admin_rules`가 본문 키워드 미지원** — `search_law("가지급금")`,
   `("부당행위계산")`, `("소득처분")` 전부 0건(해당 용어가 법인세법 §52 등 본문에 그대로 존재함에도).
   법령명 정확/prefix 매칭만 동작. description("Search laws by keyword")과 불일치 — 본문 인덱싱
   또는 설명 정정 필요.
3. **[중간] `search_precedents` 자연어 다단어 쿼리 0건** — "업무무관 가지급금 대표이사 소득처분" 0건
   vs "가지급금" 277건. AND 전량일치 추정. kifrs-rag 사례 1호와 동일 패턴(두 엔진 공통 특성).
4. **[경미] `get_admin_rule` 대형 문서(70,597자) 그대로 반환 시도** — 도구 토큰 한도 초과로 차단,
   별도 파일 강제. 스니펫/섹션 단위 반환 옵션 검토.

## Completed

- (아직 없음)

## Deferred

- (아직 없음)

## Notes

- 완료 milestone 은 3~5줄로 압축한다: 완료일, 결과, evidence, 남은 gap.
- active/pending milestone 은 자동 아카이브하지 않는다.
- 이 파일과 ROADMAP.md 의 쓰기 소유자는 `/harness` 이다. `session-end` 는 ROADMAP 을 read-only 로 확인한다.
