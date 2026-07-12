# 20260712-ib1b-nts-fulltext-html

## Target

- Goal: IB1(`20260712-ib1-h8ta2-repair`)에서 남겨둔 한계 — NTS 소스 판례의 판례내용이 HWP
  첨부라 도달 불가하던 문제를 HWP 파싱 없이 해소.
- ROADMAP milestone: 변경 없음(IB1 후속 maintenance).

## Scope

| File/Path | Reason | Expected effect |
|-----------|--------|-----------------|
| `src/providers/lawgo-provider.ts` | `mapNtsPrecedentDetail`에 `dcmHwpEditorDVOList`(HTML 변환본) 추출 로직 추가 | 판례내용이 판결요지 대체가 아닌 전문(주문·이유 포함)으로 도달 |
| `test/lawgo-provider.test.ts` | 전문 있는/없는 두 케이스 단위 테스트 추가 | 네트워크 없이 회귀 방지 |

## Contract

- Source of truth: taxlaw.nts.go.kr `action.do`(actionId=ASIQTB002PR01) 응답의
  `data.ASIQTB002PR01.dcmHwpEditorDVOList` — NTS가 서버 측에서 HWP 첨부를 HTML로 변환해 둔
  항목(`dcmFleTy==='html'`)이 존재하며, `dcmFleByte`에 전문 텍스트가 통째로 들어있음(실측
  76KB 사례 포함). 별도 HWP 파서·바이너리 다운로드 불필요.
- Deploy/sync target: 없음(로컬 MCP stdio 서버).
- Compatibility: html 항목이 없거나 비어 있으면 기존 동작(placeholder → 판결요지 대체 +
  "도달 불가" warning) 그대로 유지. 법제처 소스 정상 경로(비-NTS)는 이 함수를 타지 않아 무영향.
- Out of scope: 전문 크기 절단/페이징(get_admin_rule의 offset/limit을 판례에 이식하는 것은
  과설계로 보류 — 전체 반환).

## Evidence Contract

- Scenario: IB1에서 5/5 성공(판결요지 도달)했던 동일 5건을 재실행해 이번엔 전문(주문/이유
  포함) 도달 여부 확인 + 법제처 소스 1건 회귀.
- Expected evidence: 5건 모두 `판례내용`에 "주 문"/"이 유" 포함, 길이가 판결요지보다 김.
- Cleanup receipt: 실 API 검증 스크립트는 프로젝트 외부 scratchpad에서 실행, 레포에 미커밋.
- Not evidence: `npm run build`/`npm test` 통과만으로는 실 API 도달을 증명하지 않음 — 아래
  실측 로그가 근거.

## Verification

- [x] Targeted tests: `npm test` — 11/11 pass (신규 2건 + 기존 9건).
- [x] Smoke: `npm run build` 성공 + 실 API 스모크(아래 결과 기록).
- [ ] Sync/deploy if skill changed: N/A.
- [ ] Deployed copy grep if skill changed: N/A.
- [x] Drift/dirty-tree check: 변경 파일만 스테이징.

## Result

- Status: done
- Evidence:

### 재현 5건 재실행 — 전문 도달 확인

`resolveNtstDcmId` → `fetchNtsActionData` → `dcmHwpEditorDVOList` HTML 추출 경로를 빌드된
provider 로직 그대로 재현해 실행:

| precedent_id | ntstDcmId | 전문 길이(자) | "주 문" 포함 | "이 유" 포함 | 비고 |
|---|---|---|---|---|---|
| 619683 | 200000000000020675 | 13,621 | ✅ | ✅ | |
| 618097 | 200000000000019655 | 5,553 | ✅ | ✅ | |
| 310830 | 000000000000353908 | 332 | ✅ | ✅ | 심리불속행기각 — 짧지만 완전한 전문(사건/주문/이유 전부 포함, 확인 완료) |
| 325202 | 000000000000204419 | 8,880 | ✅ | ✅ | |
| 612611 | 200000000000014819 | 337 | ✅ | ✅ | 심리불속행기각 — 상동 |

→ 5/5 전부 전문 도달(IB1 대비 개선: 판결요지 대체 → 실제 주문·이유 포함 전문).
`getPrecedent("612611")` 통합 호출 결과도 동일(`판례내용` length=337, warnings에
"전문은 NTS 서버 변환 HTML(첨부 HWP 변환본)에서 추출함" 포함, "도달 불가" 문구는 사라짐).

### 법제처 소스 정상 케이스 회귀

`getPrecedent("228541")`(강제추행), `getPrecedent("70210")`(등록무효(상)) — 둘 다 기존
lawService 경로 그대로 동작, `warnings=[]`, 전문 길이 각각 9,226자/9,707자로 회귀 없음 확인
(NTS 폴백을 타지 않으므로 이번 변경의 영향 범위 밖임을 재확인).

- Notes:
  - build: `npm run build` 통과(에러 없음).
  - test: `npm test` — 11 pass / 0 fail.
  - `dcmHwpEditorDVOList` 중 `dcmFleTy==='hwp'`(원본, `dcmFleByte` 비어있음) 항목은 그대로
    무시하고, 서버가 이미 변환해 둔 `html` 항목만 사용 — HWP 바이너리 파싱은 여전히 불요.
