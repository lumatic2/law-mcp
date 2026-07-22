# AR3 — 어휘 공백 신호 + 서버 instructions

- 일자: 2026-07-23 · milestone: AR3 · 갈래: tooling
- 판정: **채택** — `evidence/bench/2026-07-23-ar3-vocab-gap-verdict.md`

## 변경

- `src/vocab-gap.ts` (신규) — 질의 어휘가 결과에 절반 미만으로만 나타나면 경고.
  순위 미변경(경고만 추가) → 손실 0 이 구조적.
- `src/providers/lawgo-provider.ts` — `applyVocabGap` 배선, `vocabGap.enabled` 기본 켜짐.
- `src/index.ts` — 비어 있던 MCP `instructions` 채움.
- `test/vocab-gap.test.ts` (신규 12건) + 기존 테스트 2건 격리 수정.

## 검증

- `npm test` 314/314 · `tsc` exit 0
- 실 표면: 일상어 ON / 법률어 off
- 배포 사본 `npm run build` + `dist/` 직접 실행 스모크 동일 결과

## ⚠ 재시작 부채

MCP 서버 재시작 필요. 누적: TV2 · TV3 · TV5 · AR3.
