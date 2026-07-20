# 20260720-lb1-baseline

## Target

- Goal: LB1 step-3 — dev 골든셋 실 API 측정으로 **기준선 확정**.
- ROADMAP milestone: LB1 (active) — `plans/2026-07-20-lb1-answer-reach-harness.md`

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `evidence/bench/2026-07-20-baseline.json` (신규) | 25건 항목별 결과 + 요약 | 이후 모든 개선의 대조 기준 |
| `evidence/bench/README.md` (신규) | 측정 이력 표 + 기준선 해석 | 홀드아웃 봉인 여부를 이 표로 검증 |

## Evidence

**기준선 (dev 25건, 실 API, 에러 0건)**

| 지표 | 값 |
|---|---|
| **recall@3 (1차)** | **44.0%** |
| recall@1 | 40.0% |
| 판례 hit율 | 80.0% |
| 조문 정확도 | 미측정 (LB2) |

도메인별 recall@3: 부동산임대차 80% · 계약민사 60% · 가족 40% · **노동 20% · 형사 20%**

**해석**: 법령명에 쟁점어가 있으면 맞고 없으면 틀린다. 형사 20%의 원인은 "정당방위"·"사기"가
*형법*이라는 법령명과 한 글자도 공유하지 않는다는 것 — 현재 검색은 쟁점→법령 매핑을 못 하고
법령명 문자열 매칭에 의존한다. 판례 hit율 80%와의 격차도 같은 구조(사건명엔 쟁점어가 있다).

**리서치 실측치(31%)와 대조**: 구성이 다른 표본(임시 13건 vs 골든셋 25건)이라 값은 다르나 같은
자릿수·같은 결론. 정본 기준선은 이 **44.0%**.

## Verification

- [x] `npm run bench:golden -- --split dev --label baseline` 실 API 완주 — 25/25 채점, 에러 0
- [x] 결과 파일 저장 확인 (`evidence/bench/2026-07-20-baseline.json`)
- [x] 홀드아웃 미측정 봉인 확인 — `evidence/bench/` 에 holdout 라벨 파일 없음
- [x] `npm test` 32/32 (측정은 소스 무변경이므로 회귀 없음)

## Out of scope

- 검색 로직 개선 — LB2.
