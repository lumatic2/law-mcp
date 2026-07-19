# ROADMAP

> 마지막 업데이트: 2026-07-12
> 상태: issueback-repair-h8ta2 완료(2026-07-12) — active 없음, 새 후보는 소비자 issue-back 대기
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `OBJECTIVE.md`)
> line budget: <=150

## Current Horizon

<!-- harness:goal id="issueback-repair-h8ta2" status="completed" -->
(완료 2026-07-12 — 결함 4건 수리 + ib1b 전문 도달. 소비자 RX2 재실험에서 원 실패 5건 전부
MCP 경유 재현 성공, taxr-task-01 ax_possible 승격 확정. Objective 임팩트: 판례 검색이
"제목만" → "전문 도달"로 — 첫 실소비 issue-back 루프 완결.)

## Active Milestones

<!-- harness:milestone id="IB1" status="completed" priority="P0" evidence="changesets/20260712-ib1-h8ta2-repair + npm test 9/9 + 실 API 재현 4/4" -->
### IB1 — get_precedent NTS 소스 본문 도달 + 검색 결함 수리
- DoD: ① 실패 5건(619683/618097/310830/325202/612611) 중 NTS 소스 판례의 본문(판시사항·판결요지
  또는 판례내용 텍스트)이 `get_precedent`로 도달하거나, 구조적 불가 시 대체 경로(자동 폴백 +
  구체 안내)가 구현·검증됨 ② `search_law`/`search_admin_rules` 본문 키워드 검색 지원(law.go.kr
  DRF search=2 등) — "가지급금" 류 쿼리가 법인세법 계열 도달 ③ 다단어 자연어 쿼리 0건 시 완화
  재시도 폴백(경고 포함) ④ 대형 admin rule 부분 반환 옵션 또는 문서화. 전부 실 API 스모크로 검증
- Evidence: changesets/20260712-ib1-h8ta2-repair + npm test 9/9 + 실 API 재현 4/4
- Gap: ai-accounting-firm H8 TA2 조세불복 의견서 실험에서 판례 인용이 제목 수준으로 제한 —
  판례 검색 기능의 실효성 붕괴 (docs/BACKLOG.md Issue-back Queue #1~#4)
- Status: [x]

- Completed at: 2026-07-12
- Summary: 결함 4건 수리: NTS 폴백(5/5 요지 도달)·본문검색·완화재시도·부분반환, 게이트 독립 재현 PASS
## Next Candidates
- (없음 — 새 후보는 ai-accounting-firm 실소비 issue-back에서만)

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다. milestone 완료·compact 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-12: 첫 실 horizon 은 ai-accounting-firm issue-back 수리로 개설 (kifrs-rag 선례 준용 —
  새 horizon 은 사용처 결함만 입력으로 연다).
