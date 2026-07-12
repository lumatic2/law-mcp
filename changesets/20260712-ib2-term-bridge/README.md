# 20260712-ib2-term-bridge

## Target

- Goal: BACKLOG Issue-back Queue #5(2026-07-12(b)) 수리 — 세법 신·구 용어 갭으로 인한
  `search_precedents`/`search_law` 0건 문제를 신·구 용어 사전 브리지로 구제.
- ROADMAP milestone: 변경 없음(maintenance changeset, ib2).

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/term-bridge.ts` (신규) | 개정 신·구 용어 양방향 사전 + 치환 함수 | 재사용 가능한 브리지 유틸 |
| `src/providers/lawgo-provider.ts` | `search_precedents`/`search_law` 폴백 체인 끝에 브리지 1단 추가 | 기존 폴백까지 0건일 때만 개정 용어로 1회 재검색 |
| `test/term-bridge.test.ts` (신규) | 사전 매핑·치환·경고 문구 단위 테스트 | 회귀 방지 |

## Contract

- Source of truth: 사용자가 직접 확인한 "동일 개념의 순수 명칭 변경"만 등재(세법 개정 연도·시행일 근거 주석 포함). 개념이 재구성/병합된 경우(예: 가산금 제도 개편)는 오검색 위험으로 제외.
- 등재 항목(3쌍, 전부 법인세법 개정):
  - 접대비 ↔ 기업업무추진비 (2021.12.21 개정, 2022.1.1 시행)
  - 법정기부금 ↔ 특례기부금 (2020년 개정, 2021.1.1 시행)
  - 지정기부금 ↔ 일반기부금 (2020년 개정, 2021.1.1 시행)
- Deploy/sync target: `~/projects/custom-mcps/law-mcp` (dist 사본) — 이 changeset은 push 후 사본
  `git pull && npm run build && npm test` 까지 완료해야 반영 조건 충족.
- Compatibility: 브리지는 **기존 폴백 체인이 전부 0건일 때만** 마지막 1단으로 실행된다.
  - `search_law`: 법령명 매칭 → 본문검색(search=2) → 완화 재시도(토큰 제거, search=2) → **브리지(원 쿼리 기준, search=2)**.
  - `search_precedents`: 기본 검색 → 완화 재시도(토큰 제거) → **브리지(원 쿼리 기준)**.
  - 쿼리에 사전 등재 용어가 없으면 브리지는 아무 것도 하지 않아 기존 동작이 그대로 유지된다.
- Out of scope: 사전 자동 확장(예: 법제처 API로 개정 이력 조회), 쿼리 내 복수 용어 동시 치환(1단 치환만).

## Evidence Contract

- Scenario: BACKLOG #5 재현 쿼리 `search_precedents("기업업무추진비")` (before: 0건) vs
  `search_precedents("접대비")` (before: 3건 이상).
- Expected evidence: 수리 후 `search_precedents("기업업무추진비")` 가 브리지를 거쳐 0건이 아닌
  결과를 반환하고 warning에 치환 사실이 명시됨.
- Failure mode probe: 사전에 없는 쿼리(`"가지급금 대표이사 소득처분"`)는 브리지가 개입하지 않고
  기존 동작(폴백 실패 시 0건)을 유지하는지 확인.
- Cleanup receipt: 실 API 검증 스크립트는 레포 루트에 임시 작성 후 실행·삭제(레포에 미커밋).
- Not evidence: `npm run build`/`npm test` 통과만으로는 실 API 브리지 도달을 증명하지 않음 — 아래
  실측 결과가 근거.

## Verification

- [x] Targeted tests: `npm test` — 17/17 pass (`lawgo-provider.test.ts` 10건 + `term-bridge.test.ts` 6건 + `term-patches.test.ts` 1건).
- [x] Smoke: `npm run build` 성공.
- [x] Sync/deploy: 배포 사본(`~/projects/custom-mcps/law-mcp`) `git pull && npm run build && npm test` 완료.
- [ ] Deployed copy grep if skill changed: N/A(스킬 변경 아님).
- [x] Drift/dirty-tree check: 변경 파일만 스테이징.

## Result

- Status: done
- Evidence:

### 실 API 재현 — before/after

| 쿼리 | 도구 | before (수리 전 동작 재현) | after (수리 후) |
|---|---|---|---|
| `기업업무추진비` | `search_precedents` | 0건 | **5건**, warning: `'기업업무추진비' 0건 → 개정 전 용어 '접대비'로 재검색` |
| `접대비` | `search_precedents` (control) | 5건, warnings: [] | 5건, warnings: [] (무변화 — 직접 매치라 브리지 불필요) |
| `가지급금 대표이사 소득처분` | `search_precedents` (사전 미등재 쿼리, 회귀 확인) | 3건 (완화 재시도로 도달, 기존 동작) | 3건, warnings: [] (브리지 미개입 — 동작 불변 확인) |

### 단위 테스트

`npm test` (소스): 17 pass / 0 fail — `lawgo-provider.test.ts` 10건(기존 그대로, 회귀 없음) +
`term-patches.test.ts` 1건(기존) + 신규 `term-bridge.test.ts` 6건.

### 배포 사본 sync

`~/projects/custom-mcps/law-mcp`: `git pull --ff-only` → `npm run build` → `npm test`
결과는 본 changeset 커밋 직후 오케스트레이터가 실행한 로그를 별도 기록(아래 커밋 해시 참조).

- Notes:
  - 사전은 "순수 명칭 변경"만 등재(불확실한 항목 배제 원칙 준수) — 가산금→납부지연가산세 같은
    제도 개편성 변경은 개념 재구성 위험으로 제외.
  - 브리지는 원 쿼리 기준 1회만 동작(치환된 쿼리에 대해 재귀적으로 다시 완화·브리지하지 않음 —
    과설계 방지).

## Follow-up (ib2b, 2026-07-12) — 게이트 실패 보완 수리

### Gate failure (실측)

- BACKLOG #5 원 repro 쿼리 `search_precedents("기업업무추진비 한도 손금불산입")` → 수리 후에도
  **0건, warnings []**.
- 원인: 브리지 치환 쿼리 `접대비 한도 손금불산입` 자체도 0건이었고(`접대비 한도`도 0건),
  브리지 폴백이 "치환 쿼리 1회 조회"에서 끝나 그 이상 완화하지 않았다. `접대비`(토큰 1개)까지
  완화해야 3건 이상이 나오는데, 브리지 이후 점진 완화 루프가 없었다.

### Fix

- `src/providers/lawgo-provider.ts`에 `bridgeThenRelaxSearch()` 헬퍼 추가: 브리지 치환 쿼리가
  0건이면 기존 `relaxQuery()`(마지막 토큰 제거)를 반복 적용해(최소 1토큰까지) 재검색한다.
  히트 시 warning에 "브리지 치환 → 어느 쿼리로 완화해 도달했는지"를 모두 담는다.
- `searchPrecedents`·`searchLaw` 양쪽의 브리지 폴백 끝에 동일하게 연결(계약 요구사항대로 두 경로
  동형 처리).
- 기존 동작 불변: 사전 무관 쿼리, 구용어 직접 쿼리(relax 경유)는 그대로 — `bridgeThenRelaxSearch`는
  브리지 매치가 있고 그 치환 쿼리 자체가 0건일 때만 개입.

### Evidence — 실 API before/after (수리 후 실측)

| 쿼리 | before (게이트 실패 시점) | after (이번 수리 후) |
|---|---|---|
| `기업업무추진비 한도 손금불산입` | 0건, warnings [] | **56건**, warning: `'기업업무추진비 한도 손금불산입' 0건 → 개정 전 용어 '접대비 한도 손금불산입'로 치환 후 '접대비'로 완화 재검색` |
| `가지급금 대표이사 소득처분` (사전 무관, 회귀) | 3건, warnings [] | 3건, warnings [] (무변화) |
| `접대비 한도` (구용어 직접, relax 경유, 회귀) | relax 경유 히트 | 56건, warning: `원 쿼리 0건 → '접대비'로 재검색.` (브리지 미개입 — relax 단계에서 이미 히트, 동작 불변) |

### 단위 테스트 (ib2b 추가분)

`test/lawgo-provider.test.ts`에 `bridgeThenRelaxSearch` 3건 추가(BACKLOG #5 재현: 2단 완화로
`접대비 한도` → `접대비` 도달, 완전 0건 시 null 반환, 단일 토큰 브리지 결과는 완화 불필요 확인).
`npm test`: 20 pass / 0 fail (기존 17 + 신규 3).

### Sync

- 소스 레포(`~/projects/law-mcp`): `npm run build` + `npm test` 통과 후 커밋·push.
- 배포 사본(`~/projects/custom-mcps/law-mcp`): `git pull --ff-only` → `npm run build` → `npm test`
  완료(로그는 커밋 해시와 함께 오케스트레이터 보고에 포함).
