# law-mcp

법제처(국가법령정보) API 기반 MCP 서버.

## Tools
- `search_law`: 법령 검색
- `get_law_article`: 조문 조회
- `batch_validate_legal_terms`: 법률/세무 용어 규칙 점검
- `suggest_term_patches`: before/after 교정 + `patched_text` 반환

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
