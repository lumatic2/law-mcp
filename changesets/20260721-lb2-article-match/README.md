# 20260721-lb2-article-match

## Target

- Goal: LB2 step-2 — 조문 매칭 점수 구현 + **가정 검증**. 판정: **기각(재정렬 미채택)**.
- ROADMAP milestone: LB2 (active) — `plans/2026-07-20-lb2-article-level-reach.md`

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/article-match.ts` (신규) | 조문 매칭 점수 + 재정렬 함수 | 점수 로직 자체는 검증됨(미적용 보관) |
| `test/article-match.test.ts` (신규) | 토큰화·제곱가중·0점 보존 테스트 6건 | 회귀 방지 |
| `bench/article-rerank-probe.ts` (신규) | 가정 검증 실험 스크립트 | 채택/기각 판정 재현 가능 |
| `evidence/bench/2026-07-21-article-match-probe.md` (신규) | 판정 근거 | 기각 사유 보존 |

## 판정: 기각 — 계획 hard-stop 발동

| 지표 | before | after |
|---|---|---|
| recall@3 | 44.0% | **44.0%** (변화 없음) |
| recall@1 | 40.0% | **36.0%** (하락) |
| 지연 median | — | **3811ms** (예산 ≤3000ms 초과) |

계획의 hard-stop("step-2 에서 개선 없음 → 기각 기록 후 정지")과 비용 예산 조항 양쪽에 걸렸다.
억지 튜닝 대신 정지한다.

## 근본 원인: 병목은 재정렬이 아니라 후보 생성

재정렬은 후보 *안에서* 순서만 바꾼다. 정답 법령이 후보에 아예 없다 — "상속 한정승인" 후보는
건축법/가사소송법/가사소송규칙, "공소시효" 후보는 공탁법/관세법/공탁규칙으로 민법·형사소송법이
없다. recall@1 하락은 조문 점수가 오답 법령을 1위로 올리기도 한다는 뜻(큰 법령의 무관한 조문에
토큰이 흩어져 걸림).

상세 근거·다음 후보 3안 → `evidence/bench/2026-07-21-article-match-probe.md`

## Verification

- [x] `npm test` → **43/43 pass** (신규 6건 포함)
- [x] 실 API 가정 검증 25건 완주 — 위 수치
- [x] **Failure probe** — 점수가 전부 0일 때 `rerankByArticleScore` 가 원 순서를 보존(테스트로 고정).
      ib3 에서 신호 없이 순서를 흔들었다가 법인세법이 1위→5위로 밀린 실패의 재발 방지 장치.

## 상태

`src/article-match.ts` 는 **어디에도 연결되지 않은 채 보관**한다(도구 표면·검색 경로 무변경).
후보 생성 문제가 풀리면 그 위에 다시 얹을 수 있다.
