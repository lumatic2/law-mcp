# 20260723-tf2-context

## Target

- Goal: 맥락 없는 topic 전건에 자연어 맥락을 붙여 코퍼스를 실제로 형식 중립으로 만든다.
- ROADMAP milestone: TF2 (horizon `trap-free`)

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `bench/contexts-tf2.json` | 작성한 맥락 60건의 원본 | 코퍼스에 부착 |
| `bench/corpus.json` | 맥락·질의 부착 | topic 커버리지 100% |
| `bench/leak-detect.ts` | 맥락 없는 레코드에서 크래시 | 없는 문단은 유출도 없다 — 건너뛴다 |

되돌리기: `context`·`query` 필드 추가일 뿐이라 비우면 원상 복귀(케이스 손실 없음).

## step-1 — 맥락 부착

- Goal: 맥락 없는 topic 60개에 맥락을, 질의 없는 topic 11개에 라벨 질의를 붙인다.
- Evidence Contract — Scenario: 주제는 기존 `expected_article` 이 고정하고 작성자는 문장만 쓴다.
  Failure probe: 정답 법령명·조문번호를 일부러 넣은 문단을 섞어 유출 탐지기가 exit 1 하는지 확인.
- Verification
  - [x] 맥락 60건 작성·부착 — **topic 기준 맥락 커버리지 100%** (94/94)
  - [x] 라벨 질의 11건 작성·부착 — topic 기준 질의 커버리지 100% (94/94)
  - [x] `npx tsx bench/leak-detect.ts bench/corpus.json` → PASS 124건 전부 유출 없음
  - [x] 유출 주입 probe 2건 → LEAK 적발 + exit 1 · 탐지기 selftest 5/5
  - [x] 스키마 검증 exit 0 · `npm test` 314/314 · `git diff --stat src/` 0줄
  - [ ] 배치별 `pass^3` — step-2 재기준선으로 흡수 (실 블라인드 세션 필요)
- Result: topic 커버리지 100%. **짝-복사(crossfill)는 채택하지 않았다** — 이미 맥락이 있는
  topic 에 같은 맥락을 복제할 뿐이라 커버리지 숫자만 올리고 측정에는 중복을 넣는다.
  커버리지는 레코드가 아니라 **topic 기준**으로 센다.

## step-2 — 재기준선·주제 무개입 증명·봉인 규약

- Goal: 주제를 만들지 않았음을 기계로 증명하고, 봉인 규약을 문서로 고정하고, 새 맥락의 dev
  기준선을 낸다.
- Verification
  - [x] `npx tsx bench/check-no-new-topics.ts` → PASS, 표시 없는 신규 주제 **0건**
        (규약 적용 3건만 `label_rule` 표시로 예외 출력)
  - [x] 실패 검증: 통합 전에 없던 조문 라벨을 주입하면 FAIL + exit 1
  - [x] 봉인 규약 `docs/adr/0002-평가-문제-봉인-규약.md` — 미개봉 문제가 0개임을 명시,
        다음에 문제를 늘릴 때 그 자리에서 떼어 두는 방식으로 확보
  - [x] 블라인드 측정 하네스 준비 — `evidence/bench/2026-07-23-tf2-baseline/`
        (BRIEF·tasks.json 43건) · `dist-bench` 빌드 + `tool-cli` 스모크 통과
  - [ ] **dev 재기준선 3회 — 실 블라인드 세션 필요(비용 결정 대기)**
- Result: 증명과 규약은 끝. 기준선은 실 에이전트 세션 3회가 필요해 사용자 판단 대기.

## Result

- Status: in_progress (step 2/2 — 기준선 측정만 남음)
- Evidence: `bench/corpus.json` · `bench/check-no-new-topics.ts` ·
  `docs/adr/0002-평가-문제-봉인-규약.md`
