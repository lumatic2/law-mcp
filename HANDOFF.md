# HANDOFF — 세션 핸드오프 (git-tracked, session-end 소유)

## 이어서 할 일
> 2026-08-02 세션 종료 시 기록

- 사용자 결정을 먼저 받는다: ① `law-mcp` 목 본문 누락을 ordered XML 방식으로 고칠지, ② 노출된 봉인 20건을 ledger `opened` 처리·교체할지 또는 현 세션만 sealed 측정에서 제외할지.
- ① 승인 시 `/harness-plan`으로 새 milestone을 연다. 첫 leaf는 2026-06-27 시행판 6조문(소득세법 §12·§14·§62·§129, 시행령 §87·§208)의 축약 XML/JSON fixture와 현재 실패하는 순서·누락 테스트 고정이다.
- 구현 권고는 JSON 목번호 휴리스틱이 아니라 XML 형제 순서(`호 → 해당 목들 → 다음 호`)를 보존하는 공통 ordered parser다. 단건 조회와 `article-index`/`verify_citation`이 같은 본문을 내게 한다.
- 회귀 게이트: `npm test`, `npm run build`, 고정 43건 recall@3, 공개 확장 dev 40건 pass^3·SR@1, as_of 6조문 live smoke. 완료 시 `custom-mcps/law-mcp` pull·build와 사용자 MCP 재시작까지 포함한다.
- 봉인 사고: 이 Codex 세션의 도구 로그에 sealed 20건의 query/context/expected_laws/expected_article/source가 직렬화됐다. 파일·git에는 기록되지 않았고 조사 판단에는 사용하지 않았다. 이 세션으로 sealed 측정을 실행하지 않는다.

### 현재 상태 / 주의점
- ROADMAP read-only 확인: 134줄(≤150), M10 completed, active milestone 없음. 다음 non-trivial 작업은 `/harness-plan` 승인부터 시작한다.
- M10 감사: 확정 24점 중 현행 결정론 코드 2.5점, partial 16.5점, 코드 없음 5점, 회색지대 해석 0점. + arm 실점의 직접 원인은 retrieval이 아니라 분류·적용이었다.
- 별도 `law-mcp` 결함은 실재: DRF JSON의 `항.목`을 `src/providers/lawgo-provider.ts`와 `src/article-index.ts`가 읽지 않아 목 본문을 조용히 누락한다. XML은 기준일 6/6 조문에서 원문 순서를 보존했다.
- 세법 상수 확정: 생산직 260만원/직전 총급여 3,700만원/연 240만원, 복권 3억원 초과 소득세 30%(지방세 포함 33%), 비영업대금 이익 25%.
- master main checkout. 이번 세션은 읽기 전용 조사만 했고 소스·ROADMAP·ledger·배포 사본은 무변경이다.
