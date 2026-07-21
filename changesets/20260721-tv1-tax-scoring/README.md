# TV1 step-2 — 세법 채점축 (유형 분해 · 시점 정확도 자리)

- 일자: 2026-07-21 · horizon: `tax-vertical` · milestone: TV1
- plan: `plans/2026-07-21-tv1-tax-eval-set.md` step-2

## 무엇이 달라지나

세법 세트는 `domain` 이 전부 "세법"이라 기존 `by_domain` 분해가 **한 칸으로 뭉개진다.**
어느 유형이 약한지가 TV2~TV5 의 우선순위 근거이므로 유형 축을 따로 뒀다.

```
  도메인별 recall@3: 세법=xx%          ← 이것만으로는 아무것도 못 고른다
    비과세           n= 4  recall@3  xx%  조문정확도 xx%   ← 새 축
    신고·불복·기한    n= 7  recall@3  xx%  조문정확도 xx%
    ...
  시점 정확도     n/a (TV3 미도입)                        ← 새 축(자리)
```

## 핵심 규율 — 켜지지 않은 축은 0 이 아니라 null 이다

`as_of_accuracy` 를 0% 로 내면 **"시점을 전부 틀렸다"는 거짓 주장**이 되고, 그 상태로 기준선을
찍으면 TV3 의 개선폭이 부풀려진다. 측정 항목이 0 건이면 `null`(n/a)로 낸다. 같은 규율을
유형별 조문 정확도에도 적용했다(조문을 하나도 확인하지 않은 유형은 `null`).

이 규율은 새로 만든 게 아니라 UD1 의 선례를 따른 것이다 — `aggregateRepeats` 가 n=1 일 때
표준편차를 0 이 아니라 null 로 내는 것과 같은 이유다.

## 만들지 않은 것

- **홀드아웃 봉인 기계** — `assertHoldoutSeal` 은 `split` 기준이라 `golden-tax` 에도 **이미
  적용된다.** 세트별 봉인을 새로 만들지 않았다(plan 결정 로그: 봉인 기계 재사용).
- **`--set` 지원** — 러너에 이미 있었다(UD1).

## 검증

- `npm test` **197/197** (신규 7건 — 유형별 recall/조문정확도, 구 세트에서 유형 축 비활성,
  조문 확인 항목만 분모, 미확인 유형 null, **시점 축 null 고정**, TV3 이후 비율 산출,
  가지번호 비교)
- `npx tsc --noEmit` 통과
- **실패 프로브(봉인이 실제로 도는가)**:
  ```
  $ npx tsx bench/run.ts --set golden-tax --split holdout --dry-run
  EXIT=1
  Error: 홀드아웃은 봉인돼 있다 — horizon close 시 1회만 연다.
  ```
  선언만 있고 안 도는 상태가 아님을 관측했다.
- `git diff --stat src/` = **0 줄** (측정 대상 불변 — plan 범위 계약)

## 남는 것

- `asOfChecked`/`asOfCorrect` 는 **아무도 켜지 않는다.** TV3 step-4 가 켠다.
  그 전까지 `as_of_accuracy` 는 항상 null 이어야 하고, 테스트가 이를 고정한다.
