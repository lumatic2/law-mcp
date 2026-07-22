# HORIZON 후보 백로그

> 우선순위 정렬된 horizon 후보 목록. **순서는 사용자 소유** — 에이전트는 후보 추가·근거 제안만 한다.
> Horizon 설계는 여기서 후보를 꺼내 선정하고, 새 후보를 발견하면 여기 적재한다.
> 생성: 2026-07-22 (`agentic-reach` 개설 시)

## 진행 중

- **`agentic-reach`** — 에이전트가 쓰는 대로 재고, 그 기준으로 올린다. (`agentic-reach.md`, 2026-07-22 개설)

## 후보 (미착수)

### A. 다음 분야 vertical (노동 · 부동산)
세법에서 만든 골격("법령 + 구속력 등급 해석자료 + 시점축")을 복제한다. `agentic-reach` 가 만드는
평가 하네스도 분야 무관이라 같이 재사용된다.
- 근거: tax-vertical close 기록 · 사용자 발화(2026-07-21) "한 분야씩 깊게"
- 선행 조건: `agentic-reach` 가 자를 확정한 뒤라야 새 분야 기준선이 의미를 가진다

### B. 소비 표면 확장 — 서버 instructions · 재질의 프로토콜
MCP `initialize` 응답의 `instructions` 채널이 비어 있다(`src/index.ts:24`). 재질의 프로토콜을
문단 1개로 실으면 분야 무관하게 복제된다.
- 근거: 2026-07-22 프로브 — 도구는 이미 재질의하라고 경고하는데 소비층이 안 듣는다
- 주의: **평가가 서기 전에 넣으면 기준선이 오염된다.** `agentic-reach` AR3 의 개선 후보로 편입 검토

### C. 남은 upstream 자료원
`oldAndNew` 신구법 비교 · `admbyl` 행정규칙 별표 · `lsStmd` 법령체계도 · `dlytrm` 재평가 ·
빈 응답 target(`lsRlt`·`couseLs`·`drlaw`) 어순 재확인
- 근거: tax-vertical Next Candidates · 어순 오류 3건 확인 선례(`specialDeccTt`→`ttSpecialDecc`)

### D. 성능 — 위임조문 조회 지연
`get_law_article` 지연의 64%(3.3초)가 위임조문 조회다.
- 근거: 2026-07-22 handoff 기록
- 성격: 사용자 체감 마찰이지만 도달률과 무관 — 단독 horizon 보다는 다른 horizon 에 얹는 편이 맞을 수 있음

### E. 공개 배포 · 발견성 (npm · 문서 · 예제)
Objective 의 "넓이" 축(몇 곳이 쓰는가)을 직접 미는 유일한 후보.
- 근거: `OBJECTIVE.md` 성공 모습 — "뭘 붙이지 고민할 때 후보에 올라 있다"
- **범위 밖 — 사용자 발화가 착수 신호** (구 ROADMAP 에서 이월)

## 적재 규칙

- 새 후보는 여기 append 한다. 삭제는 사용자만.
- 후보에 **근거**(왜 이게 후보인가)를 반드시 적는다. 근거 없는 후보는 다음 설계에서 판단 불가.
- 선정되면 "진행 중"으로 옮기고 horizon doc 경로를 적는다.
