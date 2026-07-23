# law-mcp

법제처 국가법령정보 OpenAPI를 MCP 도구로 감싸는 TypeScript 서버입니다. 법령·판례·행정규칙·해석자료를
AI 에이전트가 직접 조회하고, 인용한 조문을 검증하며, 과거 시점의 조문까지 받아올 수 있게 합니다.

[English version](#english-version)

## 무엇을 제공하나

| Tool | 하는 일 |
|---|---|
| `search_law` | 법령 검색. 정부 자체 관련도 순위(aiSearch)를 우선 쓰고, 실패하면 법령명 → 본문 → 완화 질의 → 개정 용어 순으로 폴백합니다. 어느 경로를 썼는지 `warnings` 로 알려 줍니다 |
| `get_law_article` | 조문 본문 조회. 응답에 시행일자가 항상 실리고, `as_of` 로 **과거 시점의 조문**을 받을 수 있습니다(세금은 귀속연도마다 조문이 다릅니다). 위임된 시행령 조문도 함께 옵니다 |
| `search_precedents` | 판례 검색 |
| `get_precedent` | 판례 본문 조회 |
| `search_admin_rules` | 행정규칙(훈령·예규·고시) 검색 |
| `get_admin_rule` | 행정규칙 본문 조회 |
| `search_legal_source` | 해석자료 검색 — 법령해석례·헌재결정례·행정심판재결례·자치법규·법령용어를 하나의 어댑터로 |
| `get_legal_source` | 해석자료 본문 조회 |
| `verify_citation` | 인용한 법령·조문이 실재하는지 검증. 지어낸 인용을 잡습니다 |
| `batch_validate_legal_terms` | 법률·세무 용어 규칙 점검 |
| `suggest_term_patches` | before/after 교정안과 `patched_text` 반환 |

## 설치

### 1. API 인증값(OC) 발급 — **필수**

이 서버는 법제처 국가법령정보 공동활용 OpenAPI를 씁니다. **인증값을 직접 발급받아야 합니다.**
대신 발급해 드릴 수 없고, 인증값 없이는 위 11개 중 9개가 동작하지 않습니다.

1. [OPEN API 신청](https://open.law.go.kr/LSO/openApi/cuAskList.do) — 메일주소로 회원가입·로그인한 뒤 신청합니다
2. [API인증키관리](https://open.law.go.kr/LSO/usr/usrOcInfoMod.do) — 발급된 인증값을 확인합니다
3. 그 값을 `.env` 의 `LAW_API_OC` 에 넣습니다
4. **호출 서버의 IP·도메인을 등록합니다.** 상류가 잘못된 인증값에 이렇게 답합니다 —
   "OPEN API 호출 시 사용자 검증을 위하여 정확한 서버장비의 IP주소 및 도메인주소를 등록해 주세요."
   (2026-07-23 실측). 인증값이 맞는데도 조회가 안 되면 여기를 먼저 보세요.

(링크 접근 확인: 2026-07-23. 전체 안내는 [이용안내](https://open.law.go.kr/LSO/openApi/guideList.do)에
있습니다. 상류 화면이 바뀔 수 있어 단계별 화면 설명은 여기 옮겨 적지 않습니다.)

### 2. 빌드

```bash
npm install
cp .env.example .env      # LAW_API_OC 입력
npm run build
```

### 3. MCP 클라이언트에 등록

Claude Code:

```bash
claude mcp add law-mcp -- node /절대경로/law-mcp/dist/index.js
```

설정 파일에 직접 넣는 경우:

```json
{
  "mcpServers": {
    "law-mcp": {
      "command": "node",
      "args": ["/절대경로/law-mcp/dist/index.js"],
      "env": { "LAW_API_OC": "발급받은_인증값" }
    }
  }
}
```

## 흔한 실패와 진단

| 증상 | 원인·조치 |
|---|---|
| 서버가 뜨자마자 죽고 `LAW_API_OC` 를 말한다 | 인증값이 없습니다. 위 발급 절차를 따르세요 |
| 검색은 되는데 결과가 비어 있다 | 인증값이 상류에서 거절됐을 수 있습니다. [API인증키관리](https://open.law.go.kr/LSO/usr/usrOcInfoMod.do)에서 값과 **IP·도메인 등록**을 확인하세요 |
| "일시 장애"가 계속 나온다 | 진짜 장애가 아닐 수 있습니다. 상류는 잘못된 인증값에도 5xx 를 주는 경로가 있어 우리 쪽에서 구분이 안 됩니다 — 반복되면 인증값·IP 등록부터 확인하세요 |
| 일상어로 물으면 엉뚱한 법이 나온다 | 정상 동작입니다. 응답 `warnings` 에 어휘 공백 경고가 뜨면 **질의를 좁히지 말고 법률 용어로 바꿔** 다시 검색하세요 |
| 과거 연도 세금 질문에 현행 조문이 온다 | `as_of` 를 주세요(`"2023"` 또는 `"2023-01-01"`). 해석할 수 없는 시점이면 현행으로 대체하지 않고 실패합니다 |

## 개발

```bash
npm run test          # 단위·계약 테스트
npm run smoke:mcp     # 실제 MCP 클라이언트로 왕복
npm run bench:golden  # 평가 코퍼스 실측 (LAW_API_OC 필요)
```

## 공개 경계

- 이 레포는 MCP 서버 코드와 용어 검증 로직만 포함합니다.
- 법령 원문은 저장하거나 재배포하지 않고, 사용자의 OpenAPI 자격으로 조회합니다.
- `.env` 와 실제 `LAW_API_OC` 값은 커밋하지 않습니다.

## License

MIT. 이 라이선스는 이 레포의 코드에만 적용되며, 외부 API가 반환하는 법령 데이터의 권리를
대체하지 않습니다.

## English version

`law-mcp` is a TypeScript MCP server for the Korean Ministry of Government Legislation OpenAPI.
It exposes 11 tools covering statutes, court precedents, administrative rules, interpretive
sources, citation verification, and point-in-time article lookup (`as_of`), plus legal/tax
terminology validation.

**You must obtain your own API credential.** Apply at
[open.law.go.kr](https://open.law.go.kr/LSO/openApi/cuAskList.do) (sign-up and login required),
retrieve the issued value from
[API key management](https://open.law.go.kr/LSO/usr/usrOcInfoMod.do), put it in `.env` as
`LAW_API_OC`, **and register your calling server's IP/domain** — the upstream rejects
unregistered callers even with a valid credential. Without this, 9 of the 11 tools will not work.

The repository contains server code only. It does not store or redistribute legal source text,
and real API credentials must stay in a local `.env` file.
