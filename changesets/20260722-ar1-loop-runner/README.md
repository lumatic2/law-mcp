# changeset: AR1 step-1 — 에이전트형 루프 러너 골격

- milestone: AR1 step-1 · 날짜: 2026-07-22
- `bench/` 신규 파일만 추가. **`src/` 0 줄** → 배포·재시작 불요.

## 무엇을

구 벤치(`bench/run.ts:140`)가 건너뛰던 **에이전트 층**을 복원했다. 맥락을 받은 에이전트가
쿼리를 짜고, 도구 응답의 warnings 를 읽고, 재질의하고, 조문 하나를 확정 지목하는 루프.

## 설계 결정

- **종료 = `submit_answer` 확정 지목.** "상위 N 에 있었다"로 퇴화하면 멀티턴의 의미가 없다
  (리서치 권고 1 함정). 채점기는 그 인자를 정답 튜플과 문자열 비교 → **LLM judge 0개**.
- **침묵 ≠ 기권.** 손 놓은 것(`submitted=null`)과 "모르겠다"(`not_found=true`)를 다른 값으로
  기록한다. 안 그러면 기권 정밀도/재현율(닫는 기준 5)을 못 잰다.
- **LLM 은 `Agent` 인터페이스 뒤.** 결정적 `ScriptedAgent` 로 루프 기계장치를 LLM 없이 검증한다 —
  자격증명이 붙었을 때 실패 원인이 루프인지 모델인지 갈리게.
- 도구 실행은 **실 프로바이더**를 친다(모킹 없음).

## 검증 — `npx tsx bench/agentic-run.ts --selftest`

정상 경로 · **턴 상한**(50턴 스크립트가 cap=3 에서 멈춤) · 침묵 · 기권 선언 4종 PASS.
`git diff --stat src/` 0 줄 · `npm test` 302/302.

## 미완 — 자격증명 대기

실 LLM 에이전트 구현 + 1케이스 비용 실측이 남았다. `ANTHROPIC_API_KEY` 미설정 ·
`ant` CLI 미설치로 LLM 왕복을 못 돌렸다. 문자수 실측·추정은
`evidence/bench/2026-07-22-ar1-cost.md` 에 있으나 **미검증**이다.

## 산출물
- `bench/agentic-run.ts` · `evidence/bench/2026-07-22-ar1-cost.md`
- `evidence/bench/2026-07-22-ar1-selftest.jsonl` (트래젝토리 4건)
