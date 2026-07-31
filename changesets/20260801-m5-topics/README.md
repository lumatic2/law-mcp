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

## step-2 — ADR 0004 + 가드 digest 예외 경로

- `docs/adr/0004-주제-출처-규칙승인-개정.md` — ADR 0002 §2 를 **폐기하지 않고 출처 계층을 추가**
  ("사람이 승인한 결정적 규칙"을 사람과 동급 출처로). 봉인 누출 경로 3개와 각각의 방어 수준
  (장치 / 규율 / 표식)을 표로 명시하고, 규칙 설계가 에이전트 손에 있다는 **잔여 위험을 드러낸다**.
- `bench/check-no-new-topics.ts` — 예외 ②(승인 목록) 추가. 인정 조건은 파일의 유무가 아니라
  **digest 일치**다: `rules_digest`(규칙 파일 해시)와 `list_digest`(주제 목록 해시)를 재계산해
  하나라도 어긋나면 그 목록의 주제를 **하나도** 인정하지 않는다.
- `test/m5-topic-source-guard.test.ts` — 3방향 + 2건.

검증: 테스트 5건 통과(digest 일치 인정 / 목록 손수 편집 → `list_digest` 거절 / 규칙 변경 →
`rules_digest` 거절 / 목록 없으면 예외 미적용 / 실물 60종 인정) · `npm test` 342건 전건.

Failure probe: 실물 `topics-2026-08-01.json` 에 `관세법 제1조` 를 손으로 추가하니 가드가 exit 1 로
차단했고, 원복 후 PASS 로 돌아왔다 — 예외 경로가 "무조건 통과"로 변질되지 않았다.

## step-3 — 스키마·러너 배선 (데이터 착륙 전)

신규 데이터가 들어오기 **전에** 받을 자리를 만든다. 순서를 바꾸면 M6 통합이 전건 FAIL 한다.

- `bench/check-schema.ts` — `VALID_SPLITS` 에 `sealed` 추가. 오류 메시지가 어휘 목록을 문자열로
  박아 두어 낡던 것을 동적 생성으로 고쳤다(`dev|holdout` 이라고 말하면서 sealed 를 받는 상태였다).
- `bench/run.ts` `assertHoldoutSeal` — `sealed` 를 `holdout` 과 **같은 무게로** 거절. 어휘가 새로
  생겼는데 봉인 검사가 옛 어휘만 보면 새 봉인은 태어날 때부터 열려 있다.
- `bench/run.ts` `--cases <file>` · `loadAgenticSet(..., {caseIds})` — 고정 비교 세트 재현 수단.
  기존 43건이 `golden-v2.json` 21 + `golden-tax.json` 22 로 **두 provenance 에 걸쳐** 있어
  단일값 `--provenance` 로는 과거 표본을 재현할 수 없었다. 목록의 case_id 가 빠지면 실패한다.

검증: `--cases tasks.json` 이 정확히 43건 선택 · `--cases` 없이는 기존 동작 그대로(dev 57건 =
M4 범용축 분모) · 테스트 6건 · `npm test` 348건 · 코퍼스 검사 3종 PASS · `git diff --stat src/` 0줄.

Failure probe: ① `--cases` 에 없는 case_id 를 섞으면 exit 1(분모가 몰래 줄어드는 것을 막는다)
② `split: sealed` 레코드는 스키마 통과하고, `split: bogus` 는 여전히 거절.
