# PLAN — UD4 본법 승격 + 사다리 단축

> 생성: 2026-07-21 · 갈래: tooling · 소비 증거: `evidence/bench/2026-07-21-ud2-verdict.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-21 사용자 "ㄱㄱ")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 법제처가 가진 능력을 그대로 전달 (← `plans/horizons/upstream-delivery.md`)
- **milestone**: UD4 — horizon 닫는 기준 중 유일한 미달(**recall@3 ≥85%**, 현재 80%)을 메우고,
  UD2 가 남긴 지연 꼬리(F19)를 없앤다. 두 작업의 공통점은 **upstream 이 이미 준 것을 우리가
  안 쓰고 있다**는 것 — 시행령을 찾아 놓고 그 근거 본법을 안 주고, `aiSearch` 가 답했는데도
  사다리 하위 단계를 끝까지 돈다.
  규모 근거: 본법 승격·사다리 단축·판정/배포가 독립 changeset 3, 통합검증 = dev 교차 A/B + 지연 실측.

## 범위 / 중단점

- execution mode: continuous
- **범위**: `search_law` 후보 **보정**과 사다리 **실행 순서**만 건드린다. 신규 MCP 도구 없음(11개 유지).
  응답 스키마 변경 없음 — **도구 description 도 안 바꾼다**(사용자 재시작 부담을 늘리지 않는다).
- **제외**: 홀드아웃 열람(horizon close 소관) · 새 자료원 · `aiRltLs`/`lsRlt` 그래프 API(F6 — 별건) ·
  못 맞히는 나머지 3건에 대한 개별 대응(과적합 금지).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **dev 교차 A/B 에서 순 이득 <2건 = 이득 없음**(가설 기각 후 정지·기록) /
  **새로 깨지는 쿼리가 0 이 아님**(승격 규칙 재설계 1회 후에도 안 되면 정지).
- 롤백/정리: 두 변경 모두 **켜고 끄는 지점이 각각 1곳**이다. 본법 승격은 후처리 1단계라
  빼면 UD2 상태로 복귀하고, 사다리 단축은 조건문 1개라 되돌리면 전량 탐색으로 복귀한다.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → `~/projects/custom-mcps/law-mcp` 에서 `git pull &&
  npm run build`. **응답 스키마·도구 description 이 안 바뀌므로 이 milestone 은 MCP 재시작을
  새로 요구하지 않는다**(직전 UD2·UD3 의 재시작 부채는 그대로 남아 있다).
- 검증: `npm test`(fixture — 실 API 미접속) + `bench/ud2-ab.ts` 교차 A/B + `bench:golden` 본측정
  + 지연 실측 + 배포 사본 dist 스모크.
- 배포/운영: 도구 개수 불변(11개). 사용자 조치 불요.

**② 자기선언 도메인**
- **승격 규칙의 근거**: 하위법령(시행령·시행규칙·규칙)은 이름이 `<본법명> 시행령` 꼴이라
  **본법명을 문자열로 복원할 수 있다.** 복원한 이름을 실제로 조회해 존재를 확인한 뒤에만
  올린다 — 이름 규칙만 믿고 없는 법을 만들어 내면 UD0 급 오답이 된다.
- **과적합 방어 (F5)**: 이 규칙은 dev 2건을 겨냥해 만들지만, **쿼리 특정 조건을 쓰지 않는다**
  (특정 법명·도메인·토큰 하드코딩 금지). 규칙이 일반적이지 않으면 채택하지 않는다.
- **판정 방식**: UD2 와 동일 — **쿼리마다 배치를 연달아 재는 교차 측정**(F13). 채택 조건 =
  **새로 깨지는 쿼리 0 AND 순 이득 ≥2건**. UD2 의 ≥3 보다 낮춘 이유: 남은 미달이 5%p(2건)이고
  이 규칙이 겨냥하는 결함 유형이 dev 에 2건뿐이라 상한이 2다. **손실 0 은 그대로 유지한다.**
- **사다리 단축의 안전 조건**: `aiSearch` 가 답했다고 무조건 생략하면 `aiSearch` 가 틀린
  유형(UD2 에서 관측한 `사용자책임 면책 사유`)에서 폴백을 잃는다. 생략은 **이름 검색이 이미
  결과를 준 경우의 하위 단계**로 한정하고, 생략 전후 결과가 **동일함을 A/B 로 확인**한다.
- **비용 예산**: 본법 승격은 추가 호출 ≤1(이름 조회, 캐시). 사다리 단축은 호출을 **줄이는**
  변경이라 예산 위반이 없다. 총합으로 검색 1회 지연이 UD2 대비 **늘지 않아야** 한다.
- **하류 회귀 범위(UD0 교훈)**: 순위를 바꾸는 변경이므로 `resolveLawId`(법령명 → ID)를 회귀
  범위에 넣는다. 이름 조회 경로에서 본법 승격이 돌면 `민법 시행령`을 물었을 때 `민법`이 1위가
  되어 **다른 법의 조문을 반환**한다. 그 경로에서는 승격을 끄고 테스트로 잠근다.
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증(신규 시크릿 없음) · 관측 · 신규 도구 노출 ·
  응답 스키마 변경.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **응답 스키마** — 이번 milestone 은 필드를 추가하지 않는다.
  추가하고 싶어지면 그건 UD4 범위가 아니라 다음 milestone 이다(사용자 재시작 부담).

## 결정 로그

- status: resolved
- **본법을 올리나 끼워 넣나** → 확정: **없으면 끼워 넣고, 있으면 올린다.** 시행령만 찾은 상태는
  "답을 반쯤 찾은" 것이라 본법이 목록에 아예 없는 경우가 결함의 본체다.
- **채택 문턱을 ≥3 에서 ≥2 로 낮추는 게 정당한가** → 확정: **정당하다.** 겨냥한 결함 유형이
  dev 에 2건뿐이라 ≥3 은 달성 불가능한 문턱이다. 대신 **손실 0** 은 낮추지 않는다.
- **못 맞히는 나머지 3건을 손대나** → 확정: **아니오.** 개별 대응은 과적합이다(F5).
- **홀드아웃을 여나** → 확정: **아니오.** horizon close 시 1회(UD1 이 코드로 강제).
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** parent-law — 하위법령만 찾았을 때 근거 본법을 함께 준다
  - Artifact: `src/parent-law.ts` — 법령명에서 본법명 복원(`<X> 시행령`·`시행규칙`·`규칙` → `X`) +
    `searchLaw` 후처리로 본법 편입. 복원한 이름은 **실제 조회로 존재 확인 후에만** 편입
  - Files: write `src/parent-law.ts`·`test/parent-law.test.ts`·`src/providers/lawgo-provider.ts` /
    read `src/ai-search.ts`·`src/providers/source-adapter.ts`
  - Dependencies: 없음
  - Verify: `npm test` — 복원 규칙(시행령·시행규칙·규칙·본법 자신)·존재 확인 실패 시 미편입·
    중복 금지·캐시로 추가 호출 ≤1 + `npx tsx bench/ud2-ab.ts --split dev` 교차 A/B 로
    **새로 깨지는 쿼리 0 AND 순 이득 ≥2**
  - Failure probe: 존재하지 않는 본법명이 복원되는 입력(`○○에 관한 규칙` 등)을 주입해
    **없는 법을 만들어 내지 않는지** 확인 + 조회 실패 시 기존 결과 그대로인지 확인
  - Commit: `changesets/20260721-ud4-parent-law/`
- [ ] **step-2** ladder-shortcut — `aiSearch` 가 답했으면 사다리 하위 단계를 생략 (F19)
  - Artifact: 사다리 실행 조건 정리 — 이름 검색이 결과를 줬고 `aiSearch` 도 답했으면
    본문검색·완화·브리지 단계를 돌지 않는다. 지연 꼬리 실측 표
  - Files: write `src/providers/lawgo-provider.ts`·`src/providers/source-adapter.ts`·
    `test/ladder-shortcut.test.ts`·`evidence/bench/2026-07-21-ud4-latency.md` / read `src/ai-search.ts`
  - Dependencies: step-1
  - Verify: `npx tsx bench/ud2-ab.ts --split dev` 로 단축 전후 **결과가 쿼리 단위로 동일**함을
    확인(단축은 품질 중립이어야 한다) + 지연 실측으로 중앙·최대 모두 UD2 대비 감소
  - Failure probe: `aiSearch` 를 HTTP 503 으로 죽인 상태에서 사다리가 **전량 실행**되는지 확인 —
    단축 조건이 폴백을 갉아먹지 않는지
  - Commit: `changesets/20260721-ud4-ladder-shortcut/`
- [ ] **step-3** verdict — 종합 판정 + 배포
  - Artifact: `evidence/bench/2026-07-21-ud4-verdict.md` — recall@3 최종 수치, 지연 전후,
    기각된 규칙의 근거. 배포 사본 반영 + dist 스모크
  - Files: write `evidence/bench/2026-07-21-ud4-verdict.md`·`changesets/20260721-ud4-verdict/README.md`·
    `ROADMAP.md` / read 전 step 산출물
  - Dependencies: step-1, step-2
  - Verify: `npm test` 전건 + `npm run bench:golden -- --set golden-v2 --split dev --repeat 3` +
    지연 실측 + **배포 사본 build 후 dist 스모크**(CLAUDE.md 배포 계약)
  - Failure probe: 배포 사본 build 실패 또는 dist 결과가 소스와 다른 것을 **관측하고 기록**한다
  - Commit: `changesets/20260721-ud4-verdict/`

## 검증/DoD

- **DoD**: ① dev 교차 A/B 에서 본법 승격의 **순 이득 ≥2건 + 새로 깨지는 쿼리 0**
  ② 승격 규칙에 **쿼리·법명 하드코딩 없음**(과적합 방어) ③ 존재하지 않는 본법을 만들어 내지
  않음(failure probe) ④ 사다리 단축이 **품질 중립**(쿼리 단위 결과 동일) ⑤ 검색 1회 지연이
  UD2 대비 **중앙·최대 모두 감소** ⑥ `resolveLawId` 는 승격을 타지 않음(테스트 고정)
  ⑦ `npm test` 전건 ⑧ **배포 사본 build + dist 스모크** ⑨ 도구 개수·응답 스키마 불변.
- **이득이 없으면**: 채택하지 않고 기각 근거를 evidence 에 남긴다 — 이것도 정상 종료다.
  recall@3 이 80% 에 머물면 horizon 닫는 기준 ②는 **미달로 기록**하고 close 판단을 사용자에게 올린다.

## hard-stop policy

- dev 교차 A/B 순 이득 <2건 → 채택 중단, 기각 기록 후 정지·보고.
- 새로 깨지는 쿼리가 남음 → 승격 규칙 재설계 1회 후에도 안 되면 정지·보고.
- 사다리 단축이 품질을 바꿈(쿼리 단위 결과 불일치) → 단축 철회 후 지연은 별건으로 남기고 진행.
- 홀드아웃을 여는 것 **금지**(러너가 기계적으로 거부 — UD1 step-2).
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 본법 승격: 후처리 1단계를 빼면 UD2 상태로 복귀.
- 사다리 단축: 조건문 1개를 되돌리면 전량 탐색으로 복귀.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F5(과적합): dev 25건에 맞춘 규칙은 홀드아웃에서 무너진다. 이 milestone 의 규칙이 **일반적인지**를
  채택 조건에 명시적으로 넣었다.
- F6: `aiRltLs`·`lsRlt` 는 본법-하위법령 관계를 upstream 이 직접 주는 경로일 수 있다. 이번엔
  이름 복원으로 하고, 그 API 가 더 정확하면 후속에서 갈아탄다.
- F19: 이 milestone step-2 가 해소한다.
- **재시작 부채**: UD2·UD3 의 도구 표면 변경이 아직 사용자 MCP 에 반영되지 않았다. 이 milestone 은
  부채를 늘리지 않는다.

## 진행 로그 (append-only)

- 2026-07-21 plan 작성 — UD2 완료 후 horizon 닫는 기준 ②(recall@3 ≥85%) 미달을 메우기 위해 개설.
  못 맞히는 5건을 실측 대조해 4건이 "하위법령은 찾고 본법을 못 주는" 같은 유형임을 확인한 것이 근거.
