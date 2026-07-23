# PLAN — TF2 맥락 전건 부착

> 생성: 2026-07-23 · 산출물: changeset(tooling) · scope: 맥락 커버리지 100% + 재기준선
> 개정 2026-07-23: 봉인 회전 기계장치를 **삭제**했다(사용자 판정). 지금 점수를 보며 튜닝할 대상이
> 없어 장치가 놀고, 대신 규약 ADR 한 줄로 다음에 문제를 늘릴 때를 대비한다.

Status: approved (2026-07-23 사용자 승인 — horizon 전체 연쇄)
- execution mode: continuous

## 위계
- **북극성**: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP 의 대표 중 하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 함정 없음 (← `plans/horizons/trap-free.md`)
- **milestone**: TF2 — 형식 중립 코퍼스를 실제로 형식 중립으로 만든다(맥락 90건 부착). milestone
  규모 근거: 독립 step 2개 + 이를 가로지르는 통합 검증(재기준선 3회 + 주제 무개입 증명).

## run 전 scope 결정 (확정)
- **결정**: 맥락 없는 90건 전건 맥락 부착 + 새 dev 기준선 산출 + 봉인 규약 ADR 까지.
- **non-goals**: 새 케이스 추가 금지(주제 무개입의 근간) · `src/` 변경 0줄 · 도구 개선 금지
  (여기서 도구를 고치면 기준선이 오염된다) · **봉인 회전 기계장치 구현 금지**(규약만 남기고 장치는
  실제로 미개봉 문제를 만들 때 만든다).
- **중단점(stop points)**: 배치 검증 실패는 그 배치 재작성 후 계속 / 유출 탐지기 적발이면 blocked 로
  정지 / 재기준선이 기존 dev 대비 급락(`pass^3` < 70%)하면 blocked 로 정지·보고 / 새 사용자 결정이
  나오면 decision_required.
- **롤백/정리**: 맥락은 `context` 필드 추가일 뿐이라 되돌리려면 필드를 비우면 된다(케이스 손실 없음).

## 스캐폴딩 결정
- source-of-truth: `bench/corpus.json`(TF1 산출). 맥락은 기존 케이스의 `context` 필드를 채우는 것이지
  새 레코드를 만드는 것이 아니다.
- 검증: `bench/leak-detect.ts` 전건 · 배치별 기준선 · `bench/check-no-new-topics.ts` · `npm test`.
- 배포/운영: 배포 영향 없음(`src/` 0줄). `custom-mcps` 사본 재빌드 불요.
- 데이터: 맥락 작성 규칙 — ① 정답 법령명·조문번호·법문 어구를 쓰지 않는다 ② 실제 사용자가 말할 법한
  일상어 ③ 케이스당 2~5문장. 주제는 기존 `expected_article` 이 고정하며 작성자가 고를 수 없다.
- 검토 후 제외: frontend·backend·design·관측 — 벤치 데이터 작업이라 해당 없음.

## 결정 로그
- D-TF2-1 봉인 회전 기계장치를 이번에 만드나 — 2026-07-23 사용자 판정으로 **만들지 않는다**.
  근거: 봉인(떼어 두고 안 보는 것)은 점수를 보며 도구를 튜닝할 때만 값을 한다. 이번 horizon 에
  튜닝 대상이 없고, 기존 124건은 dev 79 가 튜닝에 쓰였고 holdout 45 는 과거 horizon 에서 이미
  개봉돼 **미개봉 문제가 0개**다. 장치를 만들어도 담을 게 없다. 대신 규약 ADR 을 남긴다.
  확정값: 장치 미구현 · 규약 ADR 작성(step-2)
- status: resolved

## Step 트리
- [ ] **step-1 — 맥락 부착**
  - Artifact: 맥락이 채워진 `bench/corpus.json` + 배치별 검증 로그
  - Files: read `bench/corpus.json`·`archive/bench/golden-tax-agentic.json`(문체 참조)·`bench/leak-detect.ts` / write `bench/corpus.json`
  - Dependencies: 없음 (선행 milestone 순서는 `plans/horizons/trap-free.md` 가 소유)
  - Risk: 기계적
  - Verify: 맥락 커버리지 100%(전건 `query`+`context`) · `bench/leak-detect.ts` 적발 0 ·
    배치별 `pass^3` >= 70%
  - Failure probe: 정답 조문번호를 일부러 넣은 맥락 1건을 배치에 섞어 유출 탐지기가 잡는지 확인
  - Commit: `feat(bench): 코퍼스 90건 맥락 부착 (커버리지 100%)`
- [ ] **step-2 — 재기준선·주제 무개입 증명·봉인 규약**
  - Artifact: `evidence/bench/2026-07-23-tf2-baseline.md` · `bench/check-no-new-topics.ts` ·
    `docs/adr/<NNNN>-평가-문제-봉인-규약.md`
  - Files: read `bench/corpus.json`·`archive/bench/golden*.json` / write `evidence/bench/2026-07-23-tf2-baseline.md`·`bench/check-no-new-topics.ts`·`docs/adr/` 신규 1개
  - Dependencies: step-1
  - Risk: 기계적
  - Verify: dev `pass^3`·`SR@1`·`AT`·기권 정밀도/재현율 전부 출력 · 신규 주제 0건(코퍼스의 모든
    `expected_article` 이 통합 전 4파일에 존재) · ADR 이 ① 기존 124건은 전부 개봉됨을 명시하고
    ② 다음에 문제를 늘릴 때 일부를 처음부터 안 보고 떼어 두는 절차를 규정 · `npm test` 전건 통과 ·
    `git diff --stat src/` 0줄
  - Failure probe: 통합 전 4파일에 없는 조문 라벨 1건을 넣어 `check-no-new-topics` 가 exit 1 하는지 확인
  - Commit: `feat(bench): 맥락 전건 기준선 + 주제 무개입 증명 + 봉인 규약 ADR`

## 검증/DoD
- 맥락 커버리지 100%, 유출 적발 0, 일부러 유출시킨 문단은 여전히 거부된다.
- 신규 주제 0건이 스크립트로 증명된다 — 이번 horizon 이 에이전트에게 주제를 고르게 하지 않았다는 기계 증거.
- dev 기준선 산출(지표 전종 출력) · 봉인 규약 ADR 존재 · `npm test` 전건 · `git diff --stat src/` 0줄.

## 수치 출처
- 기존 dev `pass^3` 90% (급락 판정의 기준선) — `npx tsx bench/agentic-run.ts` 3회 블라인드
  (`evidence/bench/2026-07-23-ar2-baseline.md`)
- 배치 기준선 `pass^3` >= 70% — 같은 커맨드를 배치 범위로 한정 실행
- 유출 적발 0 — `npx tsx bench/leak-detect.ts`

## finding 큐
- (실행 중 발견분 append)

## 진행 로그 (append-only)
- 2026-07-23 plan 작성.
- 2026-07-23 봉인 회전 기계장치 삭제(사용자 판정) — step 3개 → 2개, 규약 ADR 로 대체.
