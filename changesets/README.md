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
| 9 | [20260721-ud3-committee-sources](20260721-ud3-committee-sources/README.md) | 2026-07-21 | src/providers/source-adapter.ts(위원회 9종 + 단건객체 수리), src/index.ts(source enum 5→14), test/source-adapter.test.ts | ✅ | done |
| 10 | [20260721-ud3-delegated-articles](20260721-ud3-delegated-articles/README.md) | 2026-07-21 | src/delegated.ts (신규), src/providers/lawgo-provider.ts(부착), src/types.ts, test/delegated.test.ts (신규) | ✅ | done |
| 11 | [20260721-ud3-contribution-gate](20260721-ud3-contribution-gate/README.md) | 2026-07-21 | bench/ud3-contribution.ts (신규), evidence/bench/2026-07-21-ud3-contribution.md | ✅ | done |
| 12 | [20260721-ud2-candidate-merge](20260721-ud2-candidate-merge/README.md) | 2026-07-21 | src/ai-search.ts(AiMergeConfig), src/providers/lawgo-provider.ts(mergeAiSearch·기본 채택), bench/ud2-ab.ts (신규), test/ai-search-merge.test.ts (신규), test/term-boost.test.ts(실 API 격리) | ✅ | done |
| 13 | [20260721-ud2-article-shipping](20260721-ud2-article-shipping/README.md) | 2026-07-21 | src/types.ts(ai_articles), src/providers/lawgo-provider.ts(조문 출하), bench/run.ts·bench/scoring.ts(출하값 기준 측정), test/ai-search-merge.test.ts | ✅ | done |
| 14 | [20260721-ud2-verdict](20260721-ud2-verdict/README.md) | 2026-07-21 | src/providers/lawgo-provider.ts(사다리·aiSearch 동시 실행), src/index.ts(description), evidence/bench/2026-07-21-ud2-verdict.md | ✅ | done |
| 15 | [20260721-ud4-parent-law](20260721-ud4-parent-law/README.md) | 2026-07-21 | src/parent-law.ts (신규), src/providers/lawgo-provider.ts(promoteParentLaws·resolveLawId 차단), bench/ud2-ab.ts(--min-net), test/parent-law.test.ts (신규) | ✅ | done |
| 16 | [20260721-ud4-ladder-shortcut](20260721-ud4-ladder-shortcut/README.md) | 2026-07-21 | src/providers/lawgo-provider.ts(prefetchLinkage·linkageTokens), test/ladder-shortcut.test.ts (신규) | ✅ | done |
| 17 | [20260721-ud4-verdict](20260721-ud4-verdict/README.md) | 2026-07-21 | src/providers/lawgo-provider.ts(pickLawByName·느슨한 해석 경고), test/law-name-resolution.test.ts, evidence/bench/2026-07-21-ud4-verdict.md | ✅ | done |
| 18 | [20260721-f20-accidental-name-match](20260721-f20-accidental-name-match/README.md) | 2026-07-21 | src/providers/lawgo-provider.ts(pickLawByName accidental·resolveLawId 거절), test/law-name-resolution.test.ts | ✅ | done |
| 19 | [20260721-tv1-golden-tax](20260721-tv1-golden-tax/README.md) | 2026-07-21 | bench/golden-tax.json (신규), test/golden-tax.test.ts (신규) | ✅ | done |
| 20 | [20260721-tv1-tax-scoring](20260721-tv1-tax-scoring/README.md) | 2026-07-21 | bench/scoring.ts(by_type·as_of 축), bench/run.ts(유형 출력), test/tax-scoring.test.ts (신규) | ✅ | done |

## 운영 원칙

- 영향 파일과 배포 경로를 먼저 적고 변경한다.
- SKILL.md 변경은 sync 전후 차이를 확인한다.
- 완료 보고 전 targeted test, smoke, sync/deploy evidence 중 해당되는 항목을 기록한다.
- 배포본이 있는 tooling 은 source 파일만 보고 완료 처리하지 않는다.
