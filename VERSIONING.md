# Versioning

This project follows Semantic Versioning.

- MAJOR: Breaking MCP tool schema changes
- MINOR: New tools or backward-compatible fields
- PATCH: Bug fixes, parser improvements, docs/tests updates

Release checklist:
1. `npm run build`
2. `npm run test`
3. `npm run smoke:mcp`
4. Update `CHANGELOG.md`
