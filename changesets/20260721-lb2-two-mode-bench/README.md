# 20260721-lb2-two-mode-bench

## Target

- Goal: LB2(승계 plan) step-1 — 벤치를 blind/assisted 2모드로 확장하고 dev 재측정.
- ROADMAP milestone: LB2 (active) — `plans/2026-07-21-lb2-consumer-mode-and-citation.md`

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `bench/run.ts` | `--mode blind\|assisted` + assisted 채점 경로 | 표준 소비 패턴(법령명 주어짐)을 측정 |
| `bench/scoring.ts` | `summarizeAssisted` + outcome 필드 확장 | 조문 도달 지표를 recall 과 분리 집계 |
| `test/bench-scoring.test.ts` | assisted 요약 테스트 2건 | 0-나눗셈·분류 회귀 방지 |
| `evidence/bench/2026-07-21-dev-assisted.json`·`2026-07-21-two-mode.md` | 측정 원본·해석 | LB2 방향 판정 근거 |

## Contract

- **두 지표를 합산하지 않는다**: blind=법령 찾기(recall), assisted=조문 도달(accuracy). 섞으면
  "법령 찾기 성능"으로 오독된다. 요약 출력에도 경고 문구를 박았다.
- **assisted 는 순환 논리가 아니다**: 정답 법령을 입력으로 주는 것은 소비자 LLM 의 역할을 대신하는
  것이고, 측정 대상은 그 이후 도구의 조문 도달 능력이다.
- `--mode` 기본값은 `blind` — 기존 기준선(44.0%)과 재현 비교 가능성을 유지한다.
- 구 plan step-2 에서 기각된 `src/article-match.ts` 를 여기서 **용도를 바꿔 재사용**한다
  (기각된 것은 "법령 재정렬" 용도이지 점수 함수 자체가 아니다 — 승계 plan F3).

## Verification

- [x] `npm test` → **45/45 pass** (신규 2건), `tsc --noEmit` 클린
- [x] 실 API assisted 측정 dev 25건 완주 — **accuracy@1 50.0% / @3 58.3%** (측정 24 / 대상 아님 1 / 에러 0)
- [x] **Failure probe** — `expected_article` 없는 항목이 `SKIP`("조문 라벨 없음")으로 분류되고 에러와
      구분됨(실측 1건). 측정 대상 0건일 때 accuracy 가 NaN 이 아니라 0 (테스트로 고정)

## 판정 (다음 step 입력)

**법령을 줘도 절반은 틀린다** → 병목은 후보 생성 *하나*가 아니라 **후보 생성 + 조문 랭킹 둘 다**.
C안(큐레이션 색인)의 기대이득 상한이 이 수치에 묶인다.

실패 패턴에서 원인 2종 확인:
1. `scoreArticles` 가 **조문 제목을 버린다** — 제307조 제목이 "명예훼손"인데 반영 안 됨(→ finding F4)
2. 구어↔법문 용어 갭 — "숙려기간"이 법문에 없음(→ finding F1, 선행 사례의 약칭 사전 영역)

상세 → `evidence/bench/2026-07-21-two-mode.md`
