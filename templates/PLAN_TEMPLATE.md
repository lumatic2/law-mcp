# PLAN — {milestone 제목}

> 생성: {YYYY-MM-DD} · 갈래: {product|learning|tooling|workflow} · scope 결정: {이번 run 이 어디까지}
> milestone-레벨 durable plan doc. Claude/Codex 가 이 문서만 읽고 이어받는 단일 장부.
> 세부 step 상태는 갈래별 status machine(`phases/index.json` / `changesets/README.md` / `run.json`)에, milestone 전체 픽업은 여기서.

## 북극성 → horizon → milestone → step (위계)
- **북극성**: {CLAUDE.md 궁극 목표 한 줄} (← `docs/OBJECTIVE.md`)
- **horizon**: {현 ROADMAP horizon} (← `docs/horizons/<slug>.md` — cascade 상위 백링크)
- **milestone**: {이번 milestone + 왜 이 규모인가(스케일 루브릭상 milestone인 근거)}

## run 전 scope 결정 (확정)
- **결정**: {이번 run 이 닫을 step 범위}
- **중단점(stop points)**: {검증 PASS 후 / blocked / budget 초과 / 사용자 결정 필요}

## 결정 로그 (run 전 사전 소진 — §B2-scope)
> 이 milestone 실행 중 나올 수 있는 사용자 소유 결정을 계획 단계에서 전부 매듭. 없으면 "없음" 명시(빈 섹션 금지).
- {결정 1: 선택지 → 확정값 (근거·확정일)} / 없음

## Step 트리 (실행 전 재귀 분해 — step-leaf 테스트로 leaf까지 펼침)
> 목표→milestone→step→spec 으로 위에서 아래로 쪼갠다. 각 노드가 step-leaf 테스트(① 한 coding pass ② 단일 검증 ③ 한 surface ④ 새 사용자결정 없음)를 통과하면 leaf. 아는 만큼 펼치고(못 펼치면 다음 1~2 leaf만) 나머지는 finding 큐로.
> 진행 권위는 갈래 status machine(`phases/index.json`·changeset 표·`run.json`)이 정본 — 이 체크박스는 milestone boundary 에서만 동기화(이중기록 drift 방지).
- [ ] **step-1** {slug} — {한 coding pass 작업} · 검증: {AC/커맨드}
- [ ] **step-2** {slug} — … · 검증: …
  - (더 쪼갤 필요 있으면 하위 leaf 로)

## 검증/DoD
- **DoD**: {milestone 완료 판정 — 통합 증거}

## finding 큐 (작업 중 발견 — 다음 step/changeset 으로 흘림)
- {F1 …}

## 진행 로그 (append-only)
- {YYYY-MM-DD} {무엇을 했나}
