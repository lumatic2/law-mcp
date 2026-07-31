# M1 — 자료원 지도 확정 + before 기준선 (완료 노트)

> 2026-07-31 · 목표 "세법 완성" 연쇄 1/4 · plan `plans/2026-07-31-m1-자료원지도.md`

## 1. 결과

세무 근거 유형 14행 전부에 처분 판정이 섰다(ADR 0003): 연결됨 8 · 연결 대상 4(조세조약·별표·
신구법·예규 본문 보강) · 공백 2(기본통칙·집행기준 — 공식 API 없음, 국세청 자체 불복). 미확인
8건이 실 API 증거와 함께 소진됐고, 도구 변경 전 before 기준선이 남았다: **에이전트 pass^3 86.0% ·
SR@1 80.6%**(블라인드 3×43건, Sonnet 5, AR2 프로토콜) · **범용 recall@3 84.2%**(dev 57건).

계획을 실측이 4번 뒤집었다: 조세조약 `trty` 개통(147건+전문 JSON) · `lsRlt` 법령 관계 재개봉
(과거 "빈 응답" 판정 오류) · 예규 본문이 기존 판례 폴백과 동일한 NTS 문서 API 로 도달 ·
심판례 미러 신선도 우려 기각(기준일 2026.07.29).

## 2. 이슈와 해결

- **측정 직전 가드 적발 2건 — 하나는 before 를 오염시킬 뻔했다.** `dist-bench` 가 TF4 수리 이전
  빌드(04:56 vs 커밋 15:09)라 `as_of`+법령ID 경로가 옛 버그 그대로였다. 재빌드 후 스모크로 확인.
- **`bench/run.ts` 가 기권 케이스에서 크래시** (58/61 지점, `expected_laws: null` 미가드 — TF1
  코퍼스 통합 때 들어온 값). 기권은 recall 분모 밖(에이전트 하네스 소관)이라 입구 필터로 수리.
  선언된 write 표면(evidence 만) 밖 수정이라 finding 큐에 기록 — 계획 드리프트는 이 1건뿐이고
  확장이 아니라 측정 완주를 막는 결함 수리다.
- **순조로움 의심 재검증**: 블라인드 3 arm 이 전부 `tool_ok:true`·43/43 응답으로 무마찰이었는데,
  스코어러 결과에 전패 4건(tax-04·v2-10·v2-11·v2-29)·불안정 2건이 있어 "다 통과" 류의 검증 부재
  신호는 아니다. run 파일 3건의 case_id 커버리지도 스코어러가 43건 전건 매칭.
- 크기 회고: 선언 changesets>=1 / 실측 디렉터리 1 · step 2 · 커밋 3 — 정합.

## 3. 증거

- `docs/adr/0003-세법-자료원-처분표.md` — 14행 처분표 + 뒤집히는 조건
- `research/2026-07-31-m1-상류프로브.md` — 미확인 8건 실측(응답 원문 포함)
- `evidence/bench/2026-07-31-m1-baseline/` — run1~3.json·report.txt·general-dev.json·SUMMARY.md
- `changesets/20260731-m1-source-map/README.md` — step 1~2 검증 체크
실표면: `node dist-bench/bench/tool-cli.js search "기부금" 1` 및 `article 001586 59 2024` — 실 법제처
  API 왕복 성공(조문 본문 수신, `as_of` 시행판 선택 동작). 블라인드 arm 3개가 같은 CLI 로 43건
  ×3회 실 API 조사를 완주(`tool_ok:true` 전건) — 도구가 실사용 형태로 두드려졌다.
재현: `npx tsx bench/agentic-baseline.ts evidence/bench/2026-07-31-m1-baseline/run{1,2,3}.json` ·
  `npm run bench:golden -- --split dev` · `npm test` 317/317 · `git diff --stat src/` 0줄
평가 못 함: NTS 통칙·집행기준의 검색 actionId 존재 여부 — 비공식 내부 API 역공학이 필요해
  D1 처분 기준(공식 API 만)으로 조사를 중단했다. 공백 판정의 실무 영향은 M4 리허설이 잰다.
