# RESEARCH — 설치 관문(OC 자격)과 degraded 모드 실현 가능성

> 소비처: horizon `trap-free` (§B0.5 Horizon 설계 입력) · 작성 2026-07-23
> 목적: "OC 없이도 도는 degraded 모드"를 이번 horizon 에 담을지 판정할 재료.

## 1. 레포 실측 — OC 없이 무엇이 도는가

`LAW_API_OC` 는 `src/config.ts:12` 에서 읽고 `assertLawApiKey()` 가 없으면 즉시 throw 한다.
실제 사용처를 세면:

| 파일 | OC 를 쓰는 호출 지점 |
|---|---|
| `src/providers/lawgo-provider.ts` | 12곳 (595·612·787·792·796·815·1626·1712·1769·1822·1889·1989) |
| `src/index.ts:399` | 법령 본문 조회 |
| `src/ai-search.ts:171` | `aiSearch` 타깃 |

즉 **law.go.kr DRF 로 나가는 경로는 전부 OC 필수**다. MCP 로 노출되는 도구 11종 중
`search_law`·`get_law_article`·`search_precedents`·`get_precedent`·`search_admin_rules`·
`get_admin_rule`·`search_legal_source`·`get_legal_source`·`verify_citation` 이 여기 걸린다.

OC 없이 살아남는 것:
- `batch_validate_legal_terms`·`suggest_term_patches` — 로컬 규칙 기반(`src/legal-rules.ts`·
  `src/term-patches.ts` 에 http 호출 없음).
- NTS 폴백(`src/index.ts:175`) — **세무 판례 문서 조회 한정**이고, 그 판례에 도달하는 검색
  경로 자체가 OC 를 탄다.

**판정: degraded 모드는 11개 중 2개짜리 껍데기다.** "설치했는데 법령 검색이 안 되는 MCP"는
설치 관문을 낮추는 게 아니라 첫인상을 망친다. → **미채택 추천.**

## 2. 상류 문서 실측 — 발급 절차가 공개돼 있지 않다

- `https://open.law.go.kr/LSO/openApi/guideList.do` (접근 2026-07-23) — OC 신청 절차·승인
  대기·IP 등록 여부에 대한 서술 **없음**. 확인되는 건 `API인증키관리` 링크와
  "사용신청 및 이용문의 : 02-2109-6446" 뿐.
- `https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide` (접근 2026-07-23)
  — 요청 변수 `OC` 의 설명은 원문 그대로 **"신청한 API인증값"** 한 마디. 이메일 ID 인지,
  즉시 발급인지에 대한 언급 없음.
- `https://www.data.go.kr/data/15000115/openapi.do` (접근 2026-07-23) — 공공데이터포털 등록본.
  개발/운영 단계 자동승인, 개발계정 트래픽 10,000건, 운영계정은 활용사례 등록으로 증량 신청.

**함의**: 상류가 절차를 안 알려주므로 **우리 README 가 그 공백을 메우는 것이 곧 함정 제거**다.
동시에, 정확한 발급 화면 문구·IP 등록 필요 여부는 공개 페이지에서 확인되지 않았다 —
이 부분은 **사용자(실제 발급자)의 확인이 필요**하고, 추정으로 쓰지 않는다.

## 3. 우리 README 의 현재 상태 (실측)

- 58줄. 도구 표에 **4개만** 기재(`search_law`·`get_law_article`·`batch_validate_legal_terms`·
  `suggest_term_patches`) — 실제 노출은 11개. 판례·행정규칙·해석자료·`verify_citation`·
  `as_of` 시점조회가 문서상 존재하지 않는다.
- `Setup` 은 `cp .env.example .env` / `# LAW_API_OC 입력` 두 줄. **어디서 발급받는지 없음.**
- 인증 실패는 `Known Edge Cases` 에 한 줄로 밀려 있는데, 실제로는 신규 사용자 100%가 만나는
  첫 관문이다.

## 2b. 추가 실측 — 신청 경로는 있다 (2026-07-23)

`guideList.do` 의 좌측 메뉴에서 경로가 확인된다:

- **OPEN API 신청**: `https://open.law.go.kr/LSO/openApi/cuAskList.do` — 미로그인으로 접근하면
  "회원 로그인 / 국가법령정보 공동활용에 오신것을 환영합니다. 메일주소와 비밀번호를 입력하신 후
  로그인 버튼을 클릭해 주세요." 로 이동한다. 즉 **메일주소 계정 가입 → 로그인 → 신청** 순서다.
- **API인증키관리**: `https://open.law.go.kr/LSO/usr/usrOcInfoMod.do` — 발급된 인증값 확인·수정.

따라서 README 는 화면 단계를 재현 서술하지 않고 **이 링크들 + "여기서 발급받아야 한다"** 로 쓴다
(2026-07-23 사용자 확정). 상류 화면은 바뀌므로 복제한 절차는 곧 낡는다.
IP/도메인 등록 필요 여부는 여전히 공개 페이지에서 확인되지 않아 **쓰지 않는다**.

## 종료 신호

포화 — 상류 공개 페이지 3곳에서 절차 서술이 마르는 것을 확인했고, 레포 측 사실은 코드에서
직접 셌다. 남은 미확인 1건(발급 화면 실제 문구·IP 등록 여부)은 웹으로 더 캐도 안 나오는
종류라 사용자 확인 항목으로 넘긴다.

## 출처

- 법제처 OpenAPI 가이드 목록 — https://open.law.go.kr/LSO/openApi/guideList.do (2026-07-23)
- 판례 본문 조회 API 가이드 — https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide (2026-07-23)
- 공공데이터포털 법제처 국가법령정보 공유서비스 — https://www.data.go.kr/data/15000115/openapi.do (2026-07-23)
- OPEN API 신청 — https://open.law.go.kr/LSO/openApi/cuAskList.do (2026-07-23, 로그인 필요)
- API인증키관리 — https://open.law.go.kr/LSO/usr/usrOcInfoMod.do (2026-07-23)
