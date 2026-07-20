# 20260721-lb2-title-weight-and-holdout

## Target

- Goal: LB2 step-3(C안 판정) + emergent leaf F4(조문 제목 가중) + step-4(홀드아웃 봉인 해제).
- ROADMAP milestone: LB2 — `plans/2026-07-21-lb2-consumer-mode-and-citation.md`

## step-3 — C안 판정: **조건부, 지금은 착수 안 함**

법령이 확정된 뒤에도 조문 도달이 accuracy@3 58.3% 였다. C안(큐레이션 색인)은 "정답 법령이 후보에
없다"만 푸는데, ②단계에서 이미 41.7% 를 잃으므로 **C안을 완벽히 해도 상한이 그 언저리**다.
착수 조건(둘 다 충족 시 사용자 결정에 올림): ① 조문 도달 개선 후 assisted accuracy@3 ≥80%
② 그 상태에서 blind recall@3 < 70%. → `evidence/bench/2026-07-21-curation-verdict.md`

## F4 — 조문 제목 가중 (emergent leaf, 판정 근거에서 도출)

`scoreArticles` 가 `article.title` 을 버리고 있었다. 제목은 곧 쟁점명인 경우가 많다
(제307조 "명예훼손", 제839조의2 "재산분할청구권"). 제목 매칭에 ×3 가중.

**1차 시도는 수치를 떨어뜨렸다** (@1 50.0% → 45.8%). 항목별 diff 로 원인 특정:
- `연장근로` 가 제목 `연장 근로의 제한` 과 **띄어쓰기 때문에** 안 맞고, 대신 "시간" 같은 범용
  토큰이 제목에서 3배 가중돼 엉뚱한 조문을 올렸다.
→ 제목 비교 시 공백 제거(정당한 버그 수정). 재측정 결과 채택:

| | 기존 | F4(1차) | F4(공백 교정) |
|---|---|---|---|
| assisted accuracy@1 | 50.0% | 45.8% ✗ | **50.0%** |
| assisted accuracy@3 | 58.3% | 58.3% | **62.5%** ✅ |

@1 무손실 + @3 +4.2pp 이므로 채택. 더 이상 튜닝하지 않는다(dev 과적합 방지).

## step-4 — 홀드아웃 봉인 해제 (2모드 각 1회)

| split | blind recall@3 | blind recall@1 | assisted acc@1 | assisted acc@3 |
|---|---|---|---|---|
| dev (25) | 44.0% | 40.0% | 50.0% | 62.5% |
| **holdout (15)** | **60.0%** | 46.7% | **66.7%** | **73.3%** |

**과적합 없음** — 홀드아웃이 오히려 높다. 단 이는 두 split 의 난이도가 같지 않다는 뜻이기도 하므로
**split 간 수치를 개선 근거로 비교하지 않는다**(각 split 이 자기 기준선).

## Verification

- [x] `npm test` → **56/56 pass**, `tsc --noEmit` 클린, `npm run build` 성공
- [x] 실 API: dev 재측정 2회 + 홀드아웃 2모드 각 1회 완주, 에러 0
- [x] **Failure probe** — F4 1차 시도의 수치 하락을 항목별 diff 로 확인하고 원인(띄어쓰기·범용 토큰)을
      특정한 뒤에만 수정했다. 수치가 나빠졌을 때 그대로 채택하지 않는 경로가 실제로 작동함.
- [x] 홀드아웃 측정 이력이 `evidence/bench/` 에 2건(blind·assisted)만 존재 — 조기 측정 없었음

## Out of scope

- C안 구현(사용자 결정 대기) · 약칭 사전 확장(F1) · 캐시 TTL(F2).
