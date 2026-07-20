# ROADMAP

> 마지막 업데이트: 2026-07-21
> 상태: horizon `general-legal-coverage` — LB1·LB2·LB3 완료, LB5(품질 2축) 진행 중
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `OBJECTIVE.md`)
> line budget: <=150

## Current Horizon

<!-- harness:goal id="general-legal-coverage" status="active" -->
### 범용 법률 커버리지 → `plans/horizons/general-legal-coverage.md`
세무 특화(실은 희귀어 특화) 도구를 법 일반 도구로. 실측 갭: 비세무 13쿼리 정답 포함률 31%,
법원 5종 미지원, 조문 단위 도달 불가. 무감독 분량: 최소 3 무감독 세션.
배포·공개(구 LB4)는 2026-07-21 범위에서 제외 — 착수 신호는 사용자 발화다(품질 수치가 아니라).

(직전 horizon `issueback-repair-h8ta2` 완료 2026-07-12 — 결함 4건 수리 + ib1b 전문 도달.
후속 유지보수 ib3·ib4 로 Issue-back Queue #6·#7 및 엔티티 결함까지 소진. 상세는 docs/BACKLOG.md)

## Active Milestones

<!-- harness:milestone id="LB1" status="completed" priority="P0" evidence="changesets/20260720-lb1-golden-set + changesets/20260720-lb1-bench-runner + changesets/20260720-lb1-baseline + evidence/bench/2026-07-20-baseline.json" -->
### LB1 — 정답 도달 측정 하네스
- DoD: `npm run bench:golden -- --split dev` 가 실 API 로 완주해 recall@3 기준선을 파일로 남긴다.
  홀드아웃은 미측정 봉인. 검색 로직은 이 milestone 에서 변경하지 않는다.
- Evidence: changesets/20260720-lb1-golden-set + changesets/20260720-lb1-bench-runner + changesets/20260720-lb1-baseline + evidence/bench/2026-07-20-baseline.json
- Gap: 검색 품질이 인상뿐이라 개선을 주장·반증할 수 없다 (research 2026-07-20 §1)
- Scale: changesets>=3; surfaces: bench 러너·실 API·npm test; capability: 검색 품질을 수치로 측정
- Status: [x]

- Completed at: 2026-07-21
- Summary: 골든셋 40건·채점 러너·기준선 recall@3 44.0% 확정
<!-- harness:milestone id="LB2" status="completed" priority="P0" evidence="changesets/20260720-lb2-article-index + changesets/20260721-lb2-{article-match,two-mode-bench,verify-citation,title-weight-and-holdout} + evidence/bench/2026-07-21-curation-verdict.md" -->
### LB2 — 조문 단위 도달 + 랭킹 실질 개선
- DoD: `search_law_articles` 실 API 도달 + dev recall@3 기준선 대비 상승 + 홀드아웃 1회 측정 기록
  + 검색 1회 지연 ≤3초 + 세무 회귀 6종 무변.
- Evidence: changesets/20260720-lb2-article-index + changesets/20260721-lb2-{article-match,two-mode-bench,verify-citation,title-weight-and-holdout} + evidence/bench/2026-07-21-curation-verdict.md
- Gap: 조문 단위 검색 타깃이 upstream 에 없어 "몇 조"에 답 못 하고, 그 때문에 랭킹 신호도 없다
  (research 2026-07-20 §3)
- Scale: changesets>=4; surfaces: MCP 도구·실 API·bench·npm test; capability: 어느 법 몇 조인지 답한다
- Status: [x]

- Completed at: 2026-07-21
- Summary: verify_citation 신설 + 2모드 측정(dev blind 44.0%/assisted 62.5%, holdout 60.0%/73.3%) + C안 조건부 판정
<!-- harness:milestone id="LB3" status="completed" priority="P1" evidence="changesets/20260720-lb3-source-adapter + changesets/20260720-lb3-source-tools + changesets/20260720-lb3-contribution-gate + evidence/bench/2026-07-21-lb3-contribution.md" -->
### LB3 — 누락 법원(法源) 5종 도구화
- DoD: 등록된 법원 도구가 각 실 API 1건 이상 도달 + 기여도 리포트 수치 제시 + 기여 0 법원 미등록
  + 기존 도구 회귀 없음.
- Evidence: changesets/20260720-lb3-source-adapter + changesets/20260720-lb3-source-tools + changesets/20260720-lb3-contribution-gate + evidence/bench/2026-07-21-lb3-contribution.md
- Gap: 법령해석례·헌재결정례·행정심판재결례·자치법규·법령용어 타깃이 전부 실재하는데 미지원
  (research 2026-07-20 §2)
- Scale: changesets>=3; surfaces: MCP 도구·실 API·npm test; capability: 법령·판례 밖 법원에 도달
- Status: [x]

- Completed at: 2026-07-21
- Summary: 법원 5종 도구화 — 공통 어댑터로 도구 2개에 담고(표면 9→11) 기여도 실측으로 게이트
<!-- harness:milestone id="LB5" status="active" priority="P0" -->
### LB5 — 용어 연계로 품질 2축(넓이·도달) 개선
- DoD: dev blind recall@3 가 44.0% 대비 상승(A/B 근거 제시) + assisted acc@3 62.5% 대비 상승
  + 무신호 쿼리 결과 무변 + 검색 1회 추가 호출 ≤2 + 홀드아웃 1회로 과적합 판정.
- Evidence: `plans/2026-07-21-lb5-term-linkage.md` + `research/2026-07-21-lb5-term-linkage-probe.md`
- Gap: 구어↔법문 용어 갭이 실패 주원인인데 그 매핑이 아예 없다. 법제처가 제공하는 용어 연계
  색인(lstrmAI/lstrmRlt/lstrmRltJo)·법령약칭(lsAbrv)을 미사용 (research 2026-07-21)
- Scale: changesets>=5; surfaces: 검색 후보 생성·조문 점수·bench 2모드; capability: 사람 말로 물어도 닿는다
- Status: [ ]

<!-- harness:milestone id="IB1" status="completed" priority="P0" evidence="changesets/20260712-ib1-h8ta2-repair + npm test 9/9 + 실 API 재현 4/4" -->
### IB1 — get_precedent NTS 소스 본문 도달 + 검색 결함 수리
- DoD: ① 실패 5건(619683/618097/310830/325202/612611) 중 NTS 소스 판례의 본문(판시사항·판결요지
  또는 판례내용 텍스트)이 `get_precedent`로 도달하거나, 구조적 불가 시 대체 경로(자동 폴백 +
  구체 안내)가 구현·검증됨 ② `search_law`/`search_admin_rules` 본문 키워드 검색 지원(law.go.kr
  DRF search=2 등) — "가지급금" 류 쿼리가 법인세법 계열 도달 ③ 다단어 자연어 쿼리 0건 시 완화
  재시도 폴백(경고 포함) ④ 대형 admin rule 부분 반환 옵션 또는 문서화. 전부 실 API 스모크로 검증
- Evidence: changesets/20260712-ib1-h8ta2-repair + npm test 9/9 + 실 API 재현 4/4
- Gap: ai-accounting-firm H8 TA2 조세불복 의견서 실험에서 판례 인용이 제목 수준으로 제한 —
  판례 검색 기능의 실효성 붕괴 (docs/BACKLOG.md Issue-back Queue #1~#4)
- Status: [x]

- Completed at: 2026-07-12
- Summary: 결함 4건 수리: NTS 폴백(5/5 요지 도달)·본문검색·완화재시도·부분반환, 게이트 독립 재현 PASS
## Next Candidates
- (없음 — 현 horizon LB1~LB3 소진. 닫는 기준 미달 축(정답 포함률·조문 정확도)이 다음 입력)

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조. ROADMAP.md 는 150줄 이하 current horizon 만 유지한다. milestone 완료·compact 는 `/harness` 가 처리한다.

## 의사결정 이력
"왜 X sync 방식을 씀?", "왜 Y host 는 candidate 로 둠?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-12: 첫 실 horizon 은 ai-accounting-firm issue-back 수리로 개설 (kifrs-rag 선례 준용 —
  새 horizon 은 사용처 결함만 입력으로 연다).
