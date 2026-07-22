# PLAN — AR3 도구 결함 수리

> 생성: 2026-07-22 · 갈래: tooling · 소비 증거: AR2 기준선 · `evidence/bench/2026-07-22-context-effect-probe.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-22 사용자 "ㄱㄱ")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 에이전트가 쓰는 대로 재고, 그 기준으로 올린다 (← `plans/horizons/agentic-reach.md`)
- **milestone**: AR3 — **새 자로 판정해서 고친다.** 프로브가 적발한 실 결함 3종 중 `SR@1`
  (1턴 성공률)을 가장 많이 깎는 것을 골라 수리하고, 교차 A/B 로 채택 판정한다.
  규모 근거: 기여도 프로브·수리·채택 판정이 독립 changeset 3, 통합검증 = 손실 0 AND `SR@1` 순 이득.

## 범위 / 중단점

- execution mode: continuous
- **범위**: `src/` 수정 **허용**(이 horizon 에서 유일). 결함 1~2개 수리.
- **제외**: 3종 전부 수리(기여도가 낮은 것까지 고치면 horizon 이 늘어진다) · 어휘 사전 추가
  (실측으로 무효 판정됨) · 새 도구 추가 · 홀드아웃 개봉(AR4).
- **중단점**: blocked / error / **기여도 프로브에서 3종 다 이득 0** → 미채택으로 닫고 AR4 로 간다
  (TV4 선례 — 미채택도 정상 종료).
- 롤백/정리: `src/` 변경은 changeset 단위로 되돌릴 수 있다. **배포 사본 build + 사용자 재시작 필요.**

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포 `src/`. **⚠ 배포 사본 분리** — `~/projects/custom-mcps/law-mcp/dist/`
  가 실제 실행본이다. 여기서 push → 사본에서 `git pull && npm run build` → **사용자 재시작**.
  소스 수정만 하고 완료 처리 금지(`CLAUDE.md` Gotchas).
- 검증: AR1 하네스로 교차 A/B(3회 반복, `pass@3`·`pass^3`) + 범용 dev 셋 회귀 + 배포본 dist 스모크.
- 배포/운영: **필요.** 완료 보고에서 재시작 부채를 사용자에게 명시한다.

**② 자기선언 도메인**
- **판정 지표는 `SR@1`(1턴 성공률)이다** — 전체 성공률이 아니다. 2턴 걸리는 것은 성공이 아니라
  **마찰**이고, Objective 의 "함정 없음"은 1턴에 닿는가로 재야 한다(horizon 프리모템 ③ 예방).
- **후보 결함 3종**(프로브 적발, 우선순위는 step-1 기여도로 결정):
  ① **본문검색 30건 가나다순 절단** — 맥락 없는 쿼리에서 정답 법령이 풀에 못 들어온다(#13 사인).
  ② **`ai_articles` 가 법령은 맞히고 조문은 놓침** — `국세기본법 기한 후 신고` 가 법은 1위인데
     정답 §45조의3 을 안 줬다.
  ③ **모호함 미고지** — 여러 분야에 걸친 질의임을 도구가 알면서 안 알린다. **거절이 아니라
     모호함의 축을 지목**하는 것이 맞다(식품법은 오답이 아니라 다른 맥락의 정답이었다).
- **서버 instructions 도 후보다** — `src/index.ts:24` 가 비어 있다. AR2 기준선이 박힌 뒤이므로
  이제 넣어도 기준선이 오염되지 않는다(사용자 결정 시 유보한 이유가 해소됨).
- **채택 문턱**: 교차 A/B 에서 **손실 0 AND `SR@1` 순 이득 ≥2**, 3회 반복에서 부호가 뒤집히지
  않을 것. 문턱 미달이면 **미채택**으로 닫고 기록한다(TV4·TV7 선례).
- **하드코딩 금지**: 규칙에 법명·도메인·쿼리 토큰을 박지 않는다(TV4·TV7 DoD 답습). 세법에서만
  듣는 수리는 이 horizon 의 취지(분야 무관 골격)에 반한다.
- 검토 후 제외: 화면·디자인 · 인증 · 데이터 · 관측 · 신규 MCP 도구 · 어휘 사전.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **어휘 사전** — 프로브가 무효를 실증했다(`기한 후 신고` 는
  이미 조문 제목, `불복` 번역은 정답에서 멀어짐).

## 결정 로그

- status: resolved
- **어느 결함을 고치나** → **데이터가 정한다.** step-1 기여도 프로브가 `SR@1` 을 가장 많이 깎는
  것을 지목한다. 사용자 결정 아님.
- **몇 개 고치나** → 확정(2026-07-22 사용자): **1~2개.**
- **서버 instructions 를 넣나** → 후보로 편입. 기준선이 AR2 에서 박히므로 오염 우려는 해소됨.
- 그 외 사용자 소유 결정: 없음. **단 배포·재시작은 사용자 조치**라 완료 보고에서 요청한다.

## Step 트리

- [ ] **step-1** 결함 기여도 프로브
  - Artifact: `evidence/bench/2026-07-22-ar3-contribution.md` — 결함 3종(+instructions) 각각이
    `SR@1` 을 얼마나 깎는지 dev 20건에서 실측. 수리 우선순위 지목
  - Files: write `evidence/bench/2026-07-22-ar3-contribution.md`·`.json`·
    `changesets/20260722-ar3-contribution/README.md` / read AR2 기준선·`src/providers/lawgo-provider.ts`
  - Dependencies: AR2 완료
  - Verify: 3종 각각의 기여도가 수치로 기록됨(이득 0 도 0 으로 기록) + 3회 반복 + `src/` 미변경
  - Failure probe: 3종 다 이득 0 인 경우를 **정상 종료 경로로 처리**한다 — 미채택 기록 후 AR4 로
    간다(TV4 선례). 억지로 고칠 것을 찾지 않는다
  - Commit: `changesets/20260722-ar3-contribution/`
- [ ] **step-2** 최상위 결함 수리
  - Artifact: step-1 이 지목한 결함의 수리 (`src/` 변경) + 배포 사본 build + dist 스모크
  - Files: write `src/`(지목된 파일)·`changesets/20260722-ar3-repair/README.md` /
    read step-1 산출물·`src/providers/lawgo-provider.ts`·`src/ranking-signal.ts`
  - Dependencies: step-1
  - Verify: `npm test` 전건 통과 + 규칙에 법명·도메인·쿼리 토큰 하드코딩 **없음**(grep) +
    상류 실패 시 원상태 반환 + 배포 사본 `npm run build` 성공 + dist 스모크
  - Failure probe: upstream 이 빈 결과·에러를 줄 때 **원래 순서·원래 동작이 보존**되는지 확인
    (수리가 정상 경로를 깨지 않는다)
  - Commit: `changesets/20260722-ar3-repair/`
- [ ] **step-3** 채택 판정
  - Artifact: `evidence/bench/2026-07-22-ar3-verdict.md` — 교차 A/B(수리 전/후, 3회 반복),
    `SR@1`·`pass@3`·`pass^3`·`AT` 대조 + **채택 또는 미채택 판정** + 지연 영향
  - Files: write `evidence/bench/2026-07-22-ar3-verdict.md`·`.json`·
    `changesets/20260722-ar3-verdict/README.md` / read step-2 산출물
  - Dependencies: step-2
  - Verify: **손실 0 AND `SR@1` 순 이득 ≥2** + 3회에서 부호 불변 + 범용 dev `golden-v2` ≥88% +
    지연 증가가 기록됨
  - Failure probe: 문턱 미달이면 **미채택으로 닫고 되돌린다** — 판정을 낮춰 통과시키지 않는다
  - Commit: `changesets/20260722-ar3-verdict/`

## 검증/DoD

- **DoD**: ① 결함 3종(+instructions) 기여도가 이득 0 포함 수치로 기록 ② 수리는 하드코딩 없음
  ③ `npm test` 전건 통과 ④ 상류 실패 시 원상태 보존 ⑤ 교차 A/B 손실 0 AND `SR@1` 순 이득 ≥2,
  3회 부호 불변 ⑥ 범용 dev ≥88% ⑦ 배포 사본 build + dist 스모크 ⑧ **재시작 부채를 완료 보고에
  명시** ⑨ 미달 시 미채택으로 닫고 기록

## hard-stop policy

- 3종 다 이득 0 → **미채택으로 닫고 AR4 로.** 억지 수리 금지.
- 문턱 미달인데 통과시키고 싶어짐 → **금지.** 문턱을 낮추면 이 horizon 이 만든 자가 무의미해진다.
- 홀드아웃을 열어 판정하고 싶어짐 → **금지.** AR4 에서 1회.
- 소스만 고치고 배포·스모크 없이 완료 처리 → **금지**(`CLAUDE.md` Gotchas, RX2 재실험 적발 선례).
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- `src/` 변경은 changeset 단위 revert. 미채택 시 step-2 를 되돌린다.
- 배포 사본은 재 build 로 동기화.

## finding 큐

- 고치지 않기로 한 결함은 여기 — 다음 horizon 의 입력.

## 진행 로그 (append-only)
