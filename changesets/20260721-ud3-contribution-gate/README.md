# UD3 step-3 — 기여도 게이트 + 배포

- 일자: 2026-07-21 · milestone: UD3 · 증거: `evidence/bench/2026-07-21-ud3-contribution.md`

## 판정

**위원회 9종 전부 등록.** 제외 대상 없음. 대표 쿼리 도달 + 단건 조회 필드 확보를 모두 만족했다.

측정을 골든셋이 아니라 **자료원별 대표 쿼리**로 한 것이 이 step 의 핵심이다 — LB3 에서 골든셋으로
결정문 자료원을 재려다 "기여 0" 착시를 겪었고, 원인은 자료원의 무용이 아니라 측정 용도 불일치였다.

## 최종 표면

- 도구 개수 **11개 그대로**(LB3 완료 시점과 동일)
- `search_legal_source`/`get_legal_source` 의 `source` enum: **5종 → 14종**
- `get_law_article` 응답: `delegated_to` 선택 필드 추가

## Verification

- [x] `npx tsx bench/ud3-contribution.ts` — 9/9 통과
- [x] `npm test` 전건
- [x] **Failure probe(계획 명시)**: 같은 자료원을 골든셋으로 재면 여전히 기여 0 으로 보이는 것을
      의도적으로 확인·기록 — 두 자의 차이를 증거에 남겨 LB3 착시 재발을 막는다
- [x] 배포 사본 `git pull && npm run build` + dist 직접 스모크
- [x] 도구 개수 불변 확인

## Contract

- deploy target: `~/projects/custom-mcps/law-mcp` — **`source` enum 변경으로 도구 description 이
  바뀐다. MCP 재시작 필수(사용자).**
- out of scope: UD2 step-2~4(A/B — F12 휴지 대기)

## finding

- **F18**: `ftc` 는 프로브 총 1건이었다. 공정위 의결이 1건일 리 없으므로 색인이 부분적일 가능성.
- F14 해소: `oclt`(필드 2개·6건)는 등록 유지 — 적은 건 upstream 이 그만큼만 주기 때문이고
  그 안에 재결 이유가 있다.
