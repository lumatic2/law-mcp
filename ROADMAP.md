# ROADMAP

> 마지막 업데이트: YYYY-MM-DD
> 상태: tooling maintenance horizon
> 북극성: {CLAUDE.md 의 궁극 목표 한 줄}
> line budget: <=150

## Current Horizon

<!-- harness:goal id="tooling-horizon" -->
목표: 하네스·스킬·런타임 변경을 테스트와 배포 증거로 닫는다.

## Active Milestones

<!-- harness:milestone id="T1" status="active" priority="P0" -->
### T1 — {제목, 예: 첫 tooling changeset 검증}
- DoD: {측정 가능한 완료 기준. 예: targeted tests + smoke + sync evidence PASS}
- Evidence: {changesets/<date-slug>/README.md 또는 실행 로그 경로}
- Gap: {왜 이 tooling 변경이 필요한가}
- Status: [ ]

<!-- harness:milestone id="T2" status="pending" priority="P1" -->
### T2 — {제목}
- DoD: {측정 가능한 완료 기준}
- Evidence: {changeset/test/deploy evidence 경로}
- Gap: {왜 필요한가}
- Status: [ ]

## Next Candidates
- {아직 active 는 아닌 후보}

## Archive Pointer
완료 이력은 `BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다. milestone 완료·compact 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
