# changesets/

스킬·스크립트·런타임 유지보수 작업의 status machine. 1 changeset = 1 작업 단위.

각 changeset 은 `<YYYYMMDD>-<slug>/README.md` 형식이며, 템플릿은 [CHANGESET_TEMPLATE.md](CHANGESET_TEMPLATE.md).

## 인덱스

| # | Changeset | 날짜 | Scope | Verification | Status |
|---|-----------|------|-------|--------------|--------|
| 1 | [20260712-ib1-h8ta2-repair](20260712-ib1-h8ta2-repair/README.md) | 2026-07-12 | lawgo-provider.ts, law-provider.ts, types.ts, index.ts, test/lawgo-provider.test.ts | ✅ | done |
| 2 | [20260712-ib1b-nts-fulltext-html](20260712-ib1b-nts-fulltext-html/README.md) | 2026-07-12 | lawgo-provider.ts, test/lawgo-provider.test.ts | ✅ | done |
| 3 | [20260712-ib2-term-bridge](20260712-ib2-term-bridge/README.md) | 2026-07-12 | term-bridge.ts (신규), lawgo-provider.ts, test/term-bridge.test.ts (신규) | ✅ | done |
| 4 | [20260721-ud0-law-name-resolution](20260721-ud0-law-name-resolution/README.md) | 2026-07-21 | lawgo-provider.ts(resolveLawId·pickLawIdByName), test/law-name-resolution.test.ts (신규) | ✅ | done |
| 5 | [20260721-ud1-golden-v2](20260721-ud1-golden-v2/README.md) | 2026-07-21 | bench/golden-v2.json (신규), bench/verify-labels.ts(--set), test/golden-v2.test.ts (신규) | ✅ | done |
| 6 | [20260721-ud1-repeat-runner](20260721-ud1-repeat-runner/README.md) | 2026-07-21 | bench/run.ts(--set/--repeat/봉인), bench/scoring.ts(aggregateRepeats), test/bench-runner.test.ts (신규) | ✅ | done |
| 7 | [20260721-ud1-baseline-v2](20260721-ud1-baseline-v2/README.md) | 2026-07-21 | bench/run.ts(회차별 캐시 재생성), evidence/bench/2026-07-21-ud1-baseline-v2.* | ✅ | done |
| 8 | [20260721-ud2-aisearch-client](20260721-ud2-aisearch-client/README.md) | 2026-07-21 | src/ai-search.ts (신규), test/ai-search.test.ts (신규) | ✅ | done |

## 운영 원칙

- 영향 파일과 배포 경로를 먼저 적고 변경한다.
- SKILL.md 변경은 sync 전후 차이를 확인한다.
- 완료 보고 전 targeted test, smoke, sync/deploy evidence 중 해당되는 항목을 기록한다.
- 배포본이 있는 tooling 은 source 파일만 보고 완료 처리하지 않는다.
