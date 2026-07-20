# UD1 step-2 — 반복 측정 신뢰구간 + 홀드아웃 봉인의 코드화

- 일자: 2026-07-21 · milestone: UD1 · plan: `plans/2026-07-21-ud1-measurement-rebuild.md`

## 이 step 이 고치는 두 가지 결함

둘 다 **규약이 문서에만 있었던** 문제다.

| 결함 | 증상 | 이번 처방 |
|---|---|---|
| 노이즈 미정량(F3) | 같은 코드로 공식 러너를 두 번 돌려 **72.0% / 76.0%** 가 나왔다(LB5). 4%p 이하 차이를 판정할 수단이 없었다 | `--repeat n` — 평균·표본표준편차·범위·**2σ 채택 문턱** 출력 |
| 홀드아웃 소진 | 규약이 `bench/README.md` 에만 있어 LB2·LB5 에서 두 번 열려 세트가 죽었다 | `--split holdout` 을 **코드가 거부**한다 |

## 산출물

`bench/run.ts` — `--set <이름>` · `--repeat <n>` · `--i-am-closing-the-horizon`
`bench/scoring.ts` — `aggregateRepeats(values): RepeatStats`

```
=== 반복 측정 (recall@3, n=5) ===
  평균     74.4%
  표준편차 2.2%p
  범위     72.0% ~ 76.0%
  채택 문턱(2σ) 4.4%p — 이보다 작은 차이는 노이즈와 구분되지 않는다
```

**설계 판단 2가지:**

1. **n=1 이면 표준편차를 `0` 이 아니라 `null` 로 낸다.** 0 은 "흔들리지 않았다"는 거짓 주장이다.
   판정 불가를 판정 불가라고 말해야 한다. 문턱도 함께 `null` 이 된다.
2. **표본표준편차(n−1)** 를 쓴다 — 우리는 모집단이 아니라 실행 표본을 잰다.

봉인 메시지는 사람에게 무엇을 하라고 말한다:

```
홀드아웃은 봉인돼 있다 — horizon close 시 1회만 연다.
  정말 닫는 시점이면 --i-am-closing-the-horizon 을 붙여라.
  튜닝·A/B 중이라면 --split dev 를 써라(홀드아웃을 열면 그 세트는 죽는다).
```

## Verification

- [x] `npx tsx --test test/bench-runner.test.ts` — **7/7**
- [x] **Failure probe (봉인)**: `--split holdout` 을 플래그 없이 실행 → 실제로 **거부**됨을 관측.
      플래그를 붙이면 15건이 열림. 봉인이 문서가 아니라 코드임을 확인.
- [x] **Failure probe (n=1)**: 1회 측정에서 σ 가 `0` 이 아니라 `n/a` 로 나오는지 테스트로 고정
- [x] `npx tsc --noEmit` 통과 · `--set golden-v2 --dry-run` 정상(dev 25 / 도메인 5×5)

## Contract

- source of truth: `bench/run.ts`·`bench/scoring.ts`
- deploy target: **해당 없음** — 벤치 도구, 제품 코드 불변
- compatibility: 기존 호출(`--split dev`, `--mode assisted`)은 그대로 동작. `--set` 기본값이
  `golden` 이라 구 세트 재현도 깨지지 않는다.
- out of scope: 기준선 측정(step-3) · 검색 로직

## 부수 수리

`main()` 을 직접 실행 시에만 부르도록 가드했다 — 테스트가 `assertHoldoutSeal` 을 import 하면
러너가 통째로 돌아 실 API 를 때리는 문제가 있었다.
