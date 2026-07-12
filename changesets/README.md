# changesets/

스킬·스크립트·런타임 유지보수 작업의 status machine. 1 changeset = 1 작업 단위.

각 changeset 은 `<YYYYMMDD>-<slug>/README.md` 형식이며, 템플릿은 [CHANGESET_TEMPLATE.md](CHANGESET_TEMPLATE.md).

## 인덱스

| # | Changeset | 날짜 | Scope | Verification | Status |
|---|-----------|------|-------|--------------|--------|
| 1 | [20260712-ib1-h8ta2-repair](20260712-ib1-h8ta2-repair/README.md) | 2026-07-12 | lawgo-provider.ts, law-provider.ts, types.ts, index.ts, test/lawgo-provider.test.ts | ✅ | done |
| 2 | [20260712-ib1b-nts-fulltext-html](20260712-ib1b-nts-fulltext-html/README.md) | 2026-07-12 | lawgo-provider.ts, test/lawgo-provider.test.ts | ✅ | done |

## 운영 원칙

- 영향 파일과 배포 경로를 먼저 적고 변경한다.
- SKILL.md 변경은 sync 전후 차이를 확인한다.
- 완료 보고 전 targeted test, smoke, sync/deploy evidence 중 해당되는 항목을 기록한다.
- 배포본이 있는 tooling 은 source 파일만 보고 완료 처리하지 않는다.
