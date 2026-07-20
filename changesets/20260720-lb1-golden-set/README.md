# 20260720-lb1-golden-set

## Target

- Goal: LB1 step-1 — 비세무 5도메인 골든셋 40건 작성. 검색 품질을 재는 기준 데이터.
- ROADMAP milestone: LB1 (active) — `plans/2026-07-20-lb1-answer-reach-harness.md`

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `bench/golden.json` (신규) | 골든셋 40건(dev 25 / holdout 15, 5도메인 × 8) | 정답 도달률 측정의 기준 데이터 |
| `bench/README.md` (신규) | 스키마·라벨 규약·**홀드아웃 봉인 규칙**·지표 정의 | 과적합 방지 규약의 정본 |
| `bench/check-schema.ts` (신규) | 스키마 완전성 검사 + 라벨 근거 누락 검출 | 추정 라벨이 섞여 들어가는 것을 기계로 차단 |
| `bench/verify-labels.ts` (신규) | 정답 라벨을 실 API 로 검증(법령 실재·조문 실재) | 라벨 오류와 도구 성능 저하를 구분 |

## Contract

- **라벨 근거 필수**: 모든 항목에 `source`(법령명·조문 또는 확인 방법). 근거 없는 항목은 골든셋에
  넣지 않는다 — `check-schema.ts` 가 기계로 잡는다.
- **정답 복수 허용**: 하나의 쟁점이 본법·시행령·특별법에 걸치므로 `expected_laws` 중 하나라도 상위 K에
  들면 hit. 의도적으로 관대한 채점 — 기준선을 낙관적으로 잡아 이후 개선폭을 과장하지 않기 위함.
- **홀드아웃 봉인**: `split: "holdout"` 15건은 LB2 완료 시점에 1회만 측정. LB1·LB2 튜닝 중 열람·측정
  금지(horizon 프리모템 시나리오 1의 예방 장치). 측정 이력은 `evidence/bench/` 로 검증 가능.
- 도메인 구성: 부동산임대차·노동·계약민사·형사·가족 각 8건. 세무는 회귀 스위트로 별도 유지
  (골든셋에 넣으면 기존 강점이 평균을 끌어올려 비세무 취약이 가려진다).

## Verification

- [x] `npx tsx bench/check-schema.ts` → **PASS** (40건 / dev=25 holdout=15 / 5도메인 각 8 / 조문 라벨 39건)
- [x] **실 API 라벨 검증** `npx tsx bench/verify-labels.ts` → **법령명 14종 전부 실재(exact 매칭),
      조문 39건 전부 실재·본문 도달, 실패 0건**. 조문 제목이 라벨 주장과 일치함을 육안 대조
      (예: 근로기준법 제28조 = "부당해고등의 구제신청", 형법 제21조 = "정당방위").
- [x] **Failure probe** — 결함 3종(`source` 누락 / `expected_laws` 빈 배열 / `split` 오타)을 주입한
      fixture 로 `check-schema.ts` 실행 → 3건 전부 검출·FAIL 반환.

## Out of scope

- 채점 러너(step-2)·기준선 측정(step-3).
- 검색 로직 변경 — LB1 은 측정만 만든다(계획 §범위).
