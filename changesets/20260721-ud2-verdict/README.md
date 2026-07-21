# UD2 step-4 — 종합 판정 + 지연 수리 + 배포

- 일자: 2026-07-21 · milestone: UD2 · 판정서: `evidence/bench/2026-07-21-ud2-verdict.md`

## 판정: 채택

정답 포함률 48% → **80%**, 1위 정확도 32% → **72%**, 조문 출하율 **76%**. 새로 깨진 쿼리 0.

## 이 step 에서 고친 것 — 지연

첫 측정이 DoD(≤3초)를 못 넘었다(중앙 4079ms). 사다리와 `aiSearch` 를 **순차**로 돌리고
있었는데, 두 채널은 서로의 결과를 안 쓴다. 동시 실행으로 바꿔 **2939ms** — 대조군 2958ms 와
사실상 같다. 채널을 하나 더 붙이고도 느려지지 않았다.

## 도구 표면

개수 불변(11개). `search_law` description 을 갱신했다 — 관련도 순위가 어디서 오는지,
`ai_articles` 와 `linked_articles` 가 왜 다른 필드인지 소비 LLM 이 알아야 한다.

## 검증

- `npm test` 157/157
- `npm run bench:golden -- --set golden-v2 --split dev` (동시 실행 전환 후 재측정, 수치 동일)
- 지연 실측 5쿼리 × 2배치 (캐시 없는 상태)
- 배포 사본 `git pull && npm run build` 후 그 dist 로 실 표면 스모크
