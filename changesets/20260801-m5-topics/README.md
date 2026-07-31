# changeset 20260801-m5-topics — M5 · 주제 목록 + 규약 개정 + 스키마 배선

계획: `plans/2026-08-01-m5-주제목록과봉인규약.md` · 목표: 코퍼스를 세법 전반으로(M5→M6→M7)

## step-1 — 승인 규칙 외부화 + 결정적 추출기 + 60 주제

- `bench/expansion/rules.approved.json` — 승인된 추출 규칙 v2 의 정본. 추출기는 이 파일만 읽는다
  (키워드·할당량·간격·봉인 회전식을 코드에 심으면 승인된 규칙이 아니라 에이전트 취향이 된다).
- `bench/expand-topics.ts` — 결정적 추출기. 법령명 완전일치만 채택하고 불일치 시 폴백 없이 중단
  (부분일치 폴백은 "지방세법"을 지방교부세법으로 바꾸는 조용한 오답을 만든다 — 프로브 실측).
- 산출: `bench/expansion/topics-2026-08-01.json`(60건 · rules_digest·list_digest·MST 포함) ·
  `bench/expansion/selection-log.md`(법별 MST·조회일·조문수·매칭수·중복 대체·봉인 분포).

검증: 12법 각 5건 = 60(dev 40 / sealed 20) · 기존 코퍼스 주제 중복 0 · 가지번호 조문 15건이
`51-4` 식으로 구분 · 동일 규칙+동일 MST 2회 실행 diff 0 · 봉인 위치 i=1..5 분포 4/3/5/5/3.

Failure probe: ① 규칙 파일의 `title_keywords` 를 1개로 줄이자 digest 와 산출이 바뀌고 폴백이
9법 35건에서 발동 — 규칙이 실제로 외부화됐고 폴백 경로가 산다 ② 법령명 `"지방세"`(완전일치 불가)로
돌리면 exit 1 로 중단.
