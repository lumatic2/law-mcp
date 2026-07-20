# 20260720-lb1-bench-runner

## Target

- Goal: LB1 step-2 — 골든셋 채점 러너. `npm run bench:golden` 으로 recall@3 를 산출한다.
- ROADMAP milestone: LB1 (active) — `plans/2026-07-20-lb1-answer-reach-harness.md`

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `bench/scoring.ts` (신규) | 채점 로직(정규화·recall@k·조문 비교·요약) | 러너에서 분리해 단위테스트 가능 |
| `bench/run.ts` (신규) | 러너 CLI — split 필터·dry-run·결과 저장 | 실 API 측정 진입점 |
| `test/bench-scoring.test.ts` (신규) | 채점 로직 단위테스트 7건 | 지표 계산 회귀 방지 |
| `package.json` | `bench:golden`·`bench:verify-labels` 스크립트 | 실행 경로 고정 |

## Contract

- **정규화 후 완전일치 채점**: 부분일치를 쓰면 "민법"이 "민법 시행령"·"국제사법"에 걸려 점수가
  부풀려진다 — 테스트로 못박음.
- **에러는 분모에서 뺀다**: API 실패 항목은 `scored` 에서 제외하고 `errors` 로 따로 센다. 실패를
  0점으로 섞으면 "성능이 나쁜 것"과 "측정이 실패한 것"이 구분되지 않는다.
- **조문 축은 LB2 부터**: 현재 조문 검색 수단이 없어 `articleChecked=false`, `article_accuracy=null`.
  라벨(24/25건)은 이미 준비돼 있어 LB2 에서 채우기만 하면 된다.
- **홀드아웃 보호**: `--split holdout` 은 명시해야만 돈다(기본 dev). 측정 결과는
  `evidence/bench/<date>-<label>.json` 에 남아 조기 측정 여부가 검증된다.

## Verification

- [x] `npm test` → **32/32 pass** (신규 7건 포함)
- [x] `npm run bench:golden -- --split dev --dry-run` → API 호출 없이 25건·도메인 5×5·조문 라벨 24건 출력
- [x] **Failure probe** — `LAW_SEARCH_BASE_URL` 을 존재하지 않는 엔드포인트로 바꿔 실행:
      크래시 없이 2건 모두 `ERR` 처리, 사유("법제처 API 호출 실패: HTTP 404") 기록,
      `채점 0건 / 에러 2건` 으로 분리 집계, 부분 결과 파일 저장됨
      (`evidence/bench/2026-07-20-failure-probe.json`).

## Out of scope

- 기준선 측정(step-3) · 검색 로직 변경(LB1 범위 밖).
