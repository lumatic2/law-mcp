# M5 · 주제 목록 확정 + 규약 개정 + 스키마 배선 — 완료 노트

## 1. 결과

- 12개 세법(국세 10 + 지방세 2)에서 **60 주제 확정** — dev 40 / sealed 20. 주제는 사용자가 승인한
  결정적 규칙이 정했고, 규칙은 `bench/expansion/rules.approved.json` 이 정본이라 추출기가 그 파일만
  읽는다(코드에 심으면 승인된 규칙이 아니라 에이전트 취향이다).
- **ADR 0004** 로 ADR 0002 §2 를 폐기 없이 개정 — "사람이 승인한 결정적 규칙"을 사람과 동급 출처로
  추가하고, 가드는 삭제하지 않았다. 예외 인정은 파일 유무가 아니라 **digest 일치**라서, 목록에
  손으로 한 줄 추가하면 차단된다.
- 신규 데이터가 착륙할 자리를 미리 깔았다 — `sealed` split 어휘, 봉인 검사 확장(sealed 를 holdout
  과 같은 무게로 거절), 고정 비교 세트 재현 플래그 `--cases`.

## 2. 이슈와 해결

- **fresh 검증자(Opus)가 치명 5건**을 승인 전에 잡아 계획을 고쳤다. 그대로 실행하면 깨졌을
  것들이다: `sealed` 가 스키마 어휘에 없어 신규 60건 전건 FAIL / 고정 43건이 두 provenance 에
  걸쳐 있어 `--provenance` 로 재현 불가 / 1회 측정으로 `pass^3` 판정 불가 / 봉인 장치를 M5 에
  두면 ADR 0002 §4 "놀고 있는 장치" 위반(→ M6 이전) / sealed 를 뒤쪽 고정 배정하면 벌칙·보칙 편향.
- **프로브로 규칙 3곳을 고쳤다**: 장 제목 기반 보완은 실행 불가(조세범 처벌법에 편·장 구조가
  없어 `조문여부=="전문"` 행이 0건) → 표제 보유 조문 전체 균등간격 폴백으로 교체 · "해제" 키워드
  제거 · sealed 배정을 회전식으로.
- **내 프로브 실수도 잡혀 계획에 반영됐다**: `display=3` + 부분일치 폴백으로 "지방세법"이
  지방교부세법(조문 19개)으로 조용히 바뀌었다 → 추출기는 완전일치만 채택하고 불일치 시 중단.
- 부수 수리 2건: `process.exit()` 이 Windows libuv 크래시로 종료 코드를 127 로 만들던 것을 1 로 ·
  split 오류 메시지가 어휘 목록을 문자열로 박아 두어 `sealed` 추가 후 낡던 것을 동적 생성으로.
- 크기 회고: changeset 1개 디렉터리에 step 3절 — 독립 변경 3건(추출 도구 / 규약·가드 / 스키마·러너
  배선)이고 통합 검증(가드 3방향 + 실물 60종 인정)이 있어 milestone 규모 정합.

## 3. 증거

- changeset: `changesets/20260801-m5-topics/`
- 검증: `npm test` 348/348 · 코퍼스 검사 3종 PASS(schema·no-new-topics·leak-detect) ·
  `git diff --stat src/` 0줄 · 결정성 동일 규칙+동일 MST 2회 diff 0 · 봉인 위치 분포 i=1..5 →
  4/3/5/5/3(편중 없음)
- 실표면: 평가 하네스 CLI 를 실제로 돌렸다 — `npx tsx bench/expand-topics.ts` → 60건 산출
  (dev 40/sealed 20, rules_digest `af4c2a68`) · `npx tsx bench/check-no-new-topics.ts` → PASS,
  목록에 `관세법 제1조` 를 손으로 넣으면 **exit 1 차단** · `npx tsx bench/run.ts --dry-run
  --cases tasks.json` → 43건 고정, 없는 case_id 섞으면 exit 1. assertion 은 테스트 11건이
  평가했다(`test/m5-topic-source-guard.test.ts`·`test/m5-set-wiring.test.ts`).
- 재현: `npx tsx bench/expand-topics.ts` (동일 규칙·동일 MST 에서 동일 산출) · `npm test`
- 평가 못 함: **규칙 설계 자체가 에이전트 손에 있다는 잔여 위험은 측정하지 못했다.** 사람의 개입
  지점이 주제 60개에서 규칙 1개로 올라간 대가이며, ADR 0004 Consequences 에 "없앤 것이 아니라
  드러낸 것"으로 명시했다. 완화는 규칙 파일화·선정 로그·digest 고정 3종뿐이다.
