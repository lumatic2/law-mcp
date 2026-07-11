# BACKLOG

> 완료·보류·아카이브된 milestone 의 압축 이력. `ROADMAP.md` 는 current horizon 만 담고 150줄 이하로 유지한다.

## Issue-back Queue (ai-accounting-firm 실소비에서 돌아온 결함)

### 2026-07-12 — H8 TA2 조세불복 쟁점 의견서 실험 (첫 실소비, 원본: `~/projects/ai-accounting-firm/docs/cases/2026-07-12-taxr-appeal-opinion/mcp-log.md`)

> 상태: 미수리. 총 34회 호출(hit 16 / miss 11 / 도구 실패 5 / 처리 실패 1)에서 발견.
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
