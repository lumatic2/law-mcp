# bench — 정답 도달 측정 하네스

`law-mcp` 검색 품질을 수치로 재는 골든셋과 러너. milestone LB1 산출물
(`plans/2026-07-20-lb1-answer-reach-harness.md`).

## 왜 있나

이전까지 검색 품질은 인상으로만 이야기됐다. 2026-07-20 리서치에서 비세무 13쿼리의 **정답 법령
상위 3 포함률이 31%** 로 측정되며(hit율 92%는 착시였다) 개선을 주장하려면 먼저 재야 한다는 게
분명해졌다. → `research/2026-07-20-general-legal-coverage-probe.md`

## golden.json 스키마

```jsonc
{
  "query": "부당해고 구제신청 기간",     // 사용자가 던지는 자연어 그대로
  "domain": "노동",                      // 부동산임대차 | 노동 | 계약민사 | 형사 | 가족 | 세무
  "expected_laws": ["근로기준법", "노동위원회법"],  // 정답 법령(하나라도 상위 K에 들면 hit)
  "expected_article": "근로기준법 제28조",          // (선택) 조문 라벨 — LB2 조문 축 채점용
  "split": "dev",                        // dev | holdout
  "source": "근로기준법 제28조 제2항 — 실 API get_law_article 로 조문 본문 확인(2026-07-20)"
}
```

**`source` 는 필수다.** 정답 라벨은 추정으로 적지 않는다 — 법령 원문·조문으로 확인한 근거 또는
확인 방법을 남긴다. 근거를 못 붙이는 항목은 골든셋에 넣지 않는다.

`expected_laws` 는 **복수 허용**이다. 하나의 쟁점이 본법·시행령·특별법에 걸치는 경우가 흔하므로,
그 중 하나라도 상위 K에 들면 정답으로 본다(관대한 채점 — 기준선을 낙관적으로 잡아 개선폭을
과장하지 않기 위해 의도적으로 관대하게 둔다).

## 홀드아웃 규칙 (⚠ 이 파일의 핵심 규약)

- `split: "holdout"` 항목은 **LB2 완료 시점에 단 한 번만** 측정한다.
- LB1·LB2 작업 중 홀드아웃 항목의 **열람·측정·튜닝 참조를 금지**한다.
- 이유: 골든셋을 보며 랭킹을 튜닝하면 수치는 오르고 실제 사용자 쿼리는 그대로인 과적합이
  발생한다(horizon 프리모템 시나리오 1).
- 측정 이력은 `evidence/bench/` 에 남으므로, 홀드아웃이 조기 측정됐는지는 그 폴더로 검증된다.

## 실행

```bash
npm run bench:golden -- --split dev            # 개발셋 측정 (실 API)
npm run bench:golden -- --split dev --dry-run  # API 호출 없이 항목 수·구성만 출력
npm run bench:golden -- --split holdout        # LB2 완료 시점 1회만
```

결과는 `evidence/bench/<date>-<label>.json` 으로 저장한다.

## 지표

| 지표 | 정의 |
|---|---|
| **recall@3** (1차) | 정답 법령 중 하나라도 `search_law` 상위 3에 포함된 쿼리 비율 |
| recall@1 | 상위 1에 포함된 비율 |
| article accuracy | `expected_article` 이 있는 항목에서 정확한 조문 번호 도달 비율 (LB2부터) |
| tool hit rate | 도구별 0건 아님 비율 — **품질 지표가 아니다**(31% vs 92% 착시의 원인) |
