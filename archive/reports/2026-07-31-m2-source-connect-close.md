# M2 — 자료원 연결 (완료 노트)

> 2026-07-31 · 목표 "세법 완성" 연쇄 2/4 · plan `plans/2026-07-31-m2-자료원연결.md`

## 1. 결과

처분표 ADR 0003 의 "연결 대상" 4행이 전부 닫혔다: **조세조약 `trty`**(검색 106건 + 전문 JSON,
statute 등급 + 국내법 우선 적용 안내), **신구법 비교 `oldAndNew`**(어댑터에 `listSections` 신설 —
신/구 조문 147행 대조 수신), **별표·서식 `licbyl`**(세율표 메타+PDF 링크, 전문은 사유 있는 거절),
**예규 본문**(원문링크를 `source_id` 로 받아 NTS 문서 API 로 전문 11,271자 — 판례 폴백과 동일 API
재사용). source enum 19→22, 도구 개수 11 불변. "공백" 2행(기본통칙·집행기준)은 M1 처분대로
구현 없이 확정 — 실무 영향은 M4 리허설이 잰다.

## 2. 이슈와 해결

- **`OldAndNewService` 는 평평한 필드가 없다** — 기존 fields/articlesPath 로는 상세가 통째로
  NOT_FOUND 로 새는 구조. `{no, content}` 행 목록을 문자열 배열로 펴는 `listSections` 를 어댑터에
  추가해 해소(단건 조문 객체도 배열로 정규화).
- **authority-grade 가드 테스트가 statute 확장을 적발** — 의도된 동작. trty(헌법 §6①)·licbyl
  (법령의 일부) 근거를 주석으로 남기고 허용 목록 갱신.
- **예규 일련번호→NTS 문서 ID 매핑은 upstream 에 없다** — 일련번호로 전문 요청 시 원문링크를
  넘기라는 안내로 거절하고, 12자리 미만 숫자는 ntstDcmId 로 오인하지 않게 차단(무관 문서 방지).
- 다자조약 전문 컨테이너는 미확인으로 남음(세무 질의 20행 전원 양자조약) — descriptor 주석에 기록.
- 크기 회고: 선언 changesets>=2 / 실측 디렉터리 1(step 3개 합본)·커밋 2 — 기록-합본 규약(OI5)상
  정합이나 Scale 선언과 어긋남 한 줄 적발.

## 3. 증거

- `evidence/2026-07-31-m2-sources-e2e.md` — 실 MCP 체인 관측 원문 + Verify 대조표
- `changesets/20260731-m2-source-connect/README.md` — step 1~3 검증 체크
- `test/m2-statute-annex.test.ts` · `test/m2-expc-fulltext.test.ts` — 실 응답 fixture 계약
실표면: `npm run build && npx tsx src/m2-sources-smoke.ts` — 실제 MCP 클라이언트(stdio, dist/index.js)
  에서 trty 검색→전문(980자, "체약국" assertion) · oldAndNew 신/구 147행 · licbyl PDF 링크+사유 거절 ·
  ntsExpc 검색→원문링크→본문 11,271자 체인이 전부 assertion 통과로 성공.
재현: `npx tsx src/m2-sources-smoke.ts` · `npm test` 328/328 · 배포 사본
  `git pull && npm run build` 후 dist 에 STATUTE_ANNEX/extractNtstDcmId 반영 grep 확인
평가 못 함: 다자조약 전문 컨테이너(양자 표본만 존재) — 다자 요청 시 NOT_FOUND 가능성을
  descriptor 주석과 이 노트에 남긴다.
⚠ 재시작 부채: **사용자가 MCP 서버를 재시작해야** 실 세션 도구에 신규 source 3종과 예규 본문
  경로가 나타난다. M4 측정 전 필수.
