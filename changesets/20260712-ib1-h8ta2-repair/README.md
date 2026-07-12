# 20260712-ib1-h8ta2-repair

## Target

- Goal: ai-accounting-firm H8 TA2 실소비에서 돌아온 issue-back 결함 4건 수리
  (BACKLOG.md "Issue-back Queue 2026-07-12").
- ROADMAP milestone: IB1 — get_precedent NTS 소스 본문 도달 + 검색 결함 수리.

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/providers/lawgo-provider.ts` | #1 NTS 폴백 체인(precInfoP 리다이렉트 → taxlaw.nts.go.kr action.do) + #2 search=2 본문검색 폴백(searchLaw/searchAdminRules) + #3 relaxQuery 완화 재시도(searchLaw/searchPrecedents) + #4 getAdminRule offset/limit 페이징 | get_precedent가 NTS 소스 판례에서도 본문 텍스트에 도달, 키워드 본문검색·다단어 자연어 쿼리가 0건 대신 완화 결과 반환, 대형 admin rule을 분할 조회 가능 |
| `src/providers/law-provider.ts` | getAdminRule 시그니처에 options(offset/limit) 추가 | 인터페이스 계약 갱신 |
| `src/types.ts` | GetAdminRuleResult에 total_article_count/offset/has_more 추가 | 페이징 메타데이터 노출 |
| `src/index.ts` | 4개 도구 description 갱신 + get_admin_rule에 offset/limit 파라미터 노출 | 소비자가 폴백·페이징 동작을 사전에 인지 |
| `test/lawgo-provider.test.ts` (신규) | NTS 폴백 파싱·매핑, relaxQuery 순수 함수 단위 테스트 | 네트워크 없이 회귀 방지 |

## Contract

- Source of truth: law.go.kr DRF Open API(lawSearch/lawService) + taxlaw.nts.go.kr `action.do`
  (비공식이지만 인증·CSRF 없이 공개 접근 가능함을 실측 확인, 아래 근거 참조).
- Deploy/sync target: 없음(로컬 MCP stdio 서버, 사용자가 직접 재시작).
- Compatibility: 기존 정상 경로(법제처 소스 판례, 법령명 매칭 검색, get_admin_rule 무옵션 호출)는
  출력 스키마·기본 동작 불변 — 전부 폴백/추가 옵션으로만 확장.
- Out of scope: NTS 첨부파일(HWP) 전문 다운로드·변환, search 랭킹 알고리즘 개선(법제처 API 자체
  한계), search_precedents/search_law 다단계(2단 이상) 완화 재시도.

## Evidence Contract

- Scenario: 원본 mcp-log.md 재현 쿼리 5+3+1+1건을 빌드된 provider로 재실행.
- Expected evidence: #1 5/5 본문(판결요지) 도달, 법제처 소스 1건 회귀 통과, #2/#3/#4 before/after
  출력 로그.
- Failure mode probe: `resolveNtstDcmId`/`fetchNtsActionData` 예외 시 기존 웹링크 안내로 자동 폴백
  (도구 자체는 실패시키지 않음) — try/catch로 확인.
- Cleanup receipt: 임시 스모크 스크립트는 프로젝트 외부 scratchpad에서 실행, 레포에 미커밋.
- Not evidence: `npm run build`/`npm test` 통과만으로는 실 API 도달을 증명하지 않음 — 아래
  실측 로그가 근거.

## Verification

- [x] Targeted tests: `npm test` — 9/9 pass (신규 8건 + 기존 1건).
- [x] Smoke: `npm run build` 성공 + 실 API 스모크(아래 결과 기록) — MCP 서버 자체 재시작은
      사용자 몫이라 수행하지 않음.
- [ ] Sync/deploy if skill changed: N/A.
- [ ] Deployed copy grep if skill changed: N/A.
- [x] Drift/dirty-tree check: 변경 파일만 스테이징 예정.

## Result

- Status: done
- Evidence:

### #1 get_precedent — NTS 폴백 (치명, 최우선)

경로: `GET /LSW/precInfoP.do?precSeq=<id>&mode=0`(302, redirect 안 따라감) → Location 헤더에서
`ntstDcmId` 추출 → `POST https://taxlaw.nts.go.kr/action.do` (`actionId=ASIQTB002PR01`,
`paramData={"dcmDVO":{"ntstDcmId":...}}`, `Content-Type: application/x-www-form-urlencoded`).
**인증·쿠키·CSRF 토큰 불필요** — 브라우저 세션 없이 curl/axios로 그대로 재현됨(실측, 아래 근거).
3가지 후보 경로 중 "직접 API 재현"이 성공해 나머지(쿠키 세션 승계, mobilePrecInfoR.do POST)는
불필요해짐 — 참고로 `mobilePrecInfoR.do`는 `/LSW/`·`/DRF/` 양쪽 다 404로 막혀 있어 실제로
동작하지 않는 경로였음(폐기 확인).

재현 5건 재실행 결과(빌드된 provider, `getPrecedent()` 직접 호출):

| precedent_id | 사건명 도달 | 법원명 | 판결요지(gist) 도달 | 참조조문 | 비고 |
|---|---|---|---|---|---|
| 619683 | ✅ 특수관계법인에 대한 대여금의 업무무관가지급금 인정 여부 등 | 서울고등법원 | ✅ | (없음) | |
| 618097 | ✅ 고가현물출자 부당행위계산부인 상여 소득처분 적법 여부 | 대법원 | ✅ | (없음) | |
| 310830 | ✅ (심리불속행)대여경위·대여규모·거래처 사업현황... | null(사건번호 형식 없음) | ✅ | (없음) | dsbdHpnnNo 없어 법원명 미도출 |
| 325202 | ✅ 공사대금 미회수와 용역비 지급은... | null | ✅ | (없음) | 상동 |
| 612611 | ✅ 가지급금인정이자 제도와 지급이자손금불산입... | 대법원 | ✅ | 법인세법 제19조의2 | dcmRltnStttList 있어 참조조문까지 도달 |

→ **5/5 전부 판결요지(gist) 텍스트 도달**(기존 100% 실패 → 100% 성공). 단, 판시사항과 정확한
선고일자는 NTS 응답 구조에 없어 공란, 판례 전문(全文)은 HWP 첨부(`dcmHwpEditorDVOList`)에만
있어 이 도구로는 미도달 — 두 경우 모두 warnings에 명시하고 판례내용은 판결요지로 대체.

법제처 소스 정상 케이스 회귀(precedent_id=228541, 무작위 선택): 기존 lawService 경로 그대로
동작, `사건명="강제추행"`, `판시사항 present=true`, `warnings=[]` — 회귀 없음 확인.

### #2 search_law / search_admin_rules 본문 키워드 미지원

- `search_law("가지급금", limit:5)`: 기존 0건 → `search=2`(본문검색) 폴백으로 **총 5건, 법인세법이
  1순위**로 도달. warning: "법령명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음."
- `search_law("부당행위계산", limit:5)`: `search=2` 폴백으로 0건 → non-zero(전체 380건 중 표본)로
  전환되나 상위 5건(정렬 기준: matchType 동률 시 이름짧은순→API 원순서)엔 법인세법이 없음 —
  `limit:100`으로 재확인하니 법인세법 포함 확인(법인세법 계열 도달 자체는 성공, 랭킹 품질은
  법제처 API 자체 한계로 out of scope).
- `search_admin_rules("가지급금")`: 0건 → 본문검색 폴백으로 66건. `search_admin_rules("인정이자")`:
  0건 → 본문검색 폴백으로 629건. 둘 다 warning 포함.

### #3 search_precedents 다단어 자연어 쿼리 0건

- `search_precedents("업무무관 가지급금 대표이사 소득처분")`: 원 쿼리 0건 → 마지막 토큰
  ("소득처분") 제거 1단 완화 → `"업무무관 가지급금 대표이사"` 로 재검색해 **3건** 도달.
  warning: `"원 쿼리 0건 → '업무무관 가지급금 대표이사'로 재검색."`

### #4 get_admin_rule 대형 문서

- 사전 확인: 법제처 lawService API 자체는 offset/limit 미지원(전문 일괄 반환만 가능).
- 최소 구현: `조문내용`이 이미 조문 단위 배열이므로, provider에서 배열을 offset/limit으로
  슬라이스해 반환(응답에 `total_article_count`/`offset`/`has_more` 추가). 옵션 미지정 시
  기존과 동일하게 전체 반환(하위 호환).
- 검증(rule_id=2100000280350, 70,597자 원본): 무옵션 호출 → `total_article_count=249,
  has_more=false`(기존과 동일 전체 반환). `offset:0, limit:3` 호출 → 3건만 반환,
  `has_more=true`, warning `"조문 1~3/249건 반환. 이어보려면 offset=3 로 재조회."`

- Notes:
  - build: `npm run build` 통과(에러 없음).
  - test: `npm test` — 9 pass / 0 fail (신규 `test/lawgo-provider.test.ts` 8건 + 기존 1건).
  - NTS action.do 호출은 공개 문서 뷰어의 AJAX 엔드포인트를 그대로 재현한 것으로, 별도
    인증서·API 키가 필요 없음(law-mcp의 `LAW_API_OC`와 무관한 별도 도메인). 장기적으로
    taxlaw.nts.go.kr 측 UI/엔드포인트가 바뀌면 이 폴백이 깨질 수 있음(브라우저 스크레이핑에
    준하는 리스크) — 향후 실패 시 재조사 필요 지점으로 남김.
