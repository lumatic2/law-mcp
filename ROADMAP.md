# ROADMAP

> 마지막 업데이트: 2026-07-31
> 상태: **목표 "세법 완성" milestone 연쇄 진행 중** — M1·M2·M3 completed, M4 active
> (연쇄 승인 2026-07-31, `--chain` 등록). 닫는 기준 4축 = 자료원 완결 · 측정 재기준선 · 함정 소진 · 실전 리허설.
> 기준선(before) = `pass^3` 86.0% · `SR@1` 80.6% · recall@3 84.2% (`evidence/bench/2026-07-31-m1-baseline/`).
> ⚠ horizon 층은 폐지됐다(하네스 재조립 C4) — 이 연쇄는 북극성 바로 아래 milestone 연쇄다.
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `CLAUDE.md` 「북극성」 절)
> line budget: <=150

## Current Goal

<!-- harness:goal id="tax-complete" -->
목표: **세법 완성** — 세무 질문의 근거 사슬(법령→해석→선례) 어느 고리를 물어도 도구 경로가 있고,
그 경로가 측정으로 검증됐고, 알려진 함정 목록이 비어 있다. 진행 순서 규약(`CLAUDE.md` §진행 순서)의
① 단계. 리서치 → `research/2026-07-31-세법완성-자료원지도.md`.
연쇄: M1 → M2·M3(병렬 가능) → M4. "완성" 닫는 판정은 M4 보고서를 본 사용자가 내린다.

## Active Milestones

<!-- harness:milestone id="M1" status="completed" priority="P0" evidence="archive/reports/2026-07-31-m1-source-map-close.md · evidence/bench/2026-07-31-m1-baseline/ · docs/adr/0003-세법-자료원-처분표.md" -->
### M1 — 자료원 지도 확정 + before 기준선
- DoD: 근거 유형 지도 14행 전부에 처분 판정(연결됨/연결 대상/공백+이유) ADR 존재 · 미확인 8건이
  실 API 증거와 함께 소진 · dev 기준선(범용 러너 + 블라인드 3회 에이전트, AR2 동일 프로토콜)이
  evidence 로 남아 M4 가 비교 가능 · `git diff --stat src/` 0줄 · `npm test` 전건.
- Evidence: archive/reports/2026-07-31-m1-source-map-close.md · evidence/bench/2026-07-31-m1-baseline/ · docs/adr/0003-세법-자료원-처분표.md
- Gap: 핸드오프의 "심판례·예규 미연결"은 낡은 전제였다(TV2 로 연결 완료). 진짜 공백(기본통칙·
  집행기준·조세조약 등)은 상류 경로 존재 자체가 미확인이고, 어순 오판 선례(문서상 `specialDeccTt`
  → 실제 `ttSpecialDecc`)가 재발 위험으로 남아 있다. 기준선도 20건짜리뿐이다.
- Scale: changesets>=1; surfaces: 상류 프로브·처분표 ADR·재기준선; capability: 연결 계획이 추측이
  아니라 실측 위에 선다
- Plan: `plans/2026-07-31-m1-자료원지도.md`
- Status: [x]

- Completed at: 2026-07-31
- Summary: 14행 처분표(연결8·대상4·공백2) + before 기준선 pass^3 86.0%·SR@1 80.6%·recall@3 84.2%
<!-- harness:milestone id="M2" status="completed" priority="P0" evidence="archive/reports/2026-07-31-m2-source-connect-close.md · evidence/2026-07-31-m2-sources-e2e.md" -->
### M2 — 자료원 연결 (M1 처분 "연결 대상" 판정분)
- DoD: 처분표의 "연결 대상" 행 전부 연결 또는 "공백+이유" 재판정 — 판정 없는 행 잔존 = 미완료 ·
  연결 자료원 전부 실 MCP E2E 응답 원문 evidence · `npm test` 전건 · 배포 사본 build + dist 스모크 ·
  재시작 부채 명시.
- Evidence: archive/reports/2026-07-31-m2-source-connect-close.md · evidence/2026-07-31-m2-sources-e2e.md
- Gap: 조세조약(국제거래 1차 근거)·별표 세율표(97건 실측)·신구법 비교 경로 없음. 기본통칙·집행기준은
  경로 존재부터 M1 판정 대기. 예규(`ntsExpc`)는 전문조회 없이 원문링크만이라 본문 도달 미검증.
- Scale: changesets>=2; surfaces: `SOURCE_DESCRIPTORS` 확장(도구 개수 불변)·통합 테스트·실 E2E;
  capability: 세무 근거 사슬 전 고리에 도구 경로가 있다
- Plan: `plans/2026-07-31-m2-자료원연결.md`
- Status: [x]

- Completed at: 2026-07-31
- Summary: trty·oldAndNew·licbyl 연결(enum 19→22, 도구 11 불변) + 예규 본문 NTS 경로. 실 MCP 체인 전부 통과
<!-- harness:milestone id="M3" status="completed" priority="P0" evidence="archive/reports/2026-07-31-m3-trap-fix-close.md · evidence/2026-07-31-m3-traps-e2e.md" -->
### M3 — 함정 소진 (J·F·I·D)
- DoD: J(law_name null)·F(5xx 오분류)·I(위임 지연 3.3초)·D(본법/시행령 전달) 각각 회귀 테스트 고정 +
  실 MCP 재현 시나리오 통과, 수리 불가 판정은 "안 고침+이유"로 CANDIDATES 재적재 · `npm test` 전건 ·
  배포 사본 스모크 · 재시작 부채 명시.
- Evidence: archive/reports/2026-07-31-m3-trap-fix-close.md · evidence/2026-07-31-m3-traps-e2e.md
- Gap: 넷 다 "아는 사람만 피하는 함정" — J 는 응답만으로 무슨 법인지 모르고, F 는 인증 문제를 영원한
  재시도로 위장하고, I 는 조문 지연의 64%, D 는 에이전트가 본법·시행령을 회차마다 오간다(d05·d09).
- Scale: changesets>=2; surfaces: `lawgo-provider.ts` 결함별 수리·회귀 테스트·실 MCP 재현;
  capability: 우회 지식 없이 도구를 그대로 믿을 수 있다
- Plan: `plans/2026-07-31-m3-함정소진.md`
- Status: [x]

- Completed at: 2026-07-31
- Summary: J·F·I·D 수리, 회귀 9건 고정, 실 MCP 재현 통과. D 효과는 M4 측정
<!-- harness:milestone id="M4" status="active" priority="P0" -->
### M4 — after 측정 + 실전 리허설 + 완성 판정
- DoD: M1 과 동일 세트·지표 재측정 + before/after 비교표(회귀 판정선 pass^3 −5%p 이내) · 블라인드
  실전 리허설 5건 실 세션 기록 · 닫는 기준 4축 대조 판정 보고서(git 추적 경로) · 잔여는 CANDIDATES
  적재 · `git diff --stat src/` 0줄. **"완성" 선언과 다음 분야 진행은 사용자 결정.**
- Evidence: (완료 시 기입)
- Gap: 측정 전 M2·M3 의 배포 사본 반영+서버 재시작(사용자)이 선행돼야 한다 — 소스만 바뀐 상태의
  측정은 무효(배포 사본 분리 함정).
- Scale: changesets>=1; surfaces: 재측정·리허설·판정 보고서; capability: "완성됐다"가 주장이 아니라
  증거다
- Plan: `plans/2026-07-31-m4-측정과판정.md`
- Status: [ ]

## Next Candidates

후보 백로그 정본 → `plans/horizons/CANDIDATES.md` (순서는 사용자 소유).
요약: 다음 분야 vertical(노동·부동산) · 소비 표면(서버 instructions — M4 측정 후에만) ·
홀드아웃 재구성(E·L) · 벤더 교차 측정 · AR3 어휘 공백 경고 유지 여부.

**범위 밖(사용자 발화가 착수 신호)**: 공개 배포 · npm · 발견성 · 회계(§범위).

## Archive Pointer
완료 이력은 `docs/BACKLOG.md` 참조 (trap-free TF1~TF4 는 2026-07-31 compact 로 이관).
ROADMAP.md 는 150줄 이하 current 연쇄만 유지한다. milestone 완료·compact 는 `/harness-done` 이 처리.

## 의사결정 이력
"왜 X 안 함?" 같은 선택은 `docs/adr/` 에 ADR 로.
- 2026-07-31: "세법 완성" 닫는 기준 4축(자료원·측정·함정·리허설) 사용자 확정. 스크래핑 안 함(공식
  API 만) · 별표는 메타+링크까지 · D 수리는 응답 표면까지(instructions 는 후보 B 로 봉인).
- 2026-07-21: 전수 조사를 **선행**해 계획을 연다. 직전 두 horizon 은 착수 후 "이미 있는 upstream
  기능"을 발견했다. (2026-07-31 재적용: M1 프로브가 연결 계획에 선행.)
- 2026-07-21: 홀드아웃 봉인을 **코드로 강제**한 것이 close 판정을 살렸다. 다음 세트도 같은 방식.
- 2026-07-21: 넓이 대신 **분야 깊이**로 축 전환. 근거 = 행정 A/B 이득 0 vs 세법 미연결 자료원 실측.
