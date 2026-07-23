# 20260723-tf1-corpus

## Target

- Goal: 골드 4파일을 형식 중립 단일 코퍼스로 통합하고 통합 전 수치를 재현한다.
- ROADMAP milestone: TF1 (horizon `trap-free`)

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `docs/adr/0001-본법-시행령-정답-라벨-규약.md` | 정답 라벨 모호성 제거 | 위임 지점 판정 규칙 고정 |
| `bench/corpus.json` (step-2) | 단일 코퍼스 | 4파일 통합 |
| `bench/run.ts`·`bench/agentic-*.ts` (step-3) | 코퍼스 배선 | 러너가 코퍼스를 읽는다 |

되돌리기: 구 4파일은 `archive/bench/` 로 이동(삭제 아님) — 러너 배선만 되돌리면 원상 복귀.

## step-1 — 라벨 규약 ADR

- Goal: 본법/시행령 정답 규약을 확정하고 위임 지점 케이스를 식별한다.
- Evidence Contract — Scenario: 규약 4규칙으로 세법 84건을 판정, 각 판정의 근거를 본문에서 인용.
  Failure probe: 규약을 반대로 적용하면 다른 결론이 나오는지 대조(대안 2종을 ADR 에 기록).
- Verification
  - [x] 위임 지점 전수 식별(세법 84건) — `get_law_article` 본문·`delegated_to` 직접 확인, 변경 대상 4건
  - [x] 판정 근거를 ADR 표로 기록 (유지 판정·경계 사례 포함)
  - [ ] 일반 세트 40건 기계 스캔 — step-2 로 이월 (F1)
  - [ ] `npm run bench:verify-labels` — 라벨 적용 시점(step-3 이후)에 실행
- Result: 규약 확정. **라벨 변경은 step-3 이후로 미룸** — 재현 검증과 규약 효과를 같은 수치에
  섞지 않기 위해(ADR "라벨 적용 시점" 절).

## step-2 — 스키마와 마이그레이션

- Goal: 4파일을 형식 중립 단일 코퍼스로 합치고 스키마 검증을 건다.
- Evidence Contract — Scenario: 124 레코드가 `query`·`context` 중 최소 하나와 `topic_id`·
  `provenance` 를 갖고 들어온다. Failure probe: 필수 필드 누락·양쪽 질의 부재·`case_id` 중복·
  정답 조문 부재 4종을 넣어 검증기가 exit 1 하는지 확인.
- Verification
  - [x] `npx tsx bench/migrate-corpus.ts --write` → 124건 (v2 40 + tax 50 + agentic 34), v1 40건 제외 로그
  - [x] `npx tsx bench/check-schema.ts bench/corpus.json` exit 0 — distinct topic 92개
  - [x] Failure probe 4종 전부 exit 1 (필드 누락·질의 부재·id 중복·조문 부재)
  - [x] `npm test` 314/314 · `git diff --stat src/` 0줄
  - [ ] 일반 세트 `delegated_to` 기계 스캔 (F1) — step-3 으로 이월
- Result: `bench/corpus.json` 124 레코드 / 92 topic. **형식이 다른 짝이 25 topic** 있어
  `query`↔`context` 를 서로 채울 수 있다 — TF2 작성 부담이 90건 → 65건으로 준다.
  구 4파일 이동은 러너 배선(step-3) 뒤로 미룸(중간 상태에서 읽는 쪽이 깨지지 않게).

## step-3 — 러너 2종 배선과 재현 검증

- Goal: 러너가 코퍼스를 읽게 하고 통합 전 수치를 재현한다.
- Evidence Contract — Scenario: `--provenance` 로 표본을 통합 전과 같게 좁혀 범용을 실측,
  에이전트는 저장된 실행 로그를 결정적 채점기로 재채점. Failure probe: 구 파일로 돌린 값과
  나란히 대조 — 8개 지표 전부.
- Verification
  - [x] 범용 dev `recall@3` **88.0%** (선언 88.0%) · `recall@1` 68.0% — 일치
  - [x] 에이전트 dev `pass^3` **90%** · `SR@1` 80% · `AT` 1.16 · 기권 100%/100% — 전부 일치
  - [x] 흔들리는 케이스 목록까지 일치 (d05 1/3 · d09 2/3)
  - [x] 구 4파일 `archive/bench/` 이동 · 계약 테스트 2종 동결본으로 재배선
  - [x] 홀드아웃 봉인 유지 확인 (플래그 없이 throw)
  - [x] `npm test` 314/314 · `git diff --stat src/` 0줄
- Result: 통합 성공 — 8개 지표 전부 일치. `evidence/bench/2026-07-23-tf1-reproduction.md`

## step-4 — 라벨 규약 적용 (재현 검증 뒤)

- Goal: ADR 0001 규약을 4건에 적용하고 그 효과를 재현 수치와 **분리해** 기록한다.
- Verification
  - [x] 4건 적용 — 대상이 각각 정확히 1건임을 스크립트가 확인 (아니면 exit 1)
  - [x] 스키마 검증 exit 0
  - [x] 효과 측정: `pass^3` 90% 불변, 흔들리는 케이스가 d05↔d09 로 **뒤바뀜**
  - [x] 세법 dev `recall@3` 83.3% — 변경 2건 모두 여전히 HIT (도달 축 손실 0)
- Result: 규약 적용이 합계를 바꾸지 않았다. 대신 **에이전트가 본법/시행령 사이에서 실제로
  진동한다**는 사실이 드러났다 — 라벨 문제가 아니라 도구가 위임 관계를 소비층에 못 전달하는
  문제. 후속 후보로 적재.

## Result

- Status: done (step 4/4)
- Evidence: `evidence/bench/2026-07-23-tf1-reproduction.md` · `bench/corpus.json` ·
  `docs/adr/0001-본법-시행령-정답-라벨-규약.md`
