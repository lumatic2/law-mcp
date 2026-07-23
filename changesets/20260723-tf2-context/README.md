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

## Result

- Status: in_progress (step 1/2)
- Evidence: `bench/corpus.json` · `bench/contexts-tf2.json`
