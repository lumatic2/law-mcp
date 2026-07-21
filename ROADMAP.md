# ROADMAP

> 마지막 업데이트: 2026-07-21
> 상태: **active horizon 없음** — `upstream-delivery` 2026-07-21 종료(닫는 기준 5/5 실측 달성).
> 다음 방향은 사용자 결정 사항이다 (`/harness` §B0.5 Horizon 설계).
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `OBJECTIVE.md`)
> line budget: <=150

## Current Horizon

**없음.** 직전 horizon `upstream-delivery` 는 2026-07-21 closed.

- 결과: 법령 recall@3 76% → **93.3%(홀드아웃 blind, 최초 개봉)** · 1위 정확도 64% → 80% ·
  조문 출하율 92.9%/정확도 69.2% · 위원회 9종 흡수(도구 개수 11 불변) · 검색 중앙 2939→1966ms.
- 닫는 기준 **5/5 달성**. 축("우리가 랭킹을 만든다" → "upstream 이 가진 것을 손실 없이 전달")도 달성.
- 상세 → `archive/horizons/upstream-delivery.md` · `evidence/bench/2026-07-21-horizon-close-holdout.md`

⚠ **홀드아웃 15건은 close 개봉으로 소진됐다.** 다음 품질 판정에는 새 평가 세트가 필요하다
(라벨링·봉인 절차 재사용 가능 — `bench/run.ts assertHoldoutSeal`).

## Active Milestones

없음 — UD1·UD2·UD3·UD4 전부 completed, horizon 과 함께 아카이브됨 (`docs/BACKLOG.md`).

## Next Candidates

직전 horizon 이 남긴 부채 (우선순위 순 — 확정은 사용자):

- **행정 도메인** — 유일하게 재현되는 약점(dev 60% / holdout 67%). 가설: **총칙-개별법 관계** 부재
  (`이행강제금` → 행정기본법 총칙 대신 은행법·건축법이 올라온다). 재료는 아래 F6.
- **F6 관계 그래프 미사용** — `lsRlt`/`aiRltLs`. 조사에서 확인만 하고 안 썼다. 위 결함의 유력 재료.
- **F20 이름 해석 부분문자열 오집** — `민법 시행령` → 난민법 시행령. UD4 는 경고만 달았고
  근본 해결(부분문자열 폴백)은 남았다.
- 새 평가 세트 라벨링 (품질 판정을 계속하려면 선행)
- `dlytrm` 일상용어 재평가 · `specialDeccTt` 조세심판원 파라미터 재확인
- `eflaw` 시행일 법령 · 별표 3종 · `lsStmd`/`thdCmp` 법령 관계도

**범위 밖(사용자 발화가 착수 신호)**: 공개 배포 · npm · 발견성.

## 부채 (다음 세션 확인)

- **MCP 재시작 미반영** — UD2(`ai_articles` 필드·`search_law` description)·UD3(`source` enum 5→14)의
  표면 변경이 사용자 MCP 에 아직 안 보인다. 배포 사본(`~/projects/custom-mcps/law-mcp`)은 build 완료 —
  **사용자가 MCP 서버를 재시작하면 반영**된다.

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다.
milestone 완료·compact·horizon close 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-12: 첫 실 horizon 은 ai-accounting-firm issue-back 수리로 개설 (kifrs-rag 선례 준용 —
  새 horizon 은 사용처 결함만 입력으로 연다).
- 2026-07-21: 전수 조사를 **선행**해 horizon 을 연다. 직전 두 horizon 은 착수 후에 "이미 있는
  upstream 기능"을 발견했고(LB3 법원 5종·LB5 용어 색인), 그 부채를 조사로 갚은 뒤 horizon 을 열었다.
- 2026-07-21: 홀드아웃 봉인을 **코드로 강제**한 것(`assertHoldoutSeal`)이 close 시점의 판정을
  살렸다 — 홀드아웃 93.3% > dev 88.0% 로 과적합을 기각했다. 다음 세트도 같은 방식으로 봉인한다.
