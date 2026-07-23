## 이어서 할 일
> 2026-07-23 세션 종료 시 기록

- **다음 horizon 미정 — 착수 전 사용자와 선정.** 후보 5건은 `plans/horizons/CANDIDATES.md`
  하단("agentic-reach 가 남긴 후보"). 순서는 사용자 소유.
- **최우선 후보 = 홀드아웃 주제를 에이전트가 고르지 않는 절차.** 이번 홀드아웃이 `pass^5` 100%로
  변별력을 잃은 직접 원인(6/10을 에이전트가 주제까지 고름). 자를 다시 못 믿게 되는 위험.
- **미결 결정 — AR3(어휘 공백 경고) 유지 여부.** `SR@1` −8.3%p vs `pass@3` +5%p.
  근거표 → `evidence/bench/2026-07-23-ar4-holdout.md` §AR3 재판정. 되돌리면 `src/` 변경 + 재배포.
- **결함 — `as_of`가 법령ID를 못 받는다.** `search_law`는 `law_id`를 주는데 `as_of`는 법령명을
  요구해 검색→시점조회 경로가 끊긴다. 재현: `get_law_article(law_id="001586", as_of="2024")`.
- **라벨 쟁점 — 본법 vs 시행령.** d05·d09가 3회 중 일부만 맞는데 오답이 전부 시행령이다.
  "대통령령으로 정한다" 위임 지점의 정답 규약을 먼저 정해야 한다.

### 계획 위치 (cascade)
- Objective: 한국 사람들이 '법' 작업을 AI 에이전트로 할 때 설치하는 MCP의 대표 중 하나가 된다
- Horizon: **없음** — `agentic-reach` 2026-07-23 closed (`archive/horizons/agentic-reach.md`)
- Milestone(active): **없음** — AR1~AR4 전부 completed
- Step: 해당 없음
- 다음 차례: `/harness` §B0.5 Horizon 설계 — `plans/horizons/CANDIDATES.md`에서 후보 선정 후
  `plans/horizons/<slug>.md` 작성 → milestone plan 일괄 작성 → 승인 게이트

### 현재 상태 / 주의점
- 커밋·푸시 완료(`79be9ff`, master). working tree clean.
- `npm test` **314/314** · 범용 dev `golden-v2` recall@3 **88.0%**.
- **홀드아웃(golden-tax-agentic) 소진됨 — 비가역.** 새 horizon은 새 홀드아웃이 필요하다.
- **홀드아웃 수치는 신뢰하지 않는다**(사용자 확정) — 과적합 기각만 채택, `pass^5` 100%는 근거 불가.
- 신뢰 가능한 기준선 = dev 20건 `pass^3` **90%** · `SR@1` 80% · 기권 100%/100%.
- 블라인드 측정은 `orca terminal create`로 실 세션을 띄운다 — **Codex 서브에이전트는 네트워크
  차단**(`EACCES :443`)이라 못 쓴다. 절차: `bench/tool-cli.ts` + BRIEF/tasks.json.
- ROADMAP 100줄(budget 150), marker 4개 전부 `completed`. session-end는 ROADMAP을 수정하지 않았다.
