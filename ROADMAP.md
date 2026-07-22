# ROADMAP

> 마지막 업데이트: 2026-07-22
> 상태: **horizon `tax-vertical` 실행 중** — 승인 2026-07-21, TV1~TV5·TV7 완료 (6/7) — 남은 것은 TV6 판정.
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `OBJECTIVE.md`)
> line budget: <=150

## Current Horizon

<!-- harness:goal id="tax-vertical" -->
목표: **넓이를 1%p 씩 미는 대신 한 분야를 끝까지 판다. 첫 분야는 세법.**
답의 단위를 조문 하나에서 **인용 체인**(조문 + 그 연도의 시행일자 + 예규 + 심판례)으로 옮긴다.
(상세 plan → `plans/horizons/tax-vertical.md` · 예상 분량 ~18 changeset)

직전 horizon `upstream-delivery` 는 2026-07-21 closed (recall@3 76% → 홀드아웃 93.3%).
그 축은 수확체감이다 — 행정 도메인 A/B 는 **이득 0 / 손실 0** 이었다.

## Active Milestones

<!-- harness:milestone id="TV1" status="completed" priority="P0" evidence="evidence/bench/2026-07-21-tv1-tax-baseline.md" -->
### TV1 — 세법 평가 세트
- DoD: `bench/golden-tax.json` dev 30 / holdout 20, 유형당 ≥5, 전건 정답 조문이 실 API 조회로
  존재 확인. 홀드아웃이 개봉 플래그 없이 exit 1 거절. 조문 정확도 채점축 반영. dev 기준선이
  n=3 표준편차·유형별 분해와 함께 기록. `src/` diff 0 줄.
- Evidence: `changesets/20260721-tv1-golden-tax` · `changesets/20260721-tv1-tax-scoring` ·
  `changesets/20260721-tv1-tax-baseline` · `evidence/bench/2026-07-21-tv1-tax-baseline.md` ·
  `npx tsx bench/verify-labels.ts --set golden-tax` · plan `plans/2026-07-21-tv1-tax-eval-set.md`
- Gap: 홀드아웃 15건은 직전 horizon close 에서 소진됐고 세법 전용 라벨은 애초에 없다. 세트 없이
  TV2~TV5 를 채택하면 그게 F5 과적합이다(행정 진단이 이미 이 이유로 멈췄다).
- Scale: changesets>=3; surfaces: 라벨 검증기·벤치 러너·기준선 보고서; capability: 세법 품질을
  과적합 없이 판정할 수 있다
- Status: [x]

- Completed at: 2026-07-21
- Summary: 세법 평가 세트 dev30/holdout20 + 채점축 + 기준선 recall@3 83.3%(n=3, σ0.0%p)
<!-- harness:milestone id="TV2" status="completed" priority="P0" evidence="changesets/20260721-tv2-tribunal-adapter · changesets/20260721-tv2-rulings-adapter · changesets/20260721-tv2-authority-grade · changesets/20260721-tv2-contribution · evidence/bench/2026-07-21-tv2-contribution.md" -->
### TV2 — 심판례·예규 편입
- DoD: 조세심판원·국세청 예규가 `source` enum 에서 조회 가능하고 전문(재결요지·이유) 도달.
  해석자료 응답 100% 에 `authority` 구속력 등급 + `data_as_of`. 대표 질의 도달률 ≥70%.
  범용 dev 셋 ≥88%. 도구 개수 11 불변. 배포 사본 dist 스모크.
- Evidence: changesets/20260721-tv2-tribunal-adapter · changesets/20260721-tv2-rulings-adapter · changesets/20260721-tv2-authority-grade · changesets/20260721-tv2-contribution · evidence/bench/2026-07-21-tv2-contribution.md
  plan `plans/2026-07-21-tv2-tribunal-and-rulings.md`
- Gap: 세법 실무의 답이 나오는 층이 통째로 비어 있다 — 조세심판원 4,688건·국세청 예규 1,938건이
  실측으로 열려 있는데 enum 14종에 둘 다 없다(선행 조사가 target 어순을 뒤집어 "없음"으로 적었다).
- Scale: changesets>=4; surfaces: source-adapter·MCP enum·구속력 등급·기여도 게이트;
  capability: 법령 밖 해석자료를 구속력 등급과 함께 준다
- Status: [x]

- Completed at: 2026-07-21
- Summary: 조세심판원 4688건·국세청 예규 1938건 편입, 구속력 등급 100% 표기, 도달 100%
<!-- harness:milestone id="TV3" status="completed" priority="P0" evidence="changesets/20260721-tv3-effective-law · changesets/20260721-tv3-as-of-surface · changesets/20260721-tv3-law-history · changesets/20260721-tv3-asof-verdict · evidence/bench/2026-07-21-tv3-asof.md" -->
### TV3 — 과세연도 축
- DoD: 소득세법 2023/2024/현행이 서로 다른 조문 집합으로 반환. `target=law&efYd` 무경고 함정이
  가드로 차단. 시점 인자 미지정 시 기존 동작·호출 수 불변. 모든 조문 응답에 `effective_date`.
  못 맞추면 명시 거절 — **조용한 현행 반환 0건**. 시점 정확도 100%. 범용 dev 셋 ≥88%.
- Evidence: changesets/20260721-tv3-effective-law · changesets/20260721-tv3-as-of-surface · changesets/20260721-tv3-law-history · changesets/20260721-tv3-asof-verdict · evidence/bench/2026-07-21-tv3-asof.md
  plan `plans/2026-07-21-tv3-tax-year-axis.md`
- Gap: 세법은 "몇 년 귀속이냐"가 곧 답인데 우리는 항상 현행만 준다. 확인된 경쟁자 중 귀속연도
  인식을 표방한 곳이 없다 — 이 horizon 의 차별점.
- Scale: changesets>=4; surfaces: eflaw 조회 경로·MCP 도구 인자·연혁 목록·시점 정확도 러너;
  capability: 그 해에 유효했던 조문을 준다
- Status: [x]

- Completed at: 2026-07-22
- Summary: as_of 시점 조회 + effective_date 상시 출하 + 연혁, 시점 정확도 100%/조용한 현행 0건
<!-- harness:milestone id="TV4" status="completed" priority="P1" evidence="changesets/20260721-tv4-article-title-signal · changesets/20260721-tv4-body-pool · changesets/20260721-tv4-verdict · evidence/bench/2026-07-22-tv4-verdict.md" -->
### TV4 — 세법 도달 결함 수리
- DoD: 조문제목 신호에 법명·도메인·쿼리 토큰 하드코딩 없음. 추가 전문 조회 ≤3/검색. 상류 실패 시
  원상태 반환. 절단 경고 발화. `세금계산서 지연발급 가산세` → 부가가치세법 도달.
  교차 A/B **손실 0 AND 순 이득 ≥2**. 범용 dev 셋 ≥88%. 스키마·도구 불변(재시작 불요).
- Evidence: `evidence/bench/2026-07-22-tv4-verdict.md` · plan `plans/2026-07-21-tv4-reachability.md`
- Gap: 본문검색은 가나다순인데 앞 30건만 받아 뒷글자 법령(부가가치세법)이 구조적으로 탈락한다.
  행정 진단이 규명했으나 **평가 세트가 없어** 채택을 못 하고 멈춘 건 — TV1 이 전제조건을 채운다.
- Scale: changesets>=3; surfaces: 조문제목 신호·본문검색 풀·교차 A/B; capability: 후보 풀에
  못 들어와 못 찾던 법을 찾는다
- 판정: **재정렬·풀 확대 미채택**(순 이득 0, 재정렬은 손실 1). 절단은 실재했으나
  (도달 19/30 → 29/30) recall@3 은 80.0% 그대로 — **정답이 후보에 들어와도 위로 못 올라온다.**
  남은 결함은 도달이 아니라 **순위 신호**이며 다음 milestone 의 입력이다.
  출하된 것은 순위가 아닌 정직성 둘: `totalCnt` 오독 수정 · 절단 경고.
- Status: [x]

- Completed at: 2026-07-22
<!-- harness:milestone id="TV7" status="completed" priority="P0" evidence="changesets/20260722-tv7-aisearch-signal · changesets/20260722-tv7-ranking-rerank · changesets/20260722-tv7-verdict · evidence/bench/2026-07-22-tv7-verdict.md" -->
### TV7 — 순위 신호
- DoD: 재정렬 규칙에 법명·도메인·쿼리 토큰 하드코딩 없음. **추가 HTTP 호출 0**. aiSearch 실패·
  빈 결과 시 원래 순서 보존. 세법 dev 교차 A/B **손실 0 AND 순 이득 ≥2**. 범용 dev 셋 ≥88%.
  지연 TV4 기본 대비 +200ms 이내. 스키마·도구 불변(재시작 불요).
- Evidence: `evidence/bench/2026-07-22-tv7-verdict.md` · plan `plans/2026-07-22-tv7-ranking-signal.md`
- Gap: TV4 가 판정한 진짜 결함 — 도달은 고쳤는데 순위가 안 움직였다. 순위 신호가 법령명
  문자열뿐이라 이름과 글자를 안 나누는 정답이 밀린다. `aiSearch` 가 조문제목·순위를 **추가 비용
  0** 으로 이미 주는데 안 쓰고 있었다(프로브: 정답 법이 display=30 안에 30/30 존재).
- Scale: changesets>=3; surfaces: aiSearch 신호 추출·후보 재정렬·교차 A/B; capability: 이름이
  안 걸리는 정답을 위로 올린다
- 판정: **채택** — 세법 dev recall@3 80.0% → **86.7%**(이득 2·손실 0, 2회 동일), 범용 교차 A/B
  손실 0. 추가 HTTP 호출 0·지연 증가 없음. TV4 가 못 산 신호를 **이미 사 놓고 안 쓰던 곳**에서 꺼냈다.
- Status: [x]

- Completed at: 2026-07-22
<!-- harness:milestone id="TV5" status="completed" priority="P2" evidence="changesets/20260722-tv5-article-body-loss · changesets/20260722-tv5-verdict · evidence/bench/2026-07-22-tv5-verdict.md" -->
### TV5 — 조문 본문 유실 수리 (구 "세율표(별표)")
- DoD: 세율 질의에서 별표 메타(별표명·번호·링크) 도달, 별표 없는 법령에서 무오류, 추가 호출 ≤1.
  추출 스파이크 결과가 **채택이든 기각이든** 수치로 기록. 채택 시 성공률 ≥70%·지연 ≤3초·
  부분 표 미출하. 범용 dev 셋 ≥88%.
- Evidence: `evidence/bench/2026-07-22-tv5-verdict.md` · plan `plans/2026-07-22-tv5-article-body-loss.md`
- Gap: 세법의 실제 숫자를 못 준다. **원 전제(별표·licbyl·PDF)는 실측으로 반증** —
  세율표는 우리가 이미 받는 JSON 전문 안에 있었고 우리 추출기가 버리고 있었다.
- Scale: changesets>=2; surfaces: 조문 본문 추출·전문 조회 캐시; capability: 세율표에 닿는다
- 판정: **채택** — `소득세법 제55조` 본문 251자 → **1596자**(세율표 도달), 회귀 없음
  (범용 88.0%·세법 83.3%). 순수 추가 지연 +263ms. `as_of` 와 함께 그 시점 판 세율표가 나온다.
- Status: [x]

- Completed at: 2026-07-22
<!-- harness:milestone id="TV6" status="completed" priority="P0" evidence="archive/reports/2026-07-21-tv6-tax-vertical-close.md" -->
### TV6 — 세법 판정
- DoD: 홀드아웃 20건 blind 1회 개봉. 닫는 기준 6종 `선언/실측/판정` 대조표. 프리모템 5종 발화
  대조. 크기 회고(선언 ~18 / 실측 M). 범용 dev 셋 ≥88%. `git diff --stat src/` 0 줄. 봉인이
  플래그 없이 여전히 거절. **실 MCP 표면에서 인용 체인 관측.** 미달은 미달로 기록.
- Evidence: archive/reports/2026-07-21-tv6-tax-vertical-close.md
  `archive/reports/2026-07-21-tv6-tax-vertical-close.md` · plan `plans/2026-07-21-tv6-verdict.md`
- Gap: dev 수치는 튜닝 대상이라 과적합을 판정하지 못한다. 직전 horizon 에서 이 규율이 close 판정을
  살렸다(홀드아웃 93.3% > dev 88.0%).
- Scale: changesets>=2; surfaces: 홀드아웃 러너·실 MCP 표면 E2E; capability: 이 분야를 닫을 수
  있는지 판정한다
- Status: [x]

- Completed at: 2026-07-22
- Summary: 기준 5/6 충족, 회귀 0. 기준 #2(recall@3 ≥90%) 미달(75.0%) 명시 기록.
## Next Candidates

- 다음 분야 vertical(노동·부동산) — 세법에서 만든 골격("법령 + 구속력 등급 해석자료 + 시점축")을
  복제. **세법 close 이후 사용자 결정.**
- `oldAndNew` 신구법 비교 · `admbyl` 행정규칙 별표 · `lsStmd` 법령체계도 · `dlytrm` 재평가
- 남은 빈 응답 target(`lsRlt`·`couseLs`·`drlaw`) **어순 재확인** — 이번 프로브에서 어순 오류가
  3건 확인됐다(`specialDeccTt`→`ttSpecialDecc`, `cgmExpc{코드}`→`ntsCgmExpc`).

**범위 밖(사용자 발화가 착수 신호)**: 공개 배포 · npm · 발견성.

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다.
milestone 완료·compact·horizon close 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-21: 전수 조사를 **선행**해 horizon 을 연다. 직전 두 horizon 은 착수 후에 "이미 있는
  upstream 기능"을 발견했고, 그 부채를 조사로 갚은 뒤 horizon 을 열었다.
- 2026-07-21: 홀드아웃 봉인을 **코드로 강제**한 것(`assertHoldoutSeal`)이 close 판정을 살렸다 —
  홀드아웃 93.3% > dev 88.0% 로 과적합을 기각했다. 다음 세트도 같은 방식으로 봉인한다.
- 2026-07-21: 넓이 대신 **분야 깊이**로 축을 바꾼다. 근거 = 행정 A/B 이득 0(랭킹 수확체감) vs
  세법의 미연결 자료원 실측(심판례 4,688 · 예규 1,938 · 과거 시점 조문).
