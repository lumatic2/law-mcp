# TF4 — `as_of` 가 법령ID 를 받게 (완료 노트)

> 2026-07-23 · horizon `trap-free` · plan `plans/2026-07-23-tf4-asof-law-id.md`

## 1. 결과

검색→시점조회 경로가 이어졌다. `search_law` 가 준 `law_id` 를 사람 손 없이 그대로
`get_law_article(as_of=...)` 에 넘겨 과거 시점 조문을 받는다.

수리: `resolveLawName` 추가 — 숫자 ID 면 상류 본문 조회로 `법령명_한글` 을 받아 온다.
이름을 추측하지 않고, 이름을 못 받으면 시점 경로로 들어가지 않는다.

## 2. 이슈와 해결

- **결함이 지시와 정면으로 어긋나 있었다.** 서버 instructions 는 "세금·연도가 걸린 질문은
  `as_of` 를 쓰라"고 지시하는데, 그 지시를 따르는 정상 경로(`search_law` → `law_id` → `as_of`)가
  반드시 끊겼다. 시행판 목록 조회가 이름 질의 + 이름 정확일치라 숫자 ID 는 0건이 된다.
- **조용한 실패가 아니라 조용한 성공을 경계해야 했다.** 시점 해석이 실패하고 현행으로 대체되면
  테스트는 통과하는데 답은 틀린다. 그래서 실패 검증을 "과거와 현행의 본문이 실제로 다른가"로
  잡았다 — 2020(627자)/2024(707자)/현행(702자) 셋 다 달랐다.
- 프로브 도중 HTTP 404 가 한 번 났으나 재실행에서 재현되지 않았다(상류 일시 오류).

## 3. 증거

- `evidence/2026-07-23-tf4-asof-chain-e2e.md` — 체인 왕복 원문 + 연도별 본문 길이 대조
- `changesets/20260723-tf4-asof/README.md` — step 1~2 검증 체크
- 크기 회고: 선언 changesets>=2 / 실측 디렉터리 1 · step 2 · 커밋 2 — 정합(기록-합본 규약).
실표면: `npx tsx src/asof-chain-smoke.ts` — 실 MCP 클라이언트에서 `search_law`(→ 소득세법
  law_id=001565) → `get_law_article(제59조, as_of)` 가 한 체인으로 성공, `as_of_rule` 수신,
  시행일 20200828/20240701/20260101 이 각각 다른 본문을 반환.
재현: `npx tsx src/asof-chain-smoke.ts` · `npm test` 317/317 ·
  배포 사본 `git pull && npm run build` 후 dist 에 `resolveLawName`·`asOfLawName` 반영 확인
평가 못 함: 배포 사본에서는 인증값이 MCP 설정 env 로만 오므로 dist 라이브 왕복은 못 했다 —
  빌드 산출물에 수리가 들어갔는지와 서버 기동만 확인했다.
⚠ 재시작 부채: **사용자가 MCP 서버를 재시작해야** 이 세션의 도구 응답에 반영된다.
