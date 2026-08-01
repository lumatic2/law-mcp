# 완료 — M10 공인회계사 2차 세법 Codex·Claude 2×2 판정

> 완료: 2026-08-01 · M10 (goal `tax-functional-capstone`) · 배치: `archive/reports/2026-08-01-m10-cpa2-tax-close.md` (record — 작성 후 동결)

## 1. 결과

Codex와 Claude Opus의 law-mcp 사용·미사용 네 세션을 동일 문제로 실행하고 블라인드 채점했다.
두 사용 arm 모두 사전 절대 기준을 전부 통과하지 못해 종합 판정은 `미달`이다. 상세 점수와 잔여
오류는 `archive/reports/2026-08-01-m10-cpa2-tax-opus-ab-verdict.md`에 동결했다.

## 2. 이슈와 해결

답안 동결 뒤 원 채점표의 월정액급여·골동품 필요경비·사업소득 정답 오류 3건을 발견했다. 원본 SHA를
보존하고 시험 기준일 법령 원문으로 파생 정정했으며, 공개 이견이 남은 월세 1점은 계속 분모에서
제외했다. 계획 대비 범위 확장·누락은 없고, 등록 당시 changeset 경로명과 실제 경로명이 달라 실제
산출물 경로를 완료 노트에 명시했다. 순조로웠던 격리 판정은 네 trace를 다시 검증했고, 점수 0.1점
변조 탐침이 실패하는 것도 확인했다.

## 3. 증거

- changeset: `changesets/20260801-m10-cpa2-tax-opus-ab`
- 검증: 동결 24/25(96%) PASS · 격리 PASS · 네 실행 PASS(시작 편차 1.043155초) · 블라인드 재채점/변조 탐침 PASS · `npm test` 356/356
- 크기 회고: 문제 동결·격리 하네스·4세션 실행·채점 판정의 4개 changeset으로 닫힌 milestone이다.
- 실표면: Orca 신규 터미널 네 개에서 C+/O+만 실제 law-mcp 본문을 받았고 C-/O-는 도구 0회인 상태로 완결 답안을 생성했다.
- 재현: `python evidence/cpa2/2026-m10/frozen/validate_frozen.py; python bench/cpa2-m10/validate_isolation.py; python bench/cpa2-m10/validate_runs.py evidence/cpa2/2026-m10/runs; python bench/cpa2-m10/validate_scoring.py; npm test`
