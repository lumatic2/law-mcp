# AR2 step-3 — 에이전트형 기준선

- 일자: 2026-07-23 · milestone: AR2 · 갈래: tooling
- 증거: `evidence/bench/2026-07-23-ar2-baseline.md` (+ `-baseline/` 원자료)

## 결과

정답 케이스 20건 × 블라인드 3회: **`pass^3` 90% · `pass@3` 100% · `SR@1` 80%**
· `AT` 1.16 · 침묵 0% · 기권 정밀도/재현율 **100%/100%**.

**같은 20건 단발 recall@3 75% → 에이전트형 `pass^3` 90%.** 도구 불변, 측정 방식만 교체.

## 변경

- `bench/agentic-report.ts` — 정답률 축에서 기권 케이스 분리(옳은 기권이 pass@k 를 깎던 결함).
  회귀 방어 프로브 ⑥ 추가. 6/6 PASS.
- `bench/agentic-score.ts` — `expect_abstain` 을 채점 결과에 실어 리포터가 분리할 수 있게.
- `bench/agentic-baseline.ts` — 마찰 축을 총 턴 → 검색 횟수로.

## 검증

- `npm test` 314/314 · `tsc` exit 0 · `git diff --stat src/` **0 줄**
- 유출 34건 0 · 봉인 유지(dev 만 사용) · 3회 전부 `tool_ok: true`
