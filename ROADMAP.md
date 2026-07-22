# ROADMAP

> 마지막 업데이트: 2026-07-22
> 상태: **horizon `agentic-reach` 설계(승인 대기)** — 직전 `tax-vertical` 은 2026-07-22 closed.
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `OBJECTIVE.md`)
> line budget: <=150

## Current Horizon

<!-- harness:goal id="agentic-reach" -->
목표: **우리 벤치는 사람이 라벨 문자열을 던진다고 가정한다. 실제 소비자는 맥락을 가진 에이전트다.**
그 간극을 없애고 새 자로 잰 값을 올린다 — `recall@3`(단발 도달)에서 **도달 턴수 + 정직한 실패**로.
(상세 plan → `plans/horizons/agentic-reach.md` · 예상 분량 ~11 changeset · 후보 백로그 → `plans/horizons/CANDIDATES.md`)

직전 horizon `tax-vertical` 은 2026-07-22 closed (닫는 기준 6종 중 5종 충족, recall@3 75.0% 미달).
닫은 뒤 프로브가 밝힌 것: 미달의 상당 부분이 **측정 방식 탓**이었다 — MISS 5건에 분야 맥락 한 단어를
얹자 5/5 정답 조문까지 도달했다(`evidence/bench/2026-07-22-context-effect-probe.md`).

## Active Milestones

<!-- harness:milestone id="AR1" status="pending" priority="P0" -->
### AR1 — 에이전트형 평가 하네스
- DoD: 맥락→에이전트 루프가 트래젝토리를 남기며 완주. 채점기에 **LLM 호출 0개**, 같은 로그 2회 채점
  결과 동일. 조문번호까지 일치해야 성공(법령만 맞으면 오답). `pass@3`·`pass^3`·범위 동시 출력,
  하나라도 빠지면 거부. 단일 반복 입력 거부. `AT`·`SR@t`·기권 정밀도/재현율 출력. 1케이스 비용 실측.
  에이전트 모델 ID 기록. `git diff --stat src/` 0 줄.
- Evidence: `plans/2026-07-22-ar1-agentic-harness.md` · `evidence/bench/2026-07-22-ar1-cost.md`
- Gap: `bench/run.ts:140` 이 라벨 문자열을 맥락 없이 한 번 던지고 채점한다. 도구가 응답에 실어 보내는
  "쿼리를 좁혀 다시 물을 것" 경고를 **소비하는 층이 벤치에 없다.**
- Scale: changesets>=3; surfaces: 루프 러너·결정적 채점기·신뢰도 보고; capability: 에이전트가 쓰는
  대로 재고, 그 값을 재현할 수 있다
- Status: [ ]

<!-- harness:milestone id="AR2" status="pending" priority="P0" -->
### AR2 — 맥락 세트 + 기준선
- DoD: dev 20건 맥락 부착, 전건 유출 탐지기 통과. **일부러 유출시킨 문단은 거부**됨. 기권 케이스 포함·
  별도 분류. 새 홀드아웃 봉인(플래그 없이 exit 1). 기준선에 `pass@3`·`pass^3`·범위·`AT`·`SR@t`·
  기권 정밀도/재현율 전부 포함. **단발 75% 대비 대조표.** 범용 dev ≥88%. 기준선 100% 아님(변별력 존재).
- Evidence: `plans/2026-07-22-ar2-context-set.md` · `evidence/bench/2026-07-22-ar2-baseline.md`
- Gap: 구 홀드아웃은 소진됐고, 맥락을 가진 케이스가 아예 없다. 맥락을 사람이 쓰면 정답이 새어 벤치가
  낙관적으로 왜곡된다(리서치 실측: 유출 완화 전후 24.2%→45.3%).
- Scale: changesets>=3; surfaces: 유출 탐지기·맥락 세트·홀드아웃 봉인·기준선 보고서; capability:
  자에 눈금이 생긴다 — 무엇이 좋아졌는지 말할 수 있다
- Status: [ ]

<!-- harness:milestone id="AR3" status="pending" priority="P1" -->
### AR3 — 도구 결함 수리
- DoD: 결함 3종(+서버 instructions) 기여도가 **이득 0 포함** 수치로 기록. 수리에 법명·도메인·쿼리
  토큰 하드코딩 없음. `npm test` 전건 통과. 상류 실패 시 원상태 보존. 교차 A/B **손실 0 AND `SR@1`
  순 이득 ≥2**, 3회 부호 불변. 범용 dev ≥88%. 배포 사본 build + dist 스모크. **재시작 부채 명시.**
- Evidence: `plans/2026-07-22-ar3-defect-repair.md` · `evidence/bench/2026-07-22-ar3-verdict.md`
- Gap: 프로브가 적발한 실 결함 3종 — ① 본문검색 30건 가나다순 절단 ② `ai_articles` 가 법령은 맞히고
  조문은 놓침 ③ 모호한 질의임을 알면서 안 알림. 어느 것이 `SR@1` 을 얼마나 깎는지는 **아직 모른다.**
- Scale: changesets>=3; surfaces: 기여도 프로브·`src/` 수리·교차 A/B; capability: 1턴에 닿는다
- Status: [ ]

<!-- harness:milestone id="AR4" status="pending" priority="P0" -->
### AR4 — 판정
- DoD: 새 홀드아웃 blind 1회 개봉(**≥5회 반복**). 닫는 기준 6종 `선언/실측/판정` 대조표. 프리모템
  5종 발화 대조. 크기 회고(선언 ~11 / 실측 M). 범용 dev ≥88%. `git diff --stat src/` 0 줄. 봉인이
  플래그 없이 여전히 거절. **실 MCP 표면에서 인용 체인 관측.** 미달은 미달로 기록.
- Evidence: `plans/2026-07-22-ar4-verdict.md` · `evidence/bench/2026-07-22-ar4-holdout.md` ·
  `archive/reports/2026-07-22-ar4-agentic-reach-close.md`
- Gap: dev 수치는 튜닝 대상이라 과적합을 판정하지 못한다. 직전 두 horizon 에서 이 규율이 판정을
  살렸다(93.3% > 88.0% 로 과적합 기각 / 75% 미달을 미달로 기록).
- Scale: changesets>=2; surfaces: 홀드아웃 러너·실 MCP 표면 E2E; capability: 이 자를 닫을 수 있는지
  판정한다
- Status: [ ]

## Next Candidates

후보 백로그 정본 → `plans/horizons/CANDIDATES.md` (순서는 사용자 소유).
요약: 다음 분야 vertical(노동·부동산) · 서버 instructions(AR3 후보로 편입) · 남은 upstream 자료원 ·
위임조문 지연(3.3초) · 공개 배포·발견성.

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
