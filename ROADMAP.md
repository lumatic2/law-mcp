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

<!-- harness:goal id="tax-corpus-breadth" -->
목표: **코퍼스를 세법 전반으로** — 측정이 주요 6법(소득·법인·부가·국기·조특·상증) 위에서만 서는
편중을 해소한다. 12법 × 5 = 60 주제를 승인된 결정적 규칙으로 확정해 dev 40 / sealed 20 으로 넣고,
세법 전반 기준선을 처음 세운다. 사용자 결정 ⓓ(2026-07-31). 리서치 →
`research/2026-08-01-코퍼스확장-주제추출-프로브.md`. 연쇄: M5 → M6 → M7.
"세법 전반을 덮었다"는 선언은 M7 보고서를 본 사용자가 한다.

> 이전 목표 **세법 완성**(`tax-complete`, M1~M4)은 2026-07-31 완료 — 4축 판정 보고서
> `archive/reports/2026-07-31-m4-tax-complete-verdict.md` + 넓이 추가 기록
> `archive/reports/2026-07-31-m4-verdict-addendum-breadth.md`. 닫는 판정(ⓐ 완성 선언 ·
> ⓑ 기본통칙 공백 재판정 · ⓒ 다음 분야)은 사용자 미결 상태로 남아 있다.

## Active Milestones

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
<!-- harness:milestone id="M4" status="completed" priority="P0" evidence="archive/reports/2026-07-31-m4-tax-complete-verdict.md" -->
### M4 — after 측정 + 실전 리허설 + 완성 판정
- DoD: M1 과 동일 세트·지표 재측정 + before/after 비교표(회귀 판정선 pass^3 −5%p 이내) · 블라인드
  실전 리허설 5건 실 세션 기록 · 닫는 기준 4축 대조 판정 보고서(git 추적 경로) · 잔여는 CANDIDATES
  적재 · `git diff --stat src/` 0줄. **"완성" 선언과 다음 분야 진행은 사용자 결정.**
- Evidence: archive/reports/2026-07-31-m4-tax-complete-verdict.md
- Gap: 측정 전 M2·M3 의 배포 사본 반영+서버 재시작(사용자)이 선행돼야 한다 — 소스만 바뀐 상태의
  측정은 무효(배포 사본 분리 함정).
- Scale: changesets>=1; surfaces: 재측정·리허설·판정 보고서; capability: "완성됐다"가 주장이 아니라
  증거다
- Plan: `plans/2026-07-31-m4-측정과판정.md`
- Status: [x]

- Completed at: 2026-07-31
- Summary: after 재측정+리허설 5건+4축 판정 보고 — 닫는 판정은 사용자 소유
<!-- harness:milestone id="M5" status="completed" priority="P0" evidence="archive/reports/2026-08-01-m5-topics-close.md" -->
### M5 — 주제 목록 확정 + 규약 개정 + 스키마 배선
- DoD: 승인 규칙이 파일로 외부화되고 60 주제가 동일 규칙·동일 MST 에서 2회 diff 0 으로 재현 ·
  선정 로그로 감사 가능(취향 개입 0) · 가드 3방향(승인 목록 통과 / 목록 밖 차단 / digest 불일치
  차단) 테스트 통과 · `sealed` split 어휘 + `--cases` 고정 세트 재현 플래그 배선 ·
  `git diff --stat src/` 0줄 · `npm test` 전건.
- Evidence: archive/reports/2026-08-01-m5-topics-close.md
- Gap: ADR 0002 §2 가 새 주제를 기계로 차단하고 있어 개정 없이는 확장 불가. `sealed` 는 현행
  스키마 어휘에 없어 통합 시 전건 FAIL. 고정 43건은 두 provenance 에 걸쳐 있어 단일 플래그로
  재현 불가.
- Scale: changesets>=1; surfaces: 추출기·ADR·가드·스키마/러너 배선; capability: 확장 주제가
  규약을 우회하지 않고 근거를 남기며 통과한다
- Plan: `plans/2026-08-01-m5-주제목록과봉인규약.md`
- Status: [x]
- Completed at: 2026-08-01
- Summary: 60 주제 확정 + ADR 0004 개정 + 스키마·러너 배선
<!-- harness:milestone id="M6" status="completed" priority="P0" evidence="archive/reports/2026-08-01-m6-items-close.md" -->
### M6 — 문제 작성 + 라벨 검증 + 코퍼스 통합
- DoD: 신규 60건이 검사 3종(스키마·유출·주제출처) 전건 통과 · 라벨 60건이 조문 본문 조회로 검증된
  기록 보유(기억 기반 0건, sealed 기록은 별 파일) · 기존 124 레코드 **레코드 단위 해시** 불변 ·
  봉인 강제 장치가 플래그 없는 `sealed` 접근을 실제 거절하고 20건 ledger 등재 · `npm test` 전건.
- Evidence: archive/reports/2026-08-01-m6-items-close.md
- Gap: 맥락 산문이 정답 조문의 법률 용어를 노출하면 어휘 공백 축이 측정에서 사라진다. ADR 0001 로
  시행령으로 옮겨가는 라벨이 수 건 예상되며 그 조문은 승인 목록에 없어 가드 예외가 필요하다.
- Scale: changesets>=1; surfaces: 문항 작성·라벨 검증·코퍼스 통합·봉인 장치; capability: 세법
  전반 문제가 오염 없이 코퍼스에 들어간다
- Plan: `plans/2026-08-01-m6-문제작성과통합.md`
- Status: [x]
- Completed at: 2026-08-01
- Summary: 60문항 통합(124→184) + 라벨 검증 + 봉인 20건·강제 장치
<!-- harness:milestone id="M7" status="completed" priority="P0" evidence="archive/reports/2026-08-01-m7-breadth-verdict.md" -->
### M7 — 확장 코퍼스 기준선 측정 + 넓이 판정
- DoD: 고정 43건 레코드 해시 불변 + 범용 recall@3 = M4 값(84.2%) · 확장 dev 40건 블라인드 ×3
  기준선이 법별 분포와 함께 존재 · 봉인 20건 미개봉이 ledger 로 확인 · 넓이 판정 보고서(git 추적) ·
  `git diff --stat src/` 0줄. **"세법 전반을 덮었다" 선언은 사용자 결정.**
- Evidence: archive/reports/2026-08-01-m7-breadth-verdict.md
- Gap: 측정 전 `dist-bench` 재빌드와 배포 사본 일치 확인이 선행돼야 한다(M4 에서 2회 걸린 함정).
  고정 세트 `pass^3` 는 1회로 정의되지 않아 재측정하지 않는다 — 회귀 검사는 결정적 축으로만.
- Scale: changesets>=1; surfaces: 두 세트 측정·판정 보고서; capability: "세법 전반"이 주장이 아니라
  측정이다
- Plan: `plans/2026-08-01-m7-확장기준선측정.md`
- Status: [x]

- Completed at: 2026-08-01
- Summary: 확장 40건 기준선(pass^3 75.0%) + 고정 세트 불변 + 후보 S 해소 판정
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
