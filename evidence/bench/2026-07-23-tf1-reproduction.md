# TF1 재현 검증 — 통합 전/후 수치 대조

> 2026-07-23 · milestone TF1 step-3 · horizon `trap-free`

## 무엇을 판정하나

골드 4파일을 `bench/corpus.json` 하나로 합쳤다. **합치는 과정에서 아무것도 안 깨졌나**를
통합 전 수치의 재현으로 판정한다. 미달이면 통합 실패로 본다(라벨 규약 적용은 이 시점에
아직 하지 않았다 — 재현 실패와 규약 효과를 같은 수치에 섞지 않기 위해. ADR 0001 참조).

## 수치 대조

| 지표 | 통합 전 (선언) | 통합 후 (실측) | 판정 |
|---|---|---|---|
| 범용 dev `recall@3` | 88.0% | **88.0%** | 일치 |
| 범용 dev `recall@1` | 68.0% | **68.0%** | 일치 |
| 에이전트 dev `pass^3` | 90% | **90%** | 일치 |
| 에이전트 dev `pass@3` | 100% | **100%** | 일치 |
| 에이전트 dev `SR@1` | 80% | **80%** | 일치 |
| 에이전트 dev `AT` | 1.16 | **1.16** | 일치 |
| 기권 정밀도/재현율 | 100% / 100% | **100% / 100%** | 일치 |
| 흔들리는 케이스 | d05(1/3)·d09(2/3) | **d05(1/3)·d09(2/3)** | 일치 |

## 어떻게 냈나

```bash
# 범용 — 코퍼스는 옛 세트들의 합집합이라 --provenance 로 표본을 통합 전과 같게 좁힌다
npm run bench:golden -- --set corpus --split dev --provenance golden-v2.json --label tf1-repro-v2
#   → evidence/bench/2026-07-23-tf1-repro-v2.json

# 에이전트 — 에이전트를 다시 돌리지 않고 AR2 기준선의 저장된 실행 로그를 결정적 채점기로 재채점한다
npx tsx bench/agentic-baseline.ts \
  evidence/bench/2026-07-23-ar2-baseline/run{1,2,3}.json
```

**에이전트 쪽을 재실행하지 않은 이유**: 채점기에 LLM 호출이 0개라 같은 로그는 항상 같은 점수를
낸다(AR1 DoD). 그래서 "로더를 코퍼스로 갈아끼운 뒤 같은 로그가 같은 점수를 내는가"가 통합
충실도를 그대로 판정한다 — 오히려 에이전트를 다시 돌리면 실행 분산이 섞여 판정이 흐려진다.

구 `case_id`(`d01`)와 통합 후 id(`ag-d01`)를 잇기 위해 채점기에 접두어를 뗀 옛 id 색인을
추가했다(모호하면 색인하지 않는다). 통합 *전에* 기록된 로그를 다시 채점할 수 있어야 재현
검증 자체가 성립한다.

## 부수 확인

- `npx tsx bench/check-schema.ts bench/corpus.json` exit 0 — 124 레코드 / 92 topic.
- `npx tsx bench/agentic-set.ts --selftest` 6/6 — dev 24건·holdout 10건으로 통합 전과 동수.
- 홀드아웃 봉인 유지: `bench/run.ts --split holdout` 이 플래그 없이 여전히 throw.
- `npm test` **314/314** · `git diff --stat src/` **0줄**.
- 구 4파일은 `archive/bench/` 로 이동. 계약 테스트 2종(`golden-v2`·`golden-tax`)은 그 동결본을
  계속 지킨다 — 코퍼스가 흡수한 판이므로 여기가 깨지면 흡수한 내용도 틀린 것이다.

## 판정

**통합 성공.** 8개 지표 전부 일치했고 흔들리는 케이스 목록까지 같다.
