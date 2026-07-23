# 20260723-tf4-asof

## Target

- Goal: `search_law` 가 준 `law_id` 를 `as_of` 조회에 그대로 넘길 수 있게 한다.
- ROADMAP milestone: TF4 (horizon `trap-free`)

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/providers/lawgo-provider.ts` | 법령ID 를 이름 자리에 넘겨 체인이 끊김 | `resolveLawName` 으로 이름 해석 후 시점 조회 |
| `test/as-of-surface.test.ts` | 배선이 되돌아가는 것을 막을 수단 없음 | 회귀 계약 3종 |
| `src/asof-chain-smoke.ts` | 체인을 실 표면에서 관측할 수단 없음 | search→as_of 왕복 |

되돌리기: 해석 경로 1개 + 테스트. 데이터 잔재 없음. 단 배포 사본도 같이 되돌린다.

## step-1 — 법령ID 입력 경로 수리

- Evidence Contract — Scenario: `get_law_article(law_id, article_no, {as_of})` 가 과거 시행판을
  준다. Failure probe: 해석 불가 시점에 현행으로 대체하지 않는지 확인.
- Verification
  - [x] `get_law_article('001586','제1조',{as_of:'2024'})` → 시행일 20240401
  - [x] 법령명 경로 회귀 없음 (`소득세법` + `as_of:'2023'` → 20230701)
  - [x] `as_of:'1800'` → 현행 대체 없이 거절
  - [x] 회귀 계약 3종 추가 · `npm test` 317/317
- Result: 이름을 추측하지 않고 상류 본문 조회로 받아 온다. 이름을 못 받으면 시점 경로로
  들어가지 않는다(ID 가 다시 이름 자리에 들어가는 것을 막는다).

## step-2 — 실 MCP 표면 체인 관측

- Verification
  - [x] `search_law` → `law_id` → `get_law_article(as_of)` 가 사람 손 없이 이어짐
  - [x] `as_of_rule` 이 응답에 실림
  - [x] **실패 검증**: 2020(627자) / 2024(707자) / 현행(702자) — 셋 다 내용이 다르다
  - [x] 배포 사본 `git pull && npm run build` — dist 에 `resolveLawName`·`asOfLawName` 반영 확인
  - [x] **재시작 부채 명시**
- Result: `evidence/2026-07-23-tf4-asof-chain-e2e.md`

## Result

- Status: done (step 2/2)
- Evidence: `evidence/2026-07-23-tf4-asof-chain-e2e.md`
