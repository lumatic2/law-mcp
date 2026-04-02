# Changelog

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
