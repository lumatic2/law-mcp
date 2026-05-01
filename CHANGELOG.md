# Changelog

## [0.2.1] - 2026-05-02
### Changed
- `get_precedent`: NTS sourced 판례 등 `lawService.do?type=JSON` 미지원 ID에 대해 `Precedent not found` 에러 대신 빈 메타 + `warnings`에 웹 링크를 담은 stub 반환. 호출자(예: tax-agent reasoning_engine)는 기존대로 issue YAML 메타로 보강 가능, 핀 작성자는 warning 링크로 본문 직접 확인.
- 기존 JSON 지원 ID(예: 600303 대법원 판례)는 동작 변경 없음.

## [0.2.0] - 2026-04-02
### Added
- `suggest_term_patches` tool now returns `patched_text` and `applied_patch_count`.
- Legal/tax term validation toolchain (`batch_validate_legal_terms`) integrated.
- MCP smoke clients for protocol-level verification.

### Changed
- Standardized MCP error response format to `ERROR: ...`.
- Writing skill pipeline now supports chained term extraction -> patch suggestion.

### Security
- Secrets are expected only in `.env` and excluded by `.gitignore`.
