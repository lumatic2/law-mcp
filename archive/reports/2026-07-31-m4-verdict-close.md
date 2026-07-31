# M4 · after 측정 + 실전 리허설 + 완성 판정 — 완료 노트

## 1. 결과

- step-1 after 재측정(2라운드): pass^3 86.0%(Δ0, 회귀 판정선 통과) · pass@3 97.7%(+7.0%p) ·
  SR@1 81.4% · 범용 recall@3 84.2% 동일. 전패 4건 중 2건(tax-04·v2-11) 완전 구제.
- step-2 블라인드 리허설 5건: 도달 2 · 부분도달 3 · 실패 0 · 추측 답변 0. 미도달 3건 원인
  분류 완료(도구 결함 2 = 후보 P·Q 적재 / 자료원 공백 1 = ADR 0003 처분, 사용자 재판정 제기).
- step-3 세법 완성 4축 판정 보고서: `archive/reports/2026-07-31-m4-tax-complete-verdict.md` —
  3충족 + 1부분(④). **닫는 판정은 사용자 소유** — 결정 ⓐ(완성 선언) ⓑ(공백 재판정)
  ⓒ(다음 진행) 제기 상태.

## 2. 이슈와 해결

- 1라운드 회귀(pass^3 −6.9%p): DELEGATION_NOTICE 1차 문구의 시행령 편향 → ADR 0001 기준으로
  재작성 후 2라운드 원복+개선. **계획 이탈**(src/ 무변경 계획인데 1개소 수정) — finding 큐
  기록·재측정 검증·배포 사본 반영으로 수습.
- 운영 사고 2건: ① 1R 원자료 보존 전 삭제(요약·diff 재구성만 보존 — 다음부터 회귀 라운드
  원자료 즉시 커밋) ② 리허설 스폰 프롬프트 Enter 미전송 45분 방치(스폰 후 화면 read 로 실행
  시작 확인 규칙).
- 크기 회고: M4 는 changeset 없이 evidence·보고서 3커밋으로 닫힘 — 측정·판정 milestone 이라
  changeset 1개 기준 미적용, step 3개+통합 검증(4축 보고서)으로 milestone 규모 정합.

## 3. 증거

- 실표면: 블라인드 리허설 5건이 실 MCP 서버(law-mcp stdio)를 신규 세션에서 직접 호출 —
  `evidence/rehearsal-m4/answers.json` 의 tool_chain 전건 실호출, r1 은 `as_of` 체인이
  effective_date 20241112 를 반환(assertion = 채점표 대조, `evidence/2026-07-31-m4-rehearsal.md`).
- 재현: `npx tsx bench/agentic-baseline.ts evidence/bench/2026-07-31-m4-after/run{1,2,3}.json` ·
  `npm test`(337/337 pass) · `git diff --stat src/` 0줄.
- 4축 대조: `archive/reports/2026-07-31-m4-tax-complete-verdict.md`.
