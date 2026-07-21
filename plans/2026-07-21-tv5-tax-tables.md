# PLAN — TV5 세율표(별표)

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-tax-vertical-upstream-probe.md` §3
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: 승인 대기

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 세법을 끝까지 (← `plans/horizons/tax-vertical.md`)
- **milestone**: TV5 — 세법의 실제 숫자(세율·공제한도·과세표준 구간)는 조문 본문이 아니라 **별표**
  에 있다. 지금 조문만 주면 "대통령령으로 정하는 율"에서 끊긴다. `licbyl` 이 실측 97건("세율")로
  열려 있고 메타데이터는 JSON 으로 오지만 **표 내용은 파일(HWP/PDF)** 이다 — 찾기와 읽기가 서로
  다른 문제다.
  규모 근거: 별표 메타 출하와 파일 본문 스파이크가 독립 changeset 2, 통합검증 = 세율 질의에서
  별표 도달.

## 범위 / 중단점

- execution mode: continuous
- **범위**: `licbyl` 메타데이터 출하 + 파일 본문 추출 **가능성 판정**.
- **제외**: `admbyl`/`ordinbyl`(행정규칙·자치법규 별표 — 세법 아님) · 서식 작성 지원 ·
  별표 내용 파싱을 통한 계산.
- **중단점**: blocked / error / decision_required / risk_gate(파일 다운로드 실패·용량) /
  **파일 추출이 실패율 >30% 또는 지연 >3초** → 추출 미채택, 메타만 출하하고 정상 종료.
- 롤백/정리: 메타 출하는 응답 필드 1개. 추출은 채택 안 하면 코드가 안 남는다.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → 배포 사본 build. ⚠ **응답 필드가 늘면 MCP 재시작 필요**
  (TV2·TV3 재시작에 묶어서 한 번에 알린다).
- 검증: `npm test` + 실 API 별표 프로브 + 추출 스파이크 실측 + dist 스모크.
- 배포/운영: 도구 개수 불변(11개).

**② 자기선언 도메인**
- **찾기와 읽기를 분리한다**: 메타데이터(별표명·관련법령·별표번호·파일링크)는 JSON 으로 싸게
  온다 → **"어느 별표를 봐야 하는지"는 지금도 답할 수 있다.** 내용 추출은 비싸고 실패할 수 있다.
  **한 changeset 에 묶지 않는다** — 묶으면 추출 실패가 메타 출하까지 죽인다.
- **스파이크의 정직한 종료**: step-2 는 "되면 채택, 안 되면 기각"이 **둘 다 정상 종료**다.
  기각이어도 그 근거가 산출물이다. 억지로 채택하지 않는다.
- **파일 형식**: 실측상 `별표서식파일링크`(HWP 추정)와 `별표서식PDF파일링크` 둘 다 온다.
  **PDF 를 먼저 시도**한다(텍스트 레이어 가능성이 높다). HWP 파싱은 이 milestone 범위 밖 —
  필요하면 기각한다.
- **저작·용량**: 다운로드한 파일을 레포에 저장하지 않는다(캐시는 메모리·임시). 대용량은 상한으로 거절.
- **환각 방어**: 추출이 부분 실패했을 때 **부분 표를 완전한 표처럼 주지 않는다.** 추출 신뢰도를
  응답에 싣고, 낮으면 **파일 링크만** 준다(F20 원칙 — 틀린 답보다 없는 답).
- 검토 후 제외: 화면·디자인 · 데이터 스토어(파일 저장 안 함) · 인증 · 관측 · 신규 도구 · 새 자료원.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **HWP 파싱** — 되면 좋지만 이 milestone 을 인질로 잡는다.

## 결정 로그

- status: resolved
- **메타와 추출을 한 changeset 으로 묶나** → 확정: **아니오.** 추출 실패가 메타를 죽인다.
- **HWP 를 파싱하나** → 확정: **아니오.** PDF 만 시도하고 안 되면 기각.
- **파일을 레포에 저장하나** → 확정: **아니오.**
- **추출이 부분 실패하면** → 확정: **파일 링크만 준다.** 부분 표는 완전한 표처럼 보인다.
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** 별표 메타 출하 — 어느 별표를 봐야 하는지는 지금도 답한다
  - Artifact: `search_law`/`get_law_article` 응답에 관련 별표(`별표명`·`별표번호`·`관련법령명`·
    파일 링크) 선택 출하. `licbyl` 검색을 법령명으로 연결
  - Files: write `src/law-tables.ts`·`src/providers/lawgo-provider.ts`·`src/types.ts`·
    `test/law-tables.test.ts` / read `research/2026-07-21-tax-vertical-upstream-probe.md` §3
  - Dependencies: 없음
  - Verify: `npm test` + 실 API 로 소득세법 세율 관련 별표가 도달하는지 관측 + 추가 호출 ≤1·캐시
  - Failure probe: 별표가 없는 법령에서 **빈 결과가 오고 오류가 나지 않는지** 확인
  - Commit: `changesets/20260721-tv5-table-metadata/`
- [ ] **step-2** 파일 본문 스파이크 — 되면 채택, 안 되면 근거 남기고 기각
  - Artifact: `evidence/bench/2026-07-21-tv5-table-extraction.md` — 세법 별표 표본 10건에 대한
    PDF 텍스트 추출 성공률·지연·품질(표 구조 보존 여부). 채택 시 추출 경로 + 신뢰도 필드,
    기각 시 **되돌린 상태 + 기각 근거**
  - Files: write `evidence/bench/2026-07-21-tv5-table-extraction.md`·
    `changesets/20260721-tv5-table-extraction/README.md`·`ROADMAP.md`
    (채택 시 `src/law-tables.ts` 추가) / read step-1 산출물
  - Dependencies: step-1
  - Verify: 표본 10건 실측이 evidence 에 기록 + 채택 시 **성공률 ≥70% AND 지연 ≤3초** +
    `npm test` 전건 + `--set golden-v2 --split dev` **≥88%** + **배포 사본 build + dist 스모크**
  - Failure probe: 추출이 부분 실패한 케이스를 만들어 **부분 표가 완전한 표처럼 반환되지 않고
    파일 링크로 대체**되는지 확인
  - Commit: `changesets/20260721-tv5-table-extraction/`

## 검증/DoD

- **DoD**: ① 세율 관련 질의에서 별표 메타(별표명·번호·링크)가 도달 ② 별표 없는 법령에서 무오류
  ③ 추가 호출 ≤1/검색 ④ 추출 스파이크 결과가 **채택이든 기각이든 evidence 에 수치로 기록**
  ⑤ 채택 시 성공률 ≥70%·지연 ≤3초·**부분 표 미출하** ⑥ 범용 dev 셋 ≥88% ⑦ `npm test` 전건
  ⑧ **배포 사본 build + dist 스모크**.

## hard-stop policy

- 추출 성공률 <70% 또는 지연 >3초 → **미채택**, 메타 출하만으로 정상 종료.
- HWP 만 있고 PDF 가 없는 별표가 다수 → 그 범위는 메타만으로 닫고 기록.
- 파일 다운로드가 상류 차단을 유발 → 즉시 중단(risk_gate).
- 홀드아웃 개봉 **금지** — TV6 소관.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 메타 출하: 응답 필드 1개 — 빼면 복귀.
- 추출: 기각 시 코드가 남지 않는다.
- 다운로드 캐시는 임시 — 레포에 잔여물 없음.

## finding 큐

- `admbyl`(행정규칙 별표 80건) — 세법 밖이지만 같은 어댑터. 다음 분야 vertical 의 입력.

## 진행 로그 (append-only)
