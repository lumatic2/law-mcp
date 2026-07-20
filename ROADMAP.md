# ROADMAP

> 마지막 업데이트: 2026-07-21
> 상태: horizon `upstream-delivery` 개설 — UD1 착수 예정
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `OBJECTIVE.md`)
> line budget: <=150

## Current Horizon

<!-- harness:goal id="upstream-delivery" status="active" -->
### 법제처가 가진 능력을 그대로 전달 → `plans/horizons/upstream-delivery.md`
축 전환: "우리가 랭킹을 만든다" → "upstream 이 가진 것을 손실 없이 전달한다". 근거는 전수 조사
(`research/2026-07-21-lawgo-api-survey.md`) — 법제처 `aiSearch` 가 무튜닝 dev 92% 로 우리 튜닝
76% 를 이기고 조문까지 준다. 우리가 쓰는 것 8종 / 문서가 나열하는 것 191건.
무감독 분량: 최소 3 무감독 세션. 공개 배포·npm 은 범위 밖(착수 신호는 사용자 발화).

(직전 horizon `general-legal-coverage` 완료 2026-07-21 — LB1·LB2·LB3·LB5. 정답 포함률 31%→76%,
법원 5종 도구화. 닫는 기준 4개 중 3개 달성, 미달 1개(조문 축)는 이 horizon 으로 이관.
상세는 `archive/horizons/general-legal-coverage.md` · `docs/BACKLOG.md`)

## Active Milestones

<!-- harness:milestone id="UD1" status="pending" priority="P0" evidence="" -->
### UD1 — 측정 기반 재건
- DoD: 신규 평가 세트 40건(dev 25/holdout 15)이 실 API 근거로 라벨링되고, 러너가 반복 측정
  신뢰구간을 출력하며, 홀드아웃 봉인이 **코드로 강제**된다. 신 세트 dev 기준선이 σ 와 함께 기록되고
  이후 A/B 채택 문턱(2σ)이 수치로 확정된다. `src/` 무변경.
- Evidence: (실행 시 기록)
- Gap: 홀드아웃 15건은 LB5 에서 소진·은퇴했고 측정 노이즈(±1건, 4%p)가 정량화되지 않았다.
  이 상태로는 다음 개선이 진짜인지 판정할 수 없다 (F3 + LB5 홀드아웃 판정서)
- Scale: changesets>=3; surfaces: bench 러너·실 API·npm test; capability: 개선을 판정할 수 있다
- Plan: `plans/2026-07-21-ud1-measurement-rebuild.md`
- Status: [ ]

<!-- harness:milestone id="UD2" status="pending" priority="P0" evidence="" -->
### UD2 — `aiSearch` 편입 + A/B 판정
- DoD: dev A/B 에서 `aiSearch` 병합이 **2σ 초과** 상승 + **새로 깨지는 쿼리 0** + 쿼리 단위 승패 표
  + `aiSearch` 장애 시 graceful degrade(테스트 고정) + 조문이 **제품 응답으로 출하**되고 그 정확도가
  제품 경로 기준으로 측정됨(F4 해소) + 추가 호출 ≤1 · 지연 ≤3초 + 배포 사본 build + 실 MCP 스모크.
- Evidence: (실행 시 기록)
- Gap: 관련도 랭킹이 있는 엔드포인트가 따로 있었는데 5 milestone 동안 몰랐다. 92% vs 76% 격차이고
  응답이 조문 단위다 (research 2026-07-21 §★)
- Scale: changesets>=4; surfaces: 검색 후보 생성·MCP 응답 스키마·bench·실 MCP; capability: upstream 최선 경로로 답한다
- Plan: `plans/2026-07-21-ud2-aisearch-adoption.md`
- Status: [ ]

<!-- harness:milestone id="UD3" status="pending" priority="P1" evidence="" -->
### UD3 — 미접근 자료원 흡수 (위원회 결정문 + 위임조문)
- DoD: 위원회 결정문이 실 API 도달 + descriptor 마다 조회 파라미터가 테스트로 고정 +
  `get_law_article` 이 위임 하위 조문을 함께 반환 + **도구 표면 증가 ≤1** + 자료원별 대표 쿼리
  기여도 표 제시(미도달 자료원 미등록) + 배포 사본 build + 실 MCP 스모크.
- Evidence: (실행 시 기록)
- Gap: 노동위원회 판정 39,363건이 통째로 사각지대다 — 노동 도메인 저점수의 원인이 용어 갭만이
  아니라 자료원 부재였다. `lsDelegated` 위임 점프도 미사용 (research 2026-07-21 §A-1·§A-2)
- Scale: changesets>=3; surfaces: source descriptor·MCP 도구·실 API·npm test; capability: 랭킹으로 못 메우는 갭을 자료원으로 메운다
- Plan: `plans/2026-07-21-ud3-untapped-sources.md`
- Status: [ ]

## Next Candidates
- `dlytrm` 일상용어 재평가 (LB5 제외 근거가 부분적이었음 — 검색은 정상, 관계 조회만 불안정)
- `specialDeccTt` 조세심판원 파라미터 재확인 (이 레포 최초 소비처와 직결)
- `eflaw` 시행일 법령 · 별표 3종 · `lsStmd`/`thdCmp` 법령 관계도

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다. milestone 완료·compact 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-12: 첫 실 horizon 은 ai-accounting-firm issue-back 수리로 개설 (kifrs-rag 선례 준용 —
  새 horizon 은 사용처 결함만 입력으로 연다).
- 2026-07-21: 전수 조사를 **선행**해 horizon 을 연다. 직전 두 horizon 은 착수 후에 "이미 있는
  upstream 기능"을 발견했고(LB3 법원 5종·LB5 용어 색인), 그 부채를 조사로 갚은 뒤 이 horizon 을 열었다.
