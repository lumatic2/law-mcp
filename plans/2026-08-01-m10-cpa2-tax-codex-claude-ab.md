# PLAN — M10 · 공인회계사 2차 세법 Codex·Claude 2×2 완성 판정

> 생성: 2026-08-01 · 산출물: changeset(tooling) + 평가 증거 + 판정 보고서 · scope 결정:
> 2026년도 공인회계사 2차 세법 첫 대문제의 정답표 동결 → 격리 검증 → Codex·Claude 2×2 → 채점·판정
> 리서치: `research/2026-08-01-m10-cpa2-tax-ab-design.md`

Status: approved (2026-08-01 사용자 승인 — "코덱스도 하고, 클로드도 하고 총 4개 세션... ㄱㄱ")

## 위계
- **북극성**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `CLAUDE.md` 「북극성」)
- **목표**: 실제 고난도 세법 종합문제에서 Codex와 Claude 각각의 law-mcp 사용 정확성을 검증해 세법
  기능적 완성 선언의 마지막 판단 재료를 만든다.
- **milestone**: M10 — 문제·정답 기준 동결, 도구 격리, 독립 A/B 풀이, 블라인드 채점이라는 4개
  독립 surface와 통합 판정이 필요하므로 milestone 규모다.

## run 전 scope 결정 (확정)
- **결정**: 2026년도 제61회 공인회계사 제2차시험 세법 첫 대문제 1개를 Codex와 Claude Opus 각각의
  law-mcp 사용/미사용 신규 세션, 총 4세션에 같은 프롬프트로 풀게 하고 사전 동결 채점표로 판정한다.
- **execution mode**: `continuous`
- **non-goals**: law-mcp 기능 수정·튜닝 · 재무회계/K-IFRS 문제 · 봉인 20건 개봉 · 공개 배포/npm ·
  여러 문제로 표본 확대 · 답안을 본 뒤 판정선 변경 · 이 milestone 안의 사용자 대신 완성 선언.
- **중단점(stop points)**: completed / 증거가 있는 blocked / decision_required / risk_gate /
  secret_required / external_authority_required / user_stopped. 특히 정답 확정 분모 70% 미만, 실제 Opus
  ID 불일치, MCP 격리 실패, 배포 사본 불일치는 실행을 중단하고 `평가 못 함` 또는 재실행한다.
- **진행 보고**: commentary only. 미완 leaf 는 턴 종료점이 아니다.
- **rollback/cleanup**: 레포 산출물은 changeset commit revert로 원복. 임시 MCP 설정·문제 입력 파일은
  레포 밖 실행별 임시 디렉터리에 두고 원문·해시·도구 추적을 증거로 옮긴 뒤 삭제한다. solver는 레포를
  쓰지 않는다.

## 스캐폴딩 결정
- source-of-truth: 문제 원문·해시·채점표 = `evidence/cpa2/2026-m10/frozen/` · 원시 4세션 출력과
  도구 추적 = `evidence/cpa2/2026-m10/runs/` · 판정 정본 =
  `archive/reports/2026-08-01-m10-cpa2-tax-opus-ab-verdict.md` · 설계 근거 =
  `research/2026-08-01-m10-cpa2-tax-ab-design.md`.
- 검증: 문제·프롬프트·model alias·실제 model ID·실행 플래그를 4개 arm별 manifest로 대조한다.
  정답표는 네 답안 동결 뒤에만 채점자에게 공개한다. 계산 가능한 항목은 결정적으로 재계산하고 법적 명제는
  두 해설과 시험 기준일 유효 법령으로 삼각검증한다.
- 배포/운영: 제품 배포 없음. A는 현재 Claude가 실제 쓰는 `custom-mcps/law-mcp/dist/index.js` 사본을
  명시한 strict MCP config로 호출하며, 사전 smoke에서 실제 도구 응답을 확인한다. 사본 불일치는
  자동 수정하지 않고 배포·재시작 게이트로 멈춘다.
- Claude 격리: Claude Code 2.1.220의 `--model opus --strict-mcp-config --tools "" --no-chrome
  --disable-slash-commands --no-session-persistence --output-format json`을 공통으로 쓴다. 레포 밖 빈
  임시 디렉터리, 새 세션, 해설·웹·파일·셸 차단을 공통 적용하고 MCP config만 A=law-mcp, B=빈 값으로
  다르게 한다. `--tools ""`는 도움말상 내장 도구 집합만 비우는 것으로 해석하되, A의 MCP 목록·실호출
  성공과 B의 도구 목록 0을 연막으로 실증하기 전에는 본 실행하지 않는다. A의 exact MCP allow-list는
  실제 로드 목록에서 생성해 manifest에 동결한다.
- Codex 격리: codex-cli 0.146.0의 `codex exec -m gpt-5.6-sol --ignore-user-config --ignore-rules
  --ephemeral --skip-git-repo-check --sandbox read-only --json`과 `web_search="disabled"`,
  `agents.enabled=false`를 공통으로 쓴다. 빈 임시 디렉터리에서 C+에는 law-mcp 1개만 `mcp_servers`로
  주입하고 C-에는 서버를 하나도 주입하지 않는다. 셸·파일 도구를 호출하면 trace로 arm을 무효화한다.
- 에이전트 운용: Orca의 새 터미널 네 개를 동시에 만들고 독립 task로 배차한다. 부모가 raw JSON,
  tool trace, 실제 model ID와 종료 상태를 직접 회수·검증한다. solver는 서로의 출력과 채점표를 보지
  못한다. arm 이름은 C+(Codex+MCP), C-(Codex-MCP), O+(Opus+MCP), O-(Opus-MCP)로 고정한다.
- 채점: 명시 배점 보존, 출처 계보가 다른 독립 공개 해설 2종 일치분 우선, 불일치는 유효 법령으로
  재판정, 미해소분은 분모 제외. 각 점수 단위를 `결론/계산/근거 존재/근거 정확/귀속시기 정합` 이진
  필드로 쪼개고 오류 분류와 핵심 명제 목록을 답안 전에 고정한다. A만 절대 합격 기준을 적용하고 B는
  기여도 비교용이다.
- 검토 후 제외: frontend·design·인증·결제·호스팅 — 해당 없음(로컬 평가·기록만).

## 결정 로그
- D1 — 문제: **2026년도 제61회 공인회계사 제2차시험 세법 첫 대문제**. 최신 회차·결정적 선택
  규칙이라 문제를 보고 고르는 편향을 막는다. (2026-08-01 사용자 방향 승인)
- D2 — solver: **Codex 2세션 + Claude Opus 2세션**, 총 4개 신규 독립 세션을 동시 실행. Codex pair와
  Opus pair는 각각 실제 model ID가 같아야 하며 전부 기록한다. (2026-08-01 사용자 확정)
- D3 — 비교: 각 모델의 `+` arm은 law-mcp만, `-` arm은 MCP 없음. 모두 웹·Chrome·파일·셸·스킬·
  해설·레포 접근 없음.
- D4 — 프롬프트: 문제와 답안 형식은 byte-identical. 도구 사용 가능 여부 한 문장만 arm별로 바꾸며
  이 차이를 manifest에 기록한다.
- D5 — 정답표: 기관·저자·원출처 계보가 다른 독립 공개 해설 2종 + 시험 기준일 유효 법령. 미해소
  분쟁 배점 제외, 확정 분모가 원문 70% 미만이면 `평가 못 함`.
- D6 — 합격: C+와 O+ 각각 확정 배점 80% 이상, 법적 처리 방향 90% 이상, 핵심 법적 명제 근거 제시율
  100%, 허위·오인 조문/귀속시기 오류 0건, 근거 없는 핵심 단정 0건을 모두 만족. `-` arm은 문턱 없음.
- D7 — 종합 해석: C+와 O+ 모두 통과=`강한 통과`, 하나만 통과=`혼합`, 둘 다 미달=`미달`.
  각 모델의 `+/-` 차이는 도구 기여, `+` 절대 기준은 준비도다. 최종 선언은 사용자 소유다.
- status: resolved

## Step 트리
- [x] **step-1 — 문제·채점표 동결**
  - Artifact: 문제 PDF/텍스트·SHA-256·출처·페이지 manifest, 소문항별 점수 단위를
    `결론/계산/근거 존재/근거 정확/귀속시기 정합`으로 쪼갠 블라인드 채점표와 고정 오류 분류·핵심
    명제 목록, 두 독립 해설의 기관·저자·발행일·원출처 계보와 시험 기준일 법령 대조 기록
  - Risk: 없음 (평가 입력과 기록만 추가)
  - Files: read 공식 시험 공고·문제 원문·독립 해설 2종 / write
    `evidence/cpa2/2026-m10/frozen/*`·`changesets/20260801-m10-cpa2-tax-opus-ab/README.md`
  - Dependencies: none
  - Verify: 문제 출처·해시·페이지 고정 · 세법 첫 대문제 전 소문항과 명시 배점 대응 · 해설 2종의
    기관·저자·원출처 계보가 다름 · 정답 항목마다 해설 일치 또는 유효 법령 재판정 근거 · 이진 필드
    배점 합이 원문 배점과 일치 · 확정 분모 비율 산출 · 접근일·URL 전건 존재
  - Failure probe: 해설 불일치를 임의로 다수결하지 않고 `분쟁`으로 남긴 변형에서 분모가 70% 미만이면
    판정 준비가 반드시 FAIL하는지 검사
  - Commit: `test(m10): 공인회계사 2차 세법 문제와 채점표 동결`
- [x] **step-2 — Codex·Claude 2×2 격리 하네스와 연막검증**
  - Artifact: byte-identical 공통 prompt + arm별 한 문장 차이, Claude strict MCP config 2종과 Codex
    isolated config 2종, 각 `+` arm의 exact law-mcp 목록, 실행 manifest 생성기, `+` 도구 호출 성공/
    `-` 도구 부재/4세션 외부도구 차단 연막증거
  - Risk: 위험 (격리가 새 정상 작업을 막지는 않지만 실패하면 비교 전체가 무효가 되는 판정 게이트)
  - Files: read Claude CLI help·실 배포 MCP 설정의 비밀 제외 구조 / write `bench/cpa2-m10/*`·
    `evidence/cpa2/2026-m10/smoke/*`
  - Dependencies: step-1 (동결 문제 입력 형식이 필요)
  - Verify: 모델별 `+/-` manifest의 model·effort·prompt hash·금지 도구·cwd 동일, MCP config만 다름 ·
    Claude `--tools ""`에서 O+ 실응답/O- MCP 0 · Codex `--ignore-user-config`에서 C+ 실응답/C- MCP 0 ·
    4세션 웹/Chrome/파일/셸/skills/agents 0 · 임시 디렉터리
  - Failure probe: 각 `-` config에 사용자 MCP를 주입한 변형과 각 `+` 배포 엔트리를 잘못 지정한 변형을
    하네스가 실행 전 차단
  - Commit: `test(m10): Codex Claude 2x2 도구 격리 하네스와 연막검증`
- [x] **step-3 — Codex·Claude 독립 4세션 풀이**
  - Artifact: 동시에 시작한 신규 C+/C-/O+/O- 세션의 원시 JSON 답안·도구 추적·시간·종료코드·실제
    model ID와 불변 manifest; 답안 생성 시점에는 채점표 비공개
  - Risk: 없음 (동결 입력으로 답안을 생성·기록)
  - Files: read `evidence/cpa2/2026-m10/frozen/question.txt`·`bench/cpa2-m10/*` / write
    `evidence/cpa2/2026-m10/runs/{codex-with,codex-without,opus-with,opus-without}/*`
  - Dependencies: step-2 (격리 연막 통과 후)
  - Verify: Orca terminal 네 개의 실제 출력 직접 회수 · 시작 시각 겹침 · 새 비지속 세션 · 모델 pair별
    actual model ID 동일 · prompt/question hash 동일 · `+`만 law-mcp 호출 · 금지 도구 0 · 답안 완결
  - Failure probe: 출력 잘림·model mismatch·금지 도구 호출·상대 답안 또는 채점표 접근 중 하나라도 있으면
    해당 arm을 무효로 표시하고 동일 입력의 새 세션 1회만 재실행
  - Commit: `test(m10): Codex Claude 세법 4세션 원시 실행 증거`
- [ ] **step-4 — 블라인드 채점·완성 판정**
  - Artifact: 소문항별 C+/C-/O+/O- 점수·법적 근거·오류 유형·모델별 도구 기여 비교표와
    `archive/reports/2026-08-01-m10-cpa2-tax-opus-ab-verdict.md`
  - Risk: 없음 (동결 답안과 채점표를 대조하는 기록)
  - Files: read step-1~3 산출 전부 / write `evidence/cpa2/2026-m10/scoring/*`·판정 보고서·
    `plans/horizons/CANDIDATES.md`(잔여만)
  - Dependencies: step-3 (두 답안 동결 후)
  - Verify: 채점표 digest 불변 · 계산항목 재계산 · 4세션 소문항별 점수와 근거 링크 · C+/O+의 5개
    합격 조건 각각 판정 · 모델별 +/- 차이와 도구 호출 연결 · 종합 3단 판정 · 못 잰 것은 `평가 못 함`
  - Failure probe: arm 이름을 가린 채 4답안 점수를 다시 산출해 최초 점수와 불일치하면 adjudication 후
    차이와 이유를 보고서에 공개
  - Commit: `docs(m10): 공인회계사 2차 세법 Opus A/B 완성 판정`

## 수치 출처
- 원문 배점: step-1에서 동결하는 2026년도 제61회 공인회계사 제2차시험 세법 첫 대문제의 명시 배점.
- 70% 확정 분모 최소선: 단일 비공식 해설의 영향이 문제 대부분을 차지하는 경우 판정을 거부하기 위한
  평가 설계값. 실행 전 고정하며 답안을 본 뒤 변경하지 않는다.
- 80% 총점·90% 법적 처리·100% 근거·오류 0건: `기능적으로 충분`이라는 강한 선언에 쓰는 사전
  합격선. M1~M9의 도달 증거 위에 정확성·근거·시점 오류를 동시에 보수적으로 요구한다.
- 실제 점수·차이·시간·호출수: step-3 원시 JSON/tool trace와 step-4 결정적 채점 산출에서만 가져온다.

## 검증/DoD
- 2026년 세법 첫 대문제와 채점표가 답안 생성 전에 해시로 동결되고, 확정 정답 분모가 70% 이상이다.
- Codex pair와 Opus pair가 각각 같은 실제 모델·문제·공통 prompt를 쓰며 차이는 law-mcp뿐이다.
- C+/O+의 실 law-mcp 성공, C-/O-의 MCP 부재, 4세션 외부도구 차단이 trace에서 입증된다.
- 4세션 원시 답안·도구 trace·model ID·시간·종료코드가 남고 채점표 유출이 없다.
- C+/O+의 절대 기준, 모델별 +/- 기여, 종합 3단 판정을 분리한 보고서가 존재한다.
- `src/`·`package.json`·배포 사본 무변경 · 봉인 20건 미개봉 · `npm test` 전건.
- 보고서는 이 한 문제가 M1~M9 위의 종합시험임을 명시하고 최종 완성 선언을 사용자에게 돌려준다.

## finding 큐
- 2026-08-01 fresh 검토자 반영: `--tools ""`와 MCP 공존을 문서 가정이 아닌 연막 실측으로 승격 ·
  채점 정성어를 이진 필드/오류 분류/사전 핵심 명제로 정형화 · 해설 2종의 출처 계보 독립성 추가.

## 진행 로그 (append-only)
- 2026-08-01 plan 초안 작성 — Claude Opus law-mcp 사용/미사용 A/B.
- 2026-08-01 사용자 확장·승인 — Codex pair 추가, 총 4세션 2×2로 승인(`ㄱㄱ`).
- 2026-08-01 step-1 완료 — 공식 PDF/HWP·문제 1 전사본 해시 동결, 25점/17단위 채점표와 12개 핵심 명제 고정. 월세 1점은 공개 전문가 이견으로 제외해 확정 분모 24/25(96%). Law MCP 시험일 조문 및 tax-agent 계산기로 재판정했고, 분쟁 7점 추가 변형은 68%로 준비 게이트 FAIL을 확인.
- 2026-08-01 step-2 완료 — Orca 신규 터미널 4개 연막. C+/O+ 실제 Law MCP 본문 성공, C-/O- 호출 0, 금지 surface marker 0, 배포 SHA 일치. Opus 실제 모델은 양쪽 `claude-opus-5`; Codex JSONL 모델 ID 비노출 한계를 명시하고 양쪽 alias/CLI/플래그를 고정. Codex exec MCP 승인·env 전달 결함을 하네스에서 명시 설정하고 실패 감지를 강화.
- 2026-08-01 step-3 완료 — Orca 신규 터미널 C+/C-/O+/O- 동시 시작 편차 1.043초. 전 arm exit 0·답안 완결·stderr 0·금지 surface 0, C+/O+만 Law MCP trace, C-/O- 호출 0. raw/answer/meta 해시와 terminal handle을 봉인했으며 채점표 경로 접근 흔적 0.
