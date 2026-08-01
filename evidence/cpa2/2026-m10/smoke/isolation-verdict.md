# M10 2×2 격리 연막 판정

판정일: 2026-08-01

## 결과

- C+(`gpt-5.6-sol` 요청): 배포 `dist/index.js`를 통해 `search_law`와 `get_law_article`을 실제 호출했고, 2026-06-27 현재 소득세법 제21조 제목 `기타소득`을 받았다.
- C-(`gpt-5.6-sol` 요청): MCP 호출 0, `NO_TOOL_AVAILABLE` 반환.
- O+(`opus` 요청): trace의 실제 모델은 `claude-opus-5`; Law MCP 두 번 호출 후 시험일 조문 본문을 받았다.
- O-(`opus` 요청): trace의 실제 모델은 `claude-opus-5`; MCP 호출 0, `NO_TOOL_AVAILABLE` 반환.
- 네 arm 모두 웹 요청 0, 셸·파일·브라우저·스킬·하위 에이전트 호출 marker 0, 종료코드 0이다.
- 저장소 `dist/index.js`와 실제 배포 사본의 SHA-256은 모두 `02fff2fedf5106fb387c0d06a7b1c146b95209234d59e558990c965753f0a324`다.

## 격리 계약

- 공통: 레포 밖 GUID 임시 디렉터리, 비지속 세션, 웹 비활성, 내장 셸·파일 도구 금지 지시.
- Codex: `--ignore-user-config --ignore-rules --ephemeral --sandbox read-only`, `web_search="disabled"`, `agents.enabled=false`. C+에만 `law_mcp` 서버와 `LAW_API_OC` 환경변수 이름 허용, 읽기 도구 자동승인 설정을 주입했다.
- Claude: `--strict-mcp-config --tools "" --no-chrome --disable-slash-commands --no-session-persistence`. O+에만 `law_mcp` strict config와 두 핵심 도구 허용 목록을 넣었다.
- prompt 공통부는 모델 간 동일하다. `+/-`는 도구 가능 여부 한 문장과 그에 대응하는 smoke 지시만 다르다. 본 풀이도 문제·공통 지시는 같고 그 한 문장만 다르다.

## 연막 중 발견·수리

1. Claude 설정 파일 선택의 PowerShell 식을 명령으로 오인한 문제를 수정했다.
2. Claude 단일 JSON은 도구 trace를 감추므로 `stream-json --verbose`로 바꿨다.
3. Codex 0.146.0 `exec`는 사용자 설정을 무시한 MCP 호출에서 승인 요청을 취소했다. `default_tools_approval_mode="approve"`를 해당 읽기 전용 서버에만 명시했다. 관련 공개 이슈: https://github.com/openai/codex/issues/16685 (접근 2026-08-01), https://github.com/openai/codex/issues/25442 (접근 2026-08-01).
4. Codex `--ignore-user-config`가 MCP 자식의 인증 환경변수도 제거하므로 값은 기록하지 않고 변수 이름만 `env_vars=["LAW_API_OC"]`로 허용했다.
5. 검증기에 `user cancelled`, `INTERNAL_ERROR`, 비정상 종료를 실패로 추가했다.

## 관측 한계

Claude trace는 실제 정규 모델명 `claude-opus-5`를 제공한다. Codex JSONL은 해석된 실제 모델 필드를 내보내지 않으므로 두 arm에 같은 명시적 alias `gpt-5.6-sol`, 같은 CLI 0.146.0, 같은 실행 플래그를 고정했다. 이 한계는 최종 보고서에도 유지한다.
