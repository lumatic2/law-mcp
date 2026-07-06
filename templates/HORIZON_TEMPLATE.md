# HORIZON — {horizon 제목}

> 생성: {YYYY-MM-DD} · ROADMAP marker: `harness:goal id="{id}"` · 상태: active | next | closed
> cascade 중간(Horizon). horizon 당 1개. 이 horizon 이 담을 milestone 들을 미리 펼쳐 "왜 지금·어디까지 가면 닫나"를 박는다.
> 위계: Objective(`docs/OBJECTIVE.md`) → **Horizon**(이 문서) → Milestone(`docs/plans/<date>-<slug>.md`) → Step.
> 진행 상태의 정본은 `ROADMAP.md` marker — 이 문서의 milestone 체크박스는 milestone boundary 에서만 동기화(이중기록 drift 방지).

## 목표
- {이 horizon 이 북극성에서 무엇을 끌어올리나 — 한두 줄}

## 왜 지금 (이전 horizon 이 드러낸 갭)
- {직전 phase 가 남긴 갭/측정/사용자 결정}

## 담을 milestone (계획 — active 는 ROADMAP 이 정본)
- [ ] **{M1 id}** {제목} — {왜 milestone 규모인가(≥2 독립 step + 통합검증)} → `docs/plans/<date>-<slug>.md`
- [ ] **{M2 id}** {제목} — {…}

## 닫는 기준 (이 horizon 을 completed 로)
- {모든 milestone DoD 충족 + 이 horizon 단위의 통합 증거}

## Objective 임팩트 (close 시 기록 — §B3 완료 hook 5)
- {이 horizon 이 Objective 의 어느 축을 무엇으로 얼마나 움직였나 · 자기평가 재측정 필요 여부}

## 링크
- 위(Objective): `docs/OBJECTIVE.md`
- 설계 결정: `docs/adr/<NNNN>-<title>.md`
- 아래(Milestone PLANs): {위 목록의 plan doc 들}
