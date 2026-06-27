# law-mcp

법제처 국가법령정보 OpenAPI를 MCP 도구로 감싸는 TypeScript 서버입니다. 법령 검색, 조문 조회, 법률·세무 용어 검증, 문장 교정 패치 제안을 에이전트 워크플로우에서 재사용할 수 있게 만듭니다.

[English version](#english-version)

## 무엇을 제공하나

| Tool | Role |
|---|---|
| `search_law` | 법령명/키워드 기반 검색 |
| `get_law_article` | 법령 조문 조회 |
| `batch_validate_legal_terms` | 법률·세무 용어 규칙 점검 |
| `suggest_term_patches` | before/after 교정안과 `patched_text` 반환 |

## 공개 경계

- 이 레포는 MCP 서버 코드와 용어 검증 로직만 포함합니다.
- 법령 원문은 저장하거나 재배포하지 않고, 사용자의 OpenAPI 자격으로 조회합니다.
- `.env`와 실제 `LAW_API_OC` 값은 커밋하지 않습니다.

## Setup

```bash
npm install
cp .env.example .env
# LAW_API_OC 입력
```

## Run
```bash
npm run build
node dist/index.js
```

## Test
```bash
npm run test
npm run smoke:mcp
```

## Known Edge Cases
- 법제처 OpenAPI는 IP/도메인 등록이 맞지 않으면 인증 실패 메시지를 반환합니다.
- 조문 치환 후 조사(을/를 등) 보정을 자동 수행하지만, 복잡한 문맥은 마지막 수동 점검이 필요합니다.

## Security
- `.env`는 커밋하지 않습니다.
- 운영 배포 전 API 사용량 제한/재시도 정책을 설정하세요.

## License

MIT. 이 라이선스는 이 레포의 코드에만 적용되며, 외부 API가 반환하는 법령 데이터의 권리를 대체하지 않습니다.

## English version

`law-mcp` is a TypeScript MCP server for the Korean Ministry of Government Legislation OpenAPI. It exposes reusable tools for law search, article lookup, legal/tax terminology validation, and patch suggestions for agent workflows.

The repository contains server code only. It does not store or redistribute legal source text, and real API credentials must stay in a local `.env` file.
