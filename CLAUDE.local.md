## 이어서 할 일
> 2026-07-22 세션 종료 시 기록

- **TV6 = horizon 마지막 milestone.** 사용자가 "내일 한다"로 유보. 착수 시
  `plans/2026-07-21-tv6-verdict.md` 확인 → `approve_harness_plan.py --work-id tv6-verdict`.
- **홀드아웃 개봉은 1회용·되돌릴 수 없다.** `npm run bench:golden -- --set golden-tax
  --split holdout --i-am-closing-the-horizon` (플래그 없으면 `assertHoldoutSeal` 이 exit 1).
  **열기 전 사용자에게 한 번 더 확인받을 것.**
- 닫는 기준 6종 중 **2번(세법 recall@3 ≥90%)만 미지수**. dev 는 83.3%(기본 limit)~86.7%(limit 10).
  미달이면 **미달로 기록하고 닫는 것도 정상 종료**(TV6 plan 명시).
- **사용자 조치 대기 — MCP 재시작.** TV2(`source` enum 14→19)·TV3(`as_of`·`include_history`)·
  TV5(응답 본문에 세율표) 누적. 배포 사본 build 완료, 재시작해야 보인다.
- 후속 후보(범위 밖, 착수 전 승인): **위임조문 조회 3.3초** = `get_law_article` 지연의 64% ·
  `신고·불복·기한` recall 약점(수정신고·심판청구) · 상속세및증여세법·부가가치세법 배열형
  영향 범위 미측정(프로브에서 법령ID 오지정).

### 계획 위치 (cascade)
- Objective: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP 의 대표 중 하나가 된다
- Horizon: `tax-vertical` — 넓이 대신 한 분야를 끝까지, 첫 분야는 세법 (`plans/horizons/tax-vertical.md`)
- Milestone(active): **없음** — TV1~TV5·TV7 완료(6/7), TV6 만 `pending`
- Step: 해당 없음 (TV6 미착수)
- 다음 차례: TV6 를 active 로 승격 → `plans/2026-07-21-tv6-verdict.md` step 트리대로 홀드아웃
  1회 개봉 + 닫는 기준 6종 실측 대조 → close 면 `archive/horizons/` 이동

### 현재 상태 / 주의점
- 커밋·푸시 완료(`13a9d4c`, master). 미커밋은 `evidence/harness/size-retro.jsonl`(부산물) +
  untracked `evidence/bench/2026-07-21-tv3-regression.json` 뿐.
- `npm test` **302/302** · 범용 dev 88.0% · 세법 dev 83.3% · 세법 A/B(limit 10) 86.7%.
- ROADMAP **148줄** (budget 150 근접) — 다음 `/harness` 에서 compact 필요할 수 있음.
  session-end 는 ROADMAP 을 수정하지 않았다.
- **측정 규율**: 이 벤치는 노이즈가 아니라 **드리프트**가 문제다. 단일 측정으로 채택·기각 판정
  금지 — 오늘 recall@1 80→68% 를 회귀로 오독할 뻔했고 교차 측정에선 차이 0이었다.
  A/B = `bench/ud2-ab.ts --variants {ud4|tv4|tv7}` (k=1·k=3 승패 모두 출력).
- 구 `plans/2026-07-21-tv5-tax-tables.md` 는 전제 반증으로 **supersede** 됨 — 참조 금지.
