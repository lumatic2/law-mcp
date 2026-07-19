# 20260720-ib3-admrul-ladder-ranking

## Target

- Goal: BACKLOG Issue-back Queue #6·#7(2026-07-12(c), 경미 2건) 수리 — `search_admin_rules` 폴백
  사다리 비대칭 제거(#6)와 본문검색 결과의 무의미한 정렬 기준 교정(#7).
- ROADMAP milestone: 변경 없음(maintenance changeset, ib3).
- Objective 연결: "함정 없음" 축 — 도구 단독 사용자가 우회 요령 없이 도달하게 한다.

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/providers/lawgo-provider.ts` | `searchAdminRules` 에 완화 재시도·용어 브리지·브리지+완화 3단 이식(#6) | `search_law` 와 폴백 체인 대칭 |
| `src/providers/lawgo-provider.ts` | `countNameTokenMatches` 신규 + 본문검색 모드 정렬 키에 반영(#7) | 본문검색 결과가 쿼리 토큰을 담은 법령명 우선 |
| `src/providers/lawgo-provider.ts` | `BODY_SEARCH_RANK_WARNING` — 본문검색 응답에 관련도순 아님 명시 | 소비 에이전트가 상위 = 최적이라고 오해하지 않음 |
| `src/index.ts` | 두 검색 도구 description 갱신 | 도구 설명이 실제 폴백 체인과 일치 |
| `test/lawgo-provider.test.ts` | `countNameTokenMatches` 단위 테스트 2건 | 회귀 방지 |

## Contract

- Deploy/sync target: `~/projects/custom-mcps/law-mcp` (dist 사본) — push 후 사본에서
  `git pull && npm run build && npm test` + **MCP 서버 재시작(사용자)** 까지 해야 반영 조건 충족.
- `#6` 대칭성: `searchAdminRules` = 규칙명 매칭 → 본문검색(search=2) → 완화 재시도(search=2) →
  브리지(search=2) → 브리지+점진 완화(search=2). `searchLaw` 와 동일 순서이며, 앞 단계가 히트하면
  뒤 단계는 실행되지 않아 기존 히트 쿼리의 동작·호출 수가 불변이다.
- `#7` 정렬: 본문검색 모드(`search=2`)에서만 **법령명 토큰 겹침 desc** 를 기존 타이브레이커
  *위에* 얹는다. 겹침이 동률(대개 0)이면 기존 순서(match_type → 법령명 길이 → upstream index)로
  그대로 떨어지므로 회귀가 없다. 법령명 매칭 모드는 정렬 로직 자체가 변하지 않는다.

## 기각된 대안 (실측 근거)

이 changeset이 랭킹을 "관련도순"으로 만들지 *못하는* 이유 — upstream 에 관련도 신호가 없다.

- **(A) upstream 순서 보존**: 기각. `lawSearch.do?search=2` 응답 순서는 관련도가 아니라
  **가나다순**이다(실측: `가지급금 인정이자` → 교육비특별회계 회계기준에 관한 규칙, 농업협동조합…,
  독점규제…, 방송법 시행규칙, 법인세법 순). 이름길이 정렬을 가나다 정렬로 바꾸는 것일 뿐이며,
  실제로 적용해 보니 법인세법이 1위 → 5위로 밀려 **더 나빠졌다**.
- **(B) 후보 본문 fetch 후 토큰 빈도 재정렬**: 기각. 비용은 감당 가능하나(상위 5건 병렬 1.1초,
  1.44MB) 품질이 담보되지 않는다 — `가지급금 인정이자` 로 재정렬하면 예금 가지급금(전혀 다른 개념)을
  쓰는 **예금자보호법이 2위**로 올라온다. 빈도는 의미 불일치를 구분하지 못한다.
  또한 `인정이자` 는 후보 5건 본문 전체에서 0회로, 빈도 신호 자체가 희박하다.
- **(C) 소관부처·법령계열 사전 필터**: 보류. 도메인 하드코딩이라 범용 MCP 목표와 상충.
- 응답 필드 실측: `LawSearch.law[]` 는 법령명·ID·소관부처·시행일자 등 메타데이터만 반환하며
  **매칭 스니펫·관련도 점수 필드가 없다**. `target=lawjosub`(조문 단위) 는 빈 응답, `target=eflaw`
  는 연혁 법령이라 대안이 아니다.

→ 결론: 관련도 랭킹은 이 API 계약 안에서 불가. 현 단계 최선은 **쓸 수 있는 유일한 쿼리 의존 신호
(법령명 토큰 겹침)를 얹고, 나머지는 경고로 정직하게 알리는 것**이다.

## Evidence

- `npm test` 22/22 pass (신규 2건 포함), `tsc --noEmit` 클린, `npm run build` 성공.
- 실 API 재현 (`LAW_API_OC` 실키, 2026-07-20):
  - #6 before: `search_admin_rules("기업업무추진비 손금불산입 기준")` → **total=0, warnings=[]**
  - #6 after: → **total=3** + `'…' 0건 → 개정 전 용어 '접대비 손금불산입 기준'로 재검색` 경고
  - #6 회귀 없음: `접대비 손금불산입` 3건, `부가가치세 매입세액 불공제 사업자` 1건,
    `법인세 신고` 1건(규칙명 매칭, 경고 없음) — 전부 before 와 동일
  - #7 개선: `search_law("상속세 물납 허가 요건")` → 1~3위 상속세 및 증여세법·시행령·시행규칙
    (토큰 겹침 1). 수정 전 정렬(법령명 길이)이었다면 소득세법(4자)·지방세법(4자)·국세기본법(5자)이
    상위였다. `법인세법 가지급금 인정이자` 도 법인세법 계열 3건이 1~3위.
  - #7 회귀 없음: `가지급금 인정이자`(토큰 겹침 전원 0) 결과 순서가 before 와 완전 동일,
    `법인세법`·`소득세법 시행령` 등 법령명 매칭 경로 무변.

## Out of scope

- 본문 fetch 기반 관련도 랭킹(위 (B) — 근거 부족으로 기각).
- `search_precedents` 정렬(판례 검색은 본문검색 모드가 없어 이 변경과 무관).
