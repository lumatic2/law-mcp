# changeset 20260731-m2-source-connect — M2 · 자료원 연결

- Plan: `plans/2026-07-31-m2-자료원연결.md` · milestone M2 (연쇄 M1→M2·M3→M4)
- 갈래: tooling (`src/` 변경 — 배포 사본 반영+재시작 부채 발생)

## step-1 — 법령계 자료원 연결 (2026-07-31)

- 산출물: `SOURCE_DESCRIPTORS` 에 3종 추가 (`src/providers/source-adapter.ts`
  `STATUTE_ANNEX_DESCRIPTORS`) + enum 배선(`src/index.ts`) + 계약 테스트(`test/m2-statute-annex.test.ts`)
  - **trty 조약**: 검색 행 키 대문자 `Trty`(실측) · 전문 `BothTrtyService.조약내용.조약내용` 중첩 ·
    등급 statute(헌법 §6① — 조세조약 우선 적용 안내)
  - **oldAndNew 신구법 비교**: 전문은 평평한 필드가 없어 `listSections`(어댑터 신규 —
    `{no, content}` 행 목록을 문자열 배열로) 로 신/구 조문 목록을 싣는다 · `MST` 로 조회
  - **licbyl 별표·서식**: 메타+파일 링크까지(D2 — HWP/PDF 파싱 범위 밖), 전문은 사유와 함께 거절
- Verify:
  - `npm test` 325/325 ✅ (authority-grade 가드가 statute 확장 2건을 적발 → 근거 명시로 갱신)
  - 실 API E2E ✅: trty "소득에 대한 조세의 이중과세회피" 106건 + 전문 980자 수신 ·
    oldAndNew "소득세법" 3건 + 신 147행/구 147행 · licbyl "세율" 97건 + PDF 링크 + 전문 명시 거절
  - Failure probe ✅: 존재하지 않는 검색어 → 0건이 에러가 아니라 정상 응답
- 주의: 다자조약 전문 컨테이너 미확인(세무 질의 20행 전원 양자조약) — 다자는 NOT_FOUND 가능,
  descriptor 주석에 기록.

## step-2 — 해석계 자료원: 공백 확정 (2026-07-31)

- **구현 없음 — 판정 기록으로 닫음** (plan step-2 의 명시 분기). M1 처분표 ADR 0003 #8·#9:
  기본통칙·세법집행기준은 법제처 경로가 없고(admrul "기본통칙" 0건 재확인) NTS 공식 API 도 없다.
  D1 처분 기준(공식 API 만·스크래핑 금지)에 따라 **공백+이유** 로 확정.
- 실무 영향은 M4 리허설 시나리오 ⑤(기본통칙 의존 질문)가 잰다. 뒤집히는 조건은 ADR 0003 에 기록.
