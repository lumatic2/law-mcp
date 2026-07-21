# PLAN — TV3 과세연도 축

> 생성: 2026-07-21 · 갈래: tooling · 소비 리서치: `research/2026-07-21-tax-vertical-upstream-probe.md` §2 ·
> `research/2026-07-21-tax-domain-tax-practice-sources.md` §3
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-21 사용자 "응 그렇게 해")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 세법을 끝까지 (← `plans/horizons/tax-vertical.md`)
- **milestone**: TV3 — **이 horizon 의 차별점.** 세법은 "몇 년 귀속이냐"가 곧 답이다. 같은 조문
  번호라도 귀속연도가 다르면 요건이 다르고(이월과세 5년→10년 등), 조세심판원조차 귀속년도를
  사건 식별 1급 메타데이터로 쓴다. 지금 우리는 **항상 현행만 준다** — 2023년 사건에 2026년
  조문을 주면 그냥 틀린 답이다. 확인된 경쟁자 중 이걸 표방한 곳이 없다.
  규모 근거: 시점 조회·표면 전파·연혁 목록·시점 정확도 A/B 가 독립 changeset 4,
  통합검증 = 귀속연도 지정 질의의 시점 정확도.

## 범위 / 중단점

- execution mode: continuous
- **범위**: `eflaw` 시점 조회 경로 신설 + 기존 조문 표면에 시점 인자·시행일자 출하.
- **제외**: 신구법 비교(`oldAndNew` — 별건) · 개정이유 해설 · 시점별 판례 필터 · 해석자료 시점
  필터(TV2 자료는 해석일자를 이미 싣는다).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **`eflaw` 로 특정 연도를 못 집는 법령이 20% 초과** → 범위를 세법 주요 법령으로 좁히고 진행 /
  시점 정확도 A/B 에서 **범용 회귀 발생** → 즉시 정지.
- 롤백/정리: 시점 인자는 **선택 인자**다. 안 주면 기존 동작(현행)이므로 되돌림이 안전하다.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → 배포 사본 `git pull && npm run build`.
  ⚠ **도구 인자와 응답 필드가 늘어난다 → MCP 재시작 필요.**
- 검증: `npm test`(fixture) + 실 API 시점 프로브 + 시점 정확도 러너 + dist 스모크.
- 배포/운영: 도구 개수 불변(11개). 인자는 **선택**이라 기존 호출은 그대로 동작.

**② 자기선언 도메인**
- **무경고 함정 (프리모템 ④ 예방)**: 실측 확인 — `target=law&LM=소득세법&efYd=20230101` 은
  `efYd` 를 **조용히 무시하고 현행(20260101)을 반환**한다. 이걸 모르고 짜면 "시점 지정했는데
  현행 답"이 아무 경고 없이 나간다. **시점 조회는 반드시 `eflaw` 로 간다** — 테스트로 고정.
- **시점 해석 규칙**: 사용자가 주는 것은 보통 *귀속연도*(2023년 귀속)지 시행일자가 아니다.
  귀속연도 → 조회 시행일자 매핑 규칙을 명시한다. 기본: **해당 과세기간 종료일 시점의 시행 법령**.
  ⚠ 이 매핑은 세목마다 다를 수 있다(소득세=역년, 법인세=사업연도). **규칙을 응답에 명시**하고,
  자신 없으면 **거절**한다(추정 금지).
- **조용한 현행 반환 금지**: 요청 시점의 법령을 못 찾으면 현행으로 대체하지 않고 **명시 거절**한다.
  F20 에서 확정한 원칙 — 틀린 답보다 없는 답이 낫다. 닫는 기준 3 이 이걸 0건으로 요구한다.
- **시행일자 상시 출하**: 시점 인자를 **안 줘도** 응답에 `effective_date` 를 싣는다. 지금도
  `search_law` 결과에는 있지만 `get_law_article` 응답에는 없다 — 조문을 인용하는 쪽에 없는 게
  더 위험하다.
- **연혁 접근 경로는 하나뿐**: `lsHistory` HTML · `lsHstInf` 0건 · `eflawJo` 빈 응답 —
  **`eflaw` 검색이 유일한 연혁 목록 경로**다(현행연혁코드로 시행예정/현행/연혁 구분).
- **비용**: 시점 지정 조회는 추가 호출 1(캐시 대상). 시점 미지정 경로는 **호출 증가 0**이어야 한다.
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증 · 관측 · 신규 MCP 도구 · 새 자료원.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **신구법 비교(`oldAndNew`)** — "무엇이 바뀌었나"는 매력적
  이지만 이 milestone 은 "그때 무엇이었나"만 한다. 섞으면 둘 다 반쯤 된다.

## 결정 로그

- status: resolved
- **시점 인자를 필수로 하나** → 확정: **선택.** 필수로 하면 기존 소비처가 전부 깨진다.
- **못 찾으면 현행으로 대체하나** → 확정: **아니오. 명시 거절.**(닫는 기준 3)
- **귀속연도 → 시행일 매핑을 자동 추론하나** → 확정: **규칙을 명시하고, 세목이 모호하면 거절.**
  소득세 등 역년 과세는 규칙이 명확하고, 법인세 사업연도는 사용자가 줘야 안다.
- **연혁 목록을 새 도구로 내나** → 확정: **아니오.** 기존 `search_law` 응답의 확장으로 낸다
  (도구 11개 유지).
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [x] **step-1** 시점 조회 경로 — `eflaw` 로 그때의 조문을 가져온다 + 무경고 함정 차단
  - Artifact: `src/effective-law.ts` — `getLawAsOf(lawName, date)`. `eflaw` 사용 강제,
    `target=law&efYd` 경로 **금지**(사용 시 즉시 실패하는 가드). 못 찾으면 명시 실패
  - Files: write `src/effective-law.ts`·`test/effective-law.test.ts` / read
    `src/providers/lawgo-provider.ts`·`research/2026-07-21-tax-vertical-upstream-probe.md` §2
  - Dependencies: 없음
  - Verify: `npm test` + 실 API 로 소득세법 2023(338조)·2024(341조)·현행(393조)이 **서로 다르게**
    반환되는지 관측 — 조문 수가 같으면 시점이 안 먹은 것이다
  - Failure probe: `target=law&efYd=20230101` 를 직접 호출해 **현행이 조용히 오는 것**을 관측하고,
    우리 경로가 이 함정을 **가드로 막는지** 확인
  - Commit: `changesets/20260721-tv3-effective-law/`
- [x] **step-2** 표면 전파 — 시점 인자 + 시행일자 상시 출하
  - Artifact: `get_law_article`·`search_law` 에 선택 인자 `as_of`(연도 또는 날짜) 추가.
    **모든 조문 응답에 `effective_date` 상시 포함.** 못 맞추면 거절(현행 대체 금지)
  - Files: write `src/index.ts`·`src/providers/lawgo-provider.ts`·`src/types.ts`·
    `test/as-of-surface.test.ts` / read step-1 산출물
  - Dependencies: step-1
  - Verify: `npm test` — 인자 미지정 시 **기존 동작·호출 수 불변**(회귀 고정) + 지정 시 응답의
    `effective_date` 가 요청 시점과 정합 + 거절 경로가 실제로 발화
  - Failure probe: 존재하지 않는 시점(1900년)·미래 과도 시점을 넣어 **조용히 현행이 오지 않고
    거절되는지** 확인 — 닫는 기준 3 의 "조용한 현행 반환 0건"이 여기서 결정된다
  - Commit: `changesets/20260721-tv3-as-of-surface/`
- [x] **step-3** 연혁 목록 — 이 조문이 언제 바뀌었나
  - Artifact: `search_law` 응답에 `history`(시행일자 + 현행연혁코드 + 공포일자) 선택 출하.
    `eflaw` 검색이 유일 경로임을 주석으로 고정
  - Files: write `src/effective-law.ts`·`src/providers/lawgo-provider.ts`·`src/types.ts`·
    `test/law-history.test.ts` / read step-1·step-2 산출물
  - Dependencies: step-1, step-2
  - Verify: `npm test` + 실 API 로 소득세법 연혁이 시행예정/현행/연혁으로 **구분되어** 오는지 관측
  - Failure probe: 연혁이 없는 법령(신규 제정)에서 **빈 배열이 오고 오류가 나지 않는지** 확인
  - Commit: `changesets/20260721-tv3-law-history/`
- [x] **step-4** 시점 정확도 판정 — 채택 여부를 수치로 닫는다
  - Artifact: `bench/tv3-asof.ts` + `evidence/bench/2026-07-21-tv3-asof.md` — TV1 세트의
    `tax_year` 지정 항목에서 **시점 정확도**(반환 조문의 시행일자가 그 연도에 유효한 비율)와
    **조용한 현행 반환 건수**(0 이어야 함). 범용 회귀 동시 측정
  - Files: write `bench/tv3-asof.ts`·`bench/scoring.ts`(시점 축 `n/a` → 실측)·
    `evidence/bench/2026-07-21-tv3-asof.md`·`changesets/20260721-tv3-asof-verdict/README.md`·
    `ROADMAP.md` / read 전 step 산출물
  - Dependencies: step-1, step-2, step-3
  - Verify: 시점 정확도 **100%**(또는 명시 거절) AND 조용한 현행 반환 **0건** AND
    `npm run bench:golden -- --set golden-v2 --split dev` **≥88%** + `npm test` 전건 +
    **배포 사본 build + dist 스모크**
  - Failure probe: 시점 인자를 안 준 경로의 검색 지연이 TV2 대비 **늘지 않았는지** 확인 —
    선택 기능이 기본 경로에 비용을 얹으면 그건 회귀다
  - Commit: `changesets/20260721-tv3-asof-verdict/`

## 검증/DoD

- **DoD**: ① 소득세법 2023/2024/현행이 **서로 다른 조문 집합**으로 반환됨(관측)
  ② `target=law&efYd` 무경고 함정이 **가드로 차단**되고 테스트로 고정
  ③ 시점 인자 미지정 시 기존 동작·호출 수 불변 ④ 모든 조문 응답에 `effective_date` 상시 포함
  ⑤ 못 맞추면 **명시 거절**(조용한 현행 반환 0건) ⑥ 연혁 목록이 시행예정/현행/연혁 구분
  ⑦ 시점 정확도 100% ⑧ 범용 dev 셋 ≥88% ⑨ `npm test` 전건 ⑩ **배포 사본 build + dist 스모크**
  ⑪ 완료 보고에 **MCP 재시작 필요 명시**.

## hard-stop policy

- `eflaw` 로 특정 연도를 못 집는 법령이 20% 초과 → 세법 주요 법령으로 범위 축소 후 진행(기록).
- 조용한 현행 반환이 1건이라도 관측 → 즉시 정지(이 milestone 의 존재 이유가 무너진다).
- 범용 dev 셋 회귀 발생 → 즉시 정지.
- 귀속연도 매핑이 세목별로 갈려 규칙이 안 서면 → **거절 경로로 처리**하고 진행(추정 금지).
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 시점 인자는 선택 — 빼면 기존 동작으로 복귀.
- `effective_date` 상시 출하는 필드 추가 1개.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- `oldAndNew` 신구법 비교(10건 응답 확인) — "무엇이 바뀌었나"는 다음 milestone 후보.

## 진행 로그 (append-only)
