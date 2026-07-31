# changeset 20260731-m1-source-map — M1 · 자료원 지도 확정 + before 기준선

- Plan: `plans/2026-07-31-m1-자료원지도.md` · milestone M1 (연쇄 M1→M2·M3→M4, 승인 2026-07-31)
- 갈래: tooling (조사·측정 — `src/` 무변경)

## step-1 — 상류 프로브 + 처분표 ADR (2026-07-31)

- 산출물:
  - `research/2026-07-31-m1-상류프로브.md` — 미확인 8건 실측(법제처 DRF + NTS action.do 직접 호출)
  - `docs/adr/0003-세법-자료원-처분표.md` — 근거 유형 14행 전수 판정
  - `plans/horizons/CANDIDATES.md` — 어순 재확인 소진 표시 + `lsRlt` 재개봉(후보 O) 적재
- 핵심 판정:
  - **연결 대상 (M2)**: 조세조약 `trty`(검색 147건+전문 JSON) · 별표 `licbyl`(97건, 메타+링크) ·
    신구법 `oldAndNew` · 예규 본문 보강(NTS 문서 API 실측 도달 — `dcmHwpEditorDVOList[].dcmFleByte`)
  - **공백+이유**: 기본통칙·집행기준(법제처 경로 없음 재확인, NTS 공식 API 없음 — D1 기준) ·
    국세청 자체 불복(target 미확인, 우선순위 낮음)
  - **우려 기각**: 심판례 미러 신선도(기준일 2026.07.29, 의결 07.15 수록) ·
    `expc` 는 세무 예규 커버 안 함(0건 vs `ntsCgmExpc` 1,938건)
- Verify: 미확인 8건 전부 판정+실 응답 증거 ✅ · ADR 14행 전수 ✅ · Failure probe(어순 정순·역순
  양쪽 시도 — rltLs/lsCouse/lawDr 빈 응답 확인 후 판정, 5xx 미발생) ✅
