# PLAN — TF2 맥락 전건 + 봉인 회전

> 생성: 2026-07-23 · 산출물: changeset(tooling) · scope: 맥락 커버리지 100% + 홀드아웃을 슬라이스 회전으로

Status: pending-approval
- execution mode: continuous

## 위계
- **북극성**: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 함정 없음 (← `plans/horizons/trap-free.md`)
- **milestone**: TF2 — 형식 중립 코퍼스를 실제로 형식 중립으로 만들고(맥락 90건 부착), 홀드아웃을
  데이터가 아닌 봉인으로 전환한다. milestone 규모 근거: 독립 step 3개 + 통합 검증(재기준선 3회).

## run 전 scope 결정 (확정)
- **결정**: 맥락 없는 90건 전건 맥락 부착 + 봉인 회전 기계장치 + 새 dev 기준선 산출까지.
- **non-goals**: 새 케이스 추가 금지(주제 무개입의 근간) · `src/` 변경 0줄 · 도구 개선 금지
  (여기서 도구를 고치면 기준선이 오염된다).
- **중단점(stop points)**: 배치 검증 실패는 그 배치 재작성 후 계속 / 유출 탐지기 적발이면 blocked 로
  정지 / 재기준선이 기존 dev 대비 급락(`pass^3` < 70%)하면 blocked 로 정지·보고 /
  슬라이스 분할 방식이 흔들리면 decision_required.
- **롤백/정리**: 맥락은 `context` 필드 추가일 뿐이라 되돌리려면 필드를 비우면 된다(케이스 손실 없음).
  봉인 개봉은 비가역이므로 개봉 전 대상 `seal_id` 를 보고에 명시하고 진행한다.

## 스캐폴딩 결정
- source-of-truth: `bench/corpus.json`(TF1 산출). 맥락은 기존 케이스의 `context` 필드를 채우는 것이지
  새 레코드를 만드는 것이 아니다.
- 검증: `bench/leak-detect.ts` 전건 · 배치별 기준선 3회 · 봉인 스크립트 exit code ·
  `bench/check-no-new-topics.ts`.
- 배포/운영: 배포 영향 없음(`src/` 0줄). 봉인 개봉 이력은 `evidence/bench/seal-log.jsonl` 에
  append-only 로 남긴다 — 개봉이 비가역이므로 기록도 비가역이어야 한다.
- 데이터: 맥락 작성 규칙 — ① 정답 법령명·조문번호·법문 어구를 쓰지 않는다 ② 실제 사용자가 말할 법한
  일상어 ③ 케이스당 2~5문장. 주제는 기존 `expected_article` 이 고정하며 작성자가 고를 수 없다.
- 측정: 봉인 슬라이스 = 코퍼스 내 `seal_id` 로 묶인 케이스 집합. horizon 마다 미개봉 슬라이스 1개를
  개봉하고 그 `seal_id` 를 개봉 이력에 적재한다. 재개봉은 거부한다.
- 검토 후 제외: frontend·backend·design·관측 — 벤치 데이터 작업이라 해당 없음.

## 결정 로그
- D-TF2-1 슬라이스 크기와 개수 — 124건을 dev 와 봉인 슬라이스 N개로 어떻게 가르나.
  선택지 ① 현행 dev/holdout 분할을 유지하고 holdout 쪽을 3슬라이스로 나눈다 ② 전체를 재분할해
  dev 70% + 슬라이스 3개. 추천 ① — 재분할은 dev 기준선의 연속성을 깨서 horizon 닫는 기준 2와 충돌한다.
  확정값: (승인 게이트에서 기록)
- status: (승인 게이트에서 resolved 로 기록)

## Step 트리
- [ ] **step-1 — 맥락 부착**
  - Artifact: 맥락이 채워진 `bench/corpus.json` + 배치별 검증 로그
  - Files: read `bench/corpus.json`·`archive/bench/golden-tax-agentic.json`(문체 참조)·`bench/leak-detect.ts` / write `bench/corpus.json`
  - Dependencies: 없음 (선행 milestone 순서는 `plans/horizons/trap-free.md` 가 소유)
  - Verify: 맥락 커버리지 100%(전건 `query`+`context`) · `bench/leak-detect.ts` 적발 0 ·
    배치별 `pass^3` >= 70%
  - Failure probe: 정답 조문번호를 일부러 넣은 맥락 1건을 배치에 섞어 유출 탐지기가 잡는지 확인
  - Commit: `feat(bench): 코퍼스 90건 맥락 부착 (커버리지 100%)`
- [ ] **step-2 — 봉인 회전 기계장치**
  - Artifact: `bench/seal.ts`(봉인 판정·개봉 기록) · `evidence/bench/seal-log.jsonl`
  - Files: read `bench/corpus.json`·기존 `assertHoldoutSeal` 구현 / write `bench/seal.ts`·러너의 봉인 호출부·`evidence/bench/seal-log.jsonl`
  - Dependencies: step-1
  - Verify: 미개봉 슬라이스 접근이 플래그 없이 exit 1 · 개봉 후 같은 `seal_id` 재개봉 시 exit 1 ·
    개봉 이력이 append-only 로 남는다
  - Failure probe: 개봉 이력 파일을 손으로 지운 뒤에도 재개봉이 막히는지 확인 — 안 막히면 그 사실을
    한계로 증거에 기록한다
  - Commit: `feat(bench): 홀드아웃을 봉인 슬라이스 회전으로 전환`
- [ ] **step-3 — 재기준선과 주제 무개입 증명**
  - Artifact: `evidence/bench/2026-07-23-tf2-baseline.md` · `bench/check-no-new-topics.ts`
  - Files: read `bench/corpus.json`·`archive/bench/golden*.json` / write `evidence/bench/2026-07-23-tf2-baseline.md`·`bench/check-no-new-topics.ts`
  - Dependencies: step-2
  - Verify: dev `pass^3`·`SR@1`·`AT`·기권 정밀도/재현율 전부 출력 · 신규 주제 0건(코퍼스의 모든
    `expected_article` 이 통합 전 4파일에 존재) · `npm test` 전건 통과 · `git diff --stat src/` 0줄
  - Failure probe: 통합 전 4파일에 없는 조문 라벨 1건을 넣어 `check-no-new-topics` 가 exit 1 하는지 확인
  - Commit: `feat(bench): 맥락 전건 기준선 + 주제 무개입 증명`

## 검증/DoD
- 맥락 커버리지 100%, 유출 적발 0, 일부러 유출시킨 문단은 여전히 거부된다.
- 봉인 슬라이스가 플래그 없이 거절하고 재개봉을 영구 거절한다.
- 신규 주제 0건이 스크립트로 증명된다.
- dev 기준선 3회 산출(지표 전종 출력) · `npm test` 전건 통과 · `git diff --stat src/` 0줄.

## 수치 출처
- 기존 dev `pass^3` 90% (급락 판정의 기준선) — `npx tsx bench/agentic-run.ts` 3회 블라인드
  (`evidence/bench/2026-07-23-ar2-baseline.md`)
- 배치 기준선 `pass^3` >= 70% — 같은 커맨드를 배치 범위로 한정 실행
- 유출 적발 0 — `npx tsx bench/leak-detect.ts`

## finding 큐
- (실행 중 발견분 append)

## 진행 로그 (append-only)
- 2026-07-23 plan 작성.
