# TV5 step-2 — 회귀·판정

- 일자: 2026-07-22 · horizon: `tax-vertical` · milestone: TV5
- plan: `plans/2026-07-22-tv5-article-body-loss.md` step-2
- 판정서: `evidence/bench/2026-07-22-tv5-verdict.md`

## 판정: **채택**

| 항목 | 결과 |
|---|---|
| 세율표 도달 | ✅ `소득세법 제55조` 본문 251자 → **1596자** |
| `golden-v2` dev | **88.0%** (기준선 그대로) |
| `golden-tax` dev | **83.3%** (기준선 그대로) |
| `npm test` | **302/302** |
| 순수 추가 지연 | **+263ms** (전체 5.2s 중 3.3s 는 기존 위임조문 조회) |

## 시점 축과 함께 작동한다

`as_of=2022` → `effective_date=20220701` + **그 시점 판의 세율표**. horizon 이 노린 인용 체인
(조문 + 시행일자 + 숫자)이 한 응답에서 성립한다.

## 되돌림

추출은 `readContent` 한 곳, 조회 경로는 `fetchArticleRootCached` 한 곳 — 되돌리면 TV7 상태로 복귀.

## ⚠ 사용자 조치

**MCP 재시작 필요** — 응답 내용이 바뀐다(도구 개수·인자는 불변). TV2·TV3 부채와 함께.
