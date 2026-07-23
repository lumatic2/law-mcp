# ROADMAP

> 마지막 업데이트: 2026-07-23
> 상태: **horizon `trap-free` (함정 없음) closed (2026-07-23)** — 닫는 기준 7종 중 6종 충족,
> 1종(형식 중립 커버리지)은 지표 정의 오류로 topic 기준 재정의. active milestone 없음.
> ⚠ 에이전트 지표의 새 기준선은 없다 — 유효한 값은 여전히 AR2 dev 20건 `pass^3` 90%.
> ⚠ 재시작 부채: 사용자가 MCP 서버를 재시작해야 TF3·TF4 의 `src/` 변경이 반영된다.
> 다음 horizon 미정 — 후보는 `plans/horizons/CANDIDATES.md`.
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `CLAUDE.md` 「북극성」 절)
> line budget: <=150

## Current Horizon

<!-- harness:goal id="trap-free" -->
목표: **함정 없음** 축을 양쪽에서 민다 — 사용자가 만나는 함정(설치 첫 화면의 `LAW_API_OC`)과
우리가 만나는 함정(평가 문제가 4파일로 흩어져 124건 중 34건만 쓰인다).
한 문장: 처음 붙이는 사람이 막히지 않고, 우리가 가진 문제를 전부 쓸 수 있다.
(closed plan → `plans/horizons/trap-free.md` · 종료 보고 →
`archive/reports/2026-07-23-trap-free-close.md` · 선언 ~10 / 실측 11 step)

직전 horizon `agentic-reach` 는 2026-07-23 closed (닫는 기준 6/6, 단 홀드아웃 변별력 저하로
절대 수치 미채택). 그 원인이 이 horizon 의 출발점이다 — 골드 세트를 4번 만들었고(124건 중
34건만 에이전트 하네스가 쓴다). 봉인 회전 기계장치는 2026-07-23 사용자 판정으로 범위에서 제외했다
— 튜닝 대상이 없어 장치가 놀고 미개봉 문제도 0개다. 규약 ADR 로만 남기고 그 자리에 세법 결함
수리(TF4)를 넣었다.

## Active Milestones

<!-- harness:milestone id="TF1" status="completed" priority="P0" evidence="archive/reports/2026-07-23-tf1-corpus-close.md · evidence/bench/2026-07-23-tf1-reproduction.md · changesets/20260723-tf1-corpus/" -->
### TF1 — 단일 코퍼스
- DoD: `bench/corpus.json` 단일 파일에 distinct 124건, 스키마 검증 exit 0. 러너 2종이 통합 전
  수치를 **재현**(범용 dev `recall@3` ≥88.0% · agentic dev `pass^3` ≥90%) — 미달은 통합 실패로
  판정한다. 본법/시행령 정답 규약이 ADR 로 존재하고 위임 지점 케이스 전수가 규약대로 라벨링됨.
  `npm test` 전건 · `git diff --stat src/` 0줄.
- Evidence: archive/reports/2026-07-23-tf1-corpus-close.md · evidence/bench/2026-07-23-tf1-reproduction.md · changesets/20260723-tf1-corpus/
- Gap: 골드 세트가 4파일로 흩어져 있고 형식이 갈린다 — `golden`·`golden-v2`·`golden-tax` 는
  `query`(라벨 문자열), `golden-tax-agentic` 만 `context`(자연어 맥락). 그래서 124건 중 34건만
  에이전트 하네스가 쓸 수 있고 90건이 사장돼 있다.
- Scale: changesets>=3; surfaces: 라벨 규약 ADR·마이그레이션·러너 2종 재현; capability: 케이스를
  형식과 무관하게 보관한다 — 형식이 바뀌어도 데이터를 다시 안 만든다
- Status: [x]

- Completed at: 2026-07-23
- Summary: 골드 4파일 → bench/corpus.json 124레코드/92topic. 8개 지표 전부 재현 일치. 라벨 규약 ADR 0001 확정·4건 적용.
<!-- harness:milestone id="TF2" status="completed" priority="P0" evidence="archive/reports/2026-07-23-tf2-context-close.md · evidence/bench/2026-07-23-tf2-context-quality.md · docs/adr/0002-평가-문제-봉인-규약.md · changesets/20260723-tf2-context/" -->
### TF2 — 맥락 전건 부착
- DoD: 맥락 커버리지 100%(전건 `query`+`context`), 유출 탐지기 적발 0, 일부러 유출시킨 문단은
  거부. **신규 주제 0건**이 스크립트로 증명됨(모든 `expected_article` 이 통합 전 4파일에 존재).
  봉인 규약 ADR 존재(기존 124건 전부 개봉됨을 명시 + 다음에 문제를 늘릴 때의 절차 규정).
  dev 기준선 산출(지표 전종) · `npm test` 전건 · `src/` 0줄.
- Evidence: archive/reports/2026-07-23-tf2-context-close.md · evidence/bench/2026-07-23-tf2-context-quality.md · docs/adr/0002-평가-문제-봉인-규약.md · changesets/20260723-tf2-context/
- Gap: 코퍼스를 합쳐도 90건이 맥락이 없으면 에이전트 하네스에서 여전히 못 쓴다. 또한 지난번
  홀드아웃 오염(10건 중 6건을 에이전트가 주제까지 골랐다)이 반복되지 않음을 기계로 보여야 한다.
- Scale: changesets>=2; surfaces: 맥락 부착·재기준선·규약 ADR; capability: 124건 전부가 에이전트
  하네스에서 실제로 돈다
- Status: [x]

- Completed at: 2026-07-23
- Summary: topic 커버리지 100%(94/94), 유출 0, 신규 주제 0건 기계 증명, 봉인 규약 ADR 0002. 재기준선은 의도적 미산출.
<!-- harness:milestone id="TF3" status="completed" priority="P1" evidence="archive/reports/2026-07-23-tf3-install-close.md · evidence/2026-07-23-tf3-no-credential-e2e.md · changesets/20260723-tf3-install/" -->
### TF3 — 설치 관문
- DoD: README 가 노출 도구 11개를 전부 담고 대조 스크립트가 그것을 강제. OC 미설정 환경에서 실제
  MCP 클라이언트가 받는 안내 메시지가 증거로 남음(스택트레이스 아님). 발급 절차의 외부 URL 전부
  접근일 병기. `npm test` 전건 · 배포 사본 build + dist 스모크 · **재시작 부채 명시**.
- Evidence: archive/reports/2026-07-23-tf3-install-close.md · evidence/2026-07-23-tf3-no-credential-e2e.md · changesets/20260723-tf3-install/
- Gap: README 는 도구 11개 중 4개만 적고 OC 를 어디서 받는지 한 줄도 없다. 상류(법제처)도 절차를
  공개하지 않는다(공개 페이지 3곳 실측). 신규 사용자 100%가 만나는 첫 관문이 무주공산이다.
- Scale: changesets>=3; surfaces: README 대조 스크립트·런타임 진단·무자격 E2E; capability: 처음
  붙이는 사람이 자력으로 통과한다
- Status: [x]

- Completed at: 2026-07-23
- Summary: README 도구 4→11, OC 발급 링크+IP등록 근거, 무자격·인증실패 사람이 읽는 진단, 실 MCP 무자격 관측 + 배포 사본 스모크.
<!-- harness:milestone id="TF4" status="completed" priority="P1" evidence="archive/reports/2026-07-23-tf4-asof-close.md · evidence/2026-07-23-tf4-asof-chain-e2e.md · changesets/20260723-tf4-asof/" -->
### TF4 — `as_of` 가 법령ID 를 받게
- DoD: `get_law_article(law_id=..., as_of=...)` 가 동작하고 회귀 테스트가 고정. 실 MCP 클라이언트에서
  `search_law` → `law_id` → `as_of` 체인이 성공하고 응답 원문이 증거로 남음. 과거 연도와 현행의
  조문 내용이 실제로 다름을 확인. 해석 실패 시 현행으로 대체하지 않는다. `npm test` 전건 ·
  배포 사본 build + dist 스모크 · 재시작 부채 명시.
- Evidence: archive/reports/2026-07-23-tf4-asof-close.md · evidence/2026-07-23-tf4-asof-chain-e2e.md · changesets/20260723-tf4-asof/
- Gap: `getLawArticle` 이 `resolveAsOfVersion(lawId, ...)` 로 **ID 를 이름 자리에 넘긴다**
  (`src/providers/lawgo-provider.ts:1477` → :1537 `fetchLawVersions(lawName)`). 서버가 에이전트에게
  "세금·연도 질문은 `as_of` 를 쓰라"고 지시해 놓고(`src/index.ts:42`) 그 경로가 끊겨 있다.
- Scale: changesets>=2; surfaces: 시점 해석 수리·회귀 테스트·실 MCP 체인; capability: 검색으로 찾은
  법령을 그대로 귀속연도 시점으로 조회한다
- Status: [x]

- Completed at: 2026-07-23
- Summary: resolveLawName 추가로 검색→시점조회 체인 복구. 실 MCP 관측 + 연도별 본문 차이 확인.
## Next Candidates

후보 백로그 정본 → `plans/horizons/CANDIDATES.md` (순서는 사용자 소유).
요약: 다음 분야 vertical(노동·부동산) · 남은 upstream 자료원 · 위임조문 지연(3.3초) ·
벤더 교차 측정 · AR3 어휘 공백 경고 유지 여부 · `as_of` 가 법령ID 를 못 받는 결함.

**범위 밖(사용자 발화가 착수 신호)**: 공개 배포 · npm · 발견성.

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다.
milestone 완료·compact·horizon close 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-21: 전수 조사를 **선행**해 horizon 을 연다. 직전 두 horizon 은 착수 후에 "이미 있는
  upstream 기능"을 발견했고, 그 부채를 조사로 갚은 뒤 horizon 을 열었다.
- 2026-07-21: 홀드아웃 봉인을 **코드로 강제**한 것(`assertHoldoutSeal`)이 close 판정을 살렸다 —
  홀드아웃 93.3% > dev 88.0% 로 과적합을 기각했다. 다음 세트도 같은 방식으로 봉인한다.
- 2026-07-21: 넓이 대신 **분야 깊이**로 축을 바꾼다. 근거 = 행정 A/B 이득 0(랭킹 수확체감) vs
  세법의 미연결 자료원 실측(심판례 4,688 · 예규 1,938 · 과거 시점 조문).
