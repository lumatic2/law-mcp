# ROADMAP

> 마지막 업데이트: 2026-08-01
> 상태: **목표 "일상어→조문 매핑" 연쇄 진행 중** — M8 completed, M9 active (연쇄 승인 2026-08-01,
> `--chain` 등록). M1~M8 은 completed.
> 기준선 = 확장 40건 **수리 후** `pass^3` 90.0%·pass@3 100%·`SR@1` 67.5%
> (`evidence/bench/2026-08-01-m8-repaired/`, 수리 전 75.0%/61.7% 는 기록 동결) ·
> 고정 43건 `pass^3` 86.0%·`SR@1` 81.4% · 범용축 recall@3 84.2%.
> ⚠ 회차 변동: 문항 고정 상태에서 12.5% 가 흔들린다 — `pass^3` 노이즈 ±5~7%p.
> ⚠ horizon 층은 폐지됐다(하네스 재조립 C4) — 이 연쇄는 북극성 바로 아래 milestone 연쇄다.
> 북극성: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중 하나가
> 된다 (전문 → `CLAUDE.md` 「북극성」 절)
> line budget: <=150

## Current Goal

<!-- harness:goal id="query-to-article-mapping" -->
목표: **일상어→조문 매핑 병목을 해소할지 판단한다.** 조회(조문 지정 호출)는 정확하지만 사람 말에서
법·조문을 집는 단계에서 깨진다(확장 `SR@1` 61.7%). ① 문항 결함으로 오염된 분모를 청소해 도구 실력
추정치를 얻고 ② 두 대안(질의 정규화 / 조문 임베딩)의 이득축·손실축을 같은 자로 실측해 처방을 사용자
결정에 올린다. 사용자 제안(2026-08-01 "법조항 전체를 임베딩")에서 출발. 연쇄: M8 → M9.
**구현·채택 선언은 사용자가 한다 — 이 연쇄는 판정 재료까지.**

> 이전 목표 **코퍼스 세법 전반**(`tax-corpus-breadth`, M5~M7)은 2026-08-01 완료 — 판정 보고서
> `archive/reports/2026-08-01-m7-breadth-verdict.md`. 미결 결정 ⓔ·ⓕ·ⓖ 중 ⓕ(문항 수리)는
> 2026-08-01 승인되어 M8 로 소비된다.

<!-- harness:milestone id="M9" status="active" priority="P0" evidence="archive/reports/2026-08-01-m9-mapping-verdict.md" -->
### M9 — 매핑 병목 유형화 + 의미검색 상한 프로브 + 판정
- DoD: 실패 전건이 원인 유형으로 분류(유형①은 토큰 겹침 수치 근거) + 측정 대상(A)/참고(B) 분리 ·
  정규화·임베딩의 이득축·손실축이 동일 단위(조문·k=3/10·`query`·현행 최종 응답)로 산출 · 임베딩
  인덱스가 세법 12종 전체이고 정답 조문 존재가 선확인 · 3안 비교 판정 보고서(git 추적, "상한 ≠
  도달률"·버전 스냅샷 위험 명시) · `src/`·`package.json` 무변경 · 조문 덤프 본문 미커밋.
- Evidence: archive/reports/2026-08-01-m9-mapping-verdict.md
- Gap: 의미 검색 층은 이미 `aiSearch` 로 돌고 있다(UD2) — 자체 임베딩은 새 아이디어가 아니라 엔진
  교체 결정이다. 인덱스는 스냅샷이라 세법 개정에 노후하므로 "후보 찾기 한정·본문 API 재조회"
  전제가 깨지면 `as_of` 함정이 되살아난다. 채택 결정은 사용자 소유.
- Scale: changesets>=1; surfaces: 유형화·정규화 상한·현행 조문 기준선·조문 수집·임베딩 파일럿·판정;
  capability: 처방 선택이 취향이 아니라 측정이다
- Plan: `plans/2026-08-01-m9-매핑병목프로브.md`
- Status: [ ]

## 이전 목표 (완료)

<!-- harness:goal id="tax-corpus-breadth" status="completed" -->
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
