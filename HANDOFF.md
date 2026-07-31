# HANDOFF — 세션 핸드오프 (git-tracked, session-end 소유)

## 이어서 할 일
> 2026-08-01 세션 종료 시 기록

- **M9 step-4 부터 이어간다** (승인 영수증 유효, plan hash 불변). 세법 12종 조문 1,804조 수집 —
  `bench/expansion/topics-2026-08-01.json` 의 `mst` 사용, 법당 전문 조회 1회.
  **폴백 금지** — 법령명 불일치 시 중단(`rules.approved.json` `on_name_mismatch: abort`).
- step-5 임베딩 파일럿: 로컬 torch 2.12+cpu · sentence-transformers 5.4(설치 확인, API 키 불요).
  `BAAI/bge-m3` 는 HF 캐시에 있고 한국어 특화 계열만 신규 다운로드가 필요하다.
  덤프 본문은 scratchpad, 레포에는 manifest 만.
- **손실축 기준은 step-3 산출 하나뿐이다** — 단발 조문 top-3 **7/40 = 17.5%**
  (`evidence/bench/2026-08-01-m9-taxonomy/current-article-baseline.json`). M8 에이전틱 90% 로
  대체하면 단위가 달라 손실이 과소 산출된다.
- **이득 상한이 이미 좁혀졌다**: A 5건 중 정규화(치환)가 exp-06 을 2위로 올려, 임베딩 고유 여지는
  **exp-42 한 건**이다. step-6 판정에서 "상한 ≠ 도달률"과 함께 이 사실을 앞에 둔다.
- `.harness/work.json` `next_step` 이 `step-1` 로 남아 있다(승인 재등록 부작용) —
  **plan 체크박스(step-1~3 `[x]`)가 정본**이다.

### 계획 위치 (cascade)
- 북극성: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP 의 대표 중 하나가 된다
- 목표: `query-to-article-mapping` — 일상어→조문 매핑 병목 해소 판단 (M8→M9)
- Milestone(active): **M9 · 매핑 병목 유형화 + 의미검색 상한 프로브 + 판정**
- Step: 완료 3/6 · 다음 leaf **step-4**(세법 12종 조문 전량 수집)
- 다음 차례: `/harness-run` 으로 step-4 → step-5 → step-6(판정 보고서)

### 현재 상태 / 주의점
- master, push 완료(`1d017b8`). `npm test` 356/356 · `git diff --stat src/` 0줄 · package.json 무변경.
- 봉인 20건 미개봉(`opened_at = None`) — 개봉 시점은 사용자 결정.
- ROADMAP read-only: 138줄(≤150), active=1(M9), completed 4. session-end 는 수정하지 않았다.
- 미결 사용자 결정 누적: ⓐ 세법 완성 선언 · ⓑ 기본통칙 공백 재판정 · ⓔ 후보 S 해소 인정 ·
  ⓖ 다음 진행 · **신규 ⓘ 경계 문항 2건(exp-42·48, 후보 X) 처분** · 후보 W 약칭 유출 수리 여부.
