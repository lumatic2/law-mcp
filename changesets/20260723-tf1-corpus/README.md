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

## Result

- Status: in_progress (step 2/3)
- Evidence: `docs/adr/0001-...md` · `bench/corpus.json` · `bench/migrate-corpus.ts`
