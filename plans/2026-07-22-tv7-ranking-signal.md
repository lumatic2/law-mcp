# PLAN — TV7 순위 신호

> 생성: 2026-07-22 · 갈래: tooling · 소비 증거: `research/2026-07-22-tv7-aisearch-ranking-probe.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: approved (2026-07-22 사용자 "ㄱㄱ")

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 세법을 끝까지 (← `plans/horizons/tax-vertical.md`)
- **milestone**: TV7 — TV4 가 판정한 진짜 결함을 친다. **도달은 고쳤는데 순위가 안 움직였다** —
  순위를 정하는 신호가 법령명 문자열뿐이라, 이름과 글자를 공유하지 않는 정답(`수정신고`→
  `국세기본법`)은 후보에 들어와도 밀린다. TV4 는 조문제목이 옳은 신호임을 확인했지만
  **싸게 얻을 경로가 없어**(전문 771KB·1.1초) 미채택으로 닫았다.
  `aiSearch` 는 **이미 조문 단위 순위와 조문제목을 주고 검색과 병렬로 이미 호출 중이라 추가
  비용이 0** 이다. 프로브 실측: 정답 법이 `display=30` 안에 **30/30** 존재.
  규모 근거: 신호 추출·재정렬·채택 판정이 독립 changeset 3, 통합검증 = 교차 A/B 손실 0 + 순 이득.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 후보 **재정렬**만. 응답 스키마 변경 없음, 도구 description 변경 없음
  (**MCP 재시작을 새로 요구하지 않는다**).
- **제외**: 새 자료원 · 시점 축(TV3) · 별표(TV5) · 홀드아웃 개봉(TV6) ·
  **`aiSearch` 로 파이프라인 대체**(프로브가 기각 — 자체 상위3 76.7% < 현행 83.3%).
- **중단점**: blocked / error / decision_required / risk_gate(실 API rate limit) /
  **교차 A/B 순 이득 <2 → 미채택 후 기록·정지** / **손실 ≥1 → 재설계 1회 후에도 안 되면 정지**.
- 롤백/정리: 재정렬은 후처리 1단계 — 끄는 지점 1곳.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포. 배포는 push → 배포 사본 build. **응답 스키마·description 불변 →
  MCP 재시작 불요.**
- 검증: `npm test` + `bench/ud2-ab.ts --variants` **교차 A/B**(드리프트 방어) + `bench:golden`
  양 세트 + dist 스모크.
- 배포/운영: 도구 개수·스키마 불변. 사용자 조치 불요.

**② 자기선언 도메인**
- **왜 이번엔 다른가**: TV4 는 신호를 **사려고** 했고(전문 771KB) 비용에 막혔다. TV7 은 **이미
  산 신호를 안 쓰고 있던 것**을 쓴다 — `aiSearch` 는 이미 호출되고 있고 응답에 `조문제목`·
  `순위`가 들어 있는데 우리는 "상위 N 법 승격"에만 쓰고 버렸다.
- **신호 설계**: ① **존재·순위** — 후보 법이 aiSearch 결과 안에 있나, 몇 위인가
  ② **조문제목 대조** — aiSearch 가 준 조문제목과 쿼리 대조(TV4 의 `scoreArticleTitles` 재사용,
  추가 호출 0). 두 신호를 **우리 후보 풀의 재정렬 키**로 쓴다.
- **대체하지 않는다**: aiSearch 자체 순서는 76.7% 로 현행 83.3% 보다 나쁘다. 순서를 그대로
  믿으면 맞히던 것을 깬다 — 그래서 *신호로만* 쓰고 최종 순서는 우리가 정한다.
- **과적합 방어 (F5)**: 재정렬 규칙에 **법명·도메인·쿼리 토큰 하드코딩 금지**. 선례
  `src/parent-law.ts`·`src/article-title-signal.ts` 와 같은 규율(테스트로 고정).
- **비용 예산**: 추가 **HTTP 호출 0**(이미 부르는 호출의 `display` 만 10→30). 검색 1회 지연이
  TV4 기본 상태 대비 **+200ms 를 넘지 않아야** 한다. 넘으면 `display` 를 낮추거나 미채택.
- **판정 방식**: UD2·UD4·TV4 와 동일 — **쿼리마다 배치를 연달아 재는 교차 측정**(F13).
  채택 조건 = **손실 0 AND 순 이득 ≥2**. 손실 0 은 낮추지 않는다.
- **실패 흡수**: `lookupAiSearch` 는 모든 실패를 빈 결과로 흡수한다 — 신호가 없으면
  **재정렬하지 않고 원래 순서 그대로**(TV4 에서 세운 규약과 동일).
- 검토 후 제외: 화면·디자인 · 데이터 스토어 · 인증 · 관측 · 신규 도구 · 응답 스키마 ·
  새 자료원 · 크레덴셜(기존 `LAW_API_OC` 그대로).

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **응답 스키마** — 필드를 추가하고 싶어지면 그건 TV7 이 아니다.

## 결정 로그

- status: resolved
- **`aiSearch` 로 파이프라인을 대체하나** → 확정: **아니오.** 프로브 실측 76.7% < 83.3%.
- **`display` 를 얼마로 올리나** → 확정: **30.** 정답 존재율이 10→28/30, 30→30/30.
  비용은 추가 호출 0(같은 호출의 파라미터)이며 지연은 step-1 에서 잰다.
- **채택 문턱** → 확정: **손실 0 AND 순 이득 ≥2**(UD4·TV4 선례).
- **이득이 없으면** → 확정: **미채택하고 기각 근거를 남긴다.** TV4 처럼 정상 종료다.
- **TV4 의 조문제목 신호(전문 조회)를 되살리나** → 확정: **아니오.** 비용으로 산 이득은 안 산다.
  aiSearch 가 같은 값을 무료로 준다.
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** aiSearch 신호 확장 — 순위·조문제목을 재정렬용으로 꺼낸다
  - Artifact: `src/ai-search.ts` 의 `display` 를 30 으로 올리고, 법령 단위 신호
    (`bestRank`·조문제목 목록)를 재정렬이 쓸 수 있게 노출. 지연 실측 기록
  - Files: write `src/ai-search.ts`·`test/ai-search.test.ts` /
    read `research/2026-07-22-tv7-aisearch-ranking-probe.md`·`src/article-title-signal.ts`
  - Dependencies: 없음
  - Verify: `npm test` — 키 핀 고정 유지 · `display=30` 반영 확인 +
    검색 1회 지연이 TV4 기본 대비 **+200ms 이내**임을 실 API 로 실측
  - Failure probe: `aiSearch` 가 빈 결과·타임아웃일 때 **기존 순위 그대로** 나가는지 확인
  - Commit: `changesets/20260722-tv7-aisearch-signal/`
- [ ] **step-2** 후보 재정렬 — 존재·순위·조문제목을 우리 풀에 적용한다
  - Artifact: `src/ranking-signal.ts` — aiSearch 신호로 후보 재정렬. **aiSearch 순서로
    대체하지 않는다.** 법명·도메인·토큰 하드코딩 없음. 기본 꺼짐(A/B 로 켠다)
  - Files: write `src/ranking-signal.ts`·`test/ranking-signal.test.ts`·
    `src/providers/lawgo-provider.ts` / read `src/ai-search.ts`·`src/article-title-signal.ts`
  - Dependencies: step-1
  - Verify: `npm test` — 하드코딩 부재·신호 없을 때 순서 보존을 테스트로 고정 +
    `npx tsx bench/ud2-ab.ts --set golden-tax --split dev --variants tv7` 교차 A/B
  - Failure probe: aiSearch 가 정답을 **안 준 쿼리**(프로브의 2/30)에서 기존 순위가
    깨지지 않는지 확인 — 신호가 없을 때 조용히 나빠지면 안 된다
  - Commit: `changesets/20260722-tv7-ranking-rerank/`
- [ ] **step-3** 채택 판정 — 손실 0 AND 순 이득 ≥2 아니면 되돌린다
  - Artifact: `evidence/bench/2026-07-22-tv7-verdict.md` — 교차 A/B(세법 dev + 범용 dev),
    지연, 채택/기각 근거. 기각이면 **되돌린 상태로 커밋**
  - Files: write `evidence/bench/2026-07-22-tv7-verdict.md`·
    `changesets/20260722-tv7-verdict/README.md`·`ROADMAP.md` / read 전 step 산출물
  - Dependencies: step-1, step-2
  - Verify: 교차 A/B **손실 0 AND 순 이득 ≥2** + `--set golden-v2 --split dev` **≥88%** +
    `npm test` 전건 + **배포 사본 build + dist 스모크**
  - Failure probe: 되돌림 경로를 실제로 실행해 **TV4 종료 상태로 정확히 복귀**하는지 확인
  - Commit: `changesets/20260722-tv7-verdict/`

## 검증/DoD

- **DoD**: ① 재정렬 규칙에 법명·도메인·쿼리 토큰 하드코딩 없음(테스트 고정)
  ② **추가 HTTP 호출 0** ③ aiSearch 실패·빈 결과 시 원래 순서 보존(테스트 고정)
  ④ 세법 dev 교차 A/B **손실 0 AND 순 이득 ≥2** ⑤ 범용 dev 셋 **≥88%**
  ⑥ 검색 지연 TV4 기본 대비 **+200ms 이내** ⑦ `npm test` 전건
  ⑧ **배포 사본 build + dist 스모크** ⑨ 응답 스키마·도구 개수 불변(재시작 불요).
- **이득이 없으면**: 되돌리고 기각 근거를 evidence 에 남긴다 — 정상 종료다(TV4 선례).

## hard-stop policy

- 교차 A/B 순 이득 <2 → 미채택, 되돌림 후 정지·보고.
- 손실 ≥1 → 재설계 1회 후에도 안 되면 정지·보고.
- 추가 HTTP 호출이 필요해져야만 이득이 남 → **미채택**(그건 TV4 가 이미 기각한 경로다).
- 홀드아웃 개봉 **금지** — TV6 소관.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 재정렬: 후처리 1단계 — 끄면 TV4 종료 상태로 복귀.
- `display` 30→10: 상수 1곳.
- step 별 독립 커밋 — 회귀 시 해당 커밋만 revert.

## finding 큐

- F5(과적합): 세법 dev 30 에 맞춘 규칙이 holdout 20 에서 무너질 수 있다 — TV6 이 판정한다.
- 조문 정확도: aiSearch 의 정답 법 최상위 조문이 라벨과 맞는 비율이 20/30 이었다. 조문 축까지
  손댈지는 이 milestone 범위 밖 — 결과를 보고 TV6 전에 판단.

## 진행 로그 (append-only)
