# 20260801-m8-item-repair — 확장 문항 결함 수리 + 도구 실력 재측정

목표 `query-to-article-mapping` 의 첫 milestone. M7 확장 기준선 75.0% 가 문항 결함에 오염돼 있어
다음 단계(의미 검색 상한 계산)의 분모로 쓸 수 없었다. 질문 텍스트만 고쳐 재측정했다.

## step-1 — 문항 결함 수리 (질문 텍스트 한정) · `7501458`

- `bench/corpus.json`·`bench/expansion/items-2026-08-01.json` 의 `context`·`query` 8건 교체
  (exp-10·21·22·23·27·49·52·55). 정답 라벨·주제·`split` 불변.
- `bench/expansion/item-repair-2026-08-01.md` 신설 — 건별 before/after·사유·**좁히기 근거 조문 인용**·
  D7 금지어 목록·전수 스캔 결과·가드 사정거리 양방향 실측표.
- 좁히기 단서는 조문 본문이 스스로 정하는 요건에서만 뽑았다(M7 오답 회피용 작문 금지 = D6).
- 전수 스캔(dev 40건 × 3유형) 추가 발견 0건. 중단점(+5건 초과) 미발동.
- 첫 적용에서 직렬화 형식이 원본과 달라 corpus 전체 3,463줄이 바뀌어 되돌리고 원본 indent
  (corpus 1 · items 2)를 보존해 재적용 — 실제 변경 34줄.

## step-2 — 수리 후 블라인드 재측정 ×3 + 전/후 비교 · `ef69352`

- `evidence/bench/2026-08-01-m8-repaired/` — tasks(40건, 봉인 유입 0) · BRIEF · run1~3 · report · SUMMARY.
- `pass^3` 75.0%→90.0% · pass@3 90%→100% · SR@1 61.7%→67.5% · AT 1.28→1.35.
- 노이즈 분리: 미수리 32건 중 4건 변동 → 수리 +20%p / 회차 −5%p. 변동률 12.5%.
- 남은 미달 4건 원인 분류가 M9 step-1 의 입력이다.

## 검증

`npm test` 356/356 · `git diff --stat src/` 0줄 · 검사 4종 + D7 PASS · 라벨 diff 0 ·
미수리 176 레코드 해시 불변 · 고정 43건 재현 유지 · 봉인 20건 미개봉.

## 배포 영향

없음 — 평가 하네스·데이터만. `src/` 무변경이므로 `~/projects/custom-mcps/law-mcp` 동기화·MCP
재시작 불요.
