# TF2 — 맥락 전건 부착 (완료 노트)

> 2026-07-23 · horizon `trap-free` · plan `plans/2026-07-23-tf2-context-and-seal.md`

## 1. 결과

코퍼스가 실제로 형식 중립이 됐다 — **topic 기준 맥락·질의 커버리지 100%**(94/94). 맥락 60건과
라벨 질의 11건을 새로 썼고, 주제는 전부 기존 `expected_article` 이 고정했다.

**주제 무개입을 기계로 증명했다**(`bench/check-no-new-topics.ts`): 코퍼스의 모든 정답 조문이
통합 전 4파일에 이미 존재한다. 표시 없는 신규 주제 0건, 규약 적용 3건만 `label_rule` 예외.
직전 horizon 오염(에이전트가 주제를 골랐다)이 이번엔 구조적으로 불가능했음을 보인다.

봉인 규약을 ADR 0002 로 고정했다 — 봉인은 데이터를 새로 만들어 확보하는 게 아니라 **문제를
늘릴 때 그 자리에서 떼어 두는 것**. 지금 미개봉 문제는 0개이므로 이번 horizon 은 홀드아웃
수치를 내지 않는다.

## 2. 이슈와 해결

- **짝-복사를 만들었다가 기각했다.** 같은 topic 안에서 `query`↔`context` 를 복사하면 레코드 기준
  커버리지가 100% 가 되고 작성량도 90→65건으로 준다. 그러나 새 주제 커버리지는 0이고(이미 맥락이
  있는 topic 을 복제할 뿐) 에이전트 측정에는 같은 문제를 두 번 채점하는 중복이 들어간다.
  스크립트를 지우고 **커버리지를 topic 기준으로 재정의**했다. 작성량은 줄지 않았다(60건 전부 작성).
- **재기준선 3회를 돌리지 않았다.** `pass^3` 의 정밀도는 도구 버전을 비교할 때 필요한 것인데
  이번 horizon 은 `src/` 를 0줄 고쳤다 — 쓸 데가 정해지지 않은 정밀도였다. 대신 실제로 답이
  필요한 질문("내가 쓴 맥락이 풀 수 있는 문제인가")만 API 호출로 답했다: **신규 맥락 단발 도달
  39.5% vs AR2 검증 맥락 35.0%** — 신규가 더 높다. 3 arm 세션은 이 판정에 아무것도 더하지 않는다.
- **`leak-detect` 가 맥락 없는 레코드에서 크래시했다.** 던지면 세트 전체 검열이 중단돼 오히려
  유출을 못 잡으므로 건너뛰게 고쳤다.

## 3. 증거

- `evidence/bench/2026-07-23-tf2-context-quality.md` — 도달성 대조표 + 미산출 명시
- `docs/adr/0002-평가-문제-봉인-규약.md` — 봉인 규약, 미개봉 문제 0개임을 명시
- `bench/check-no-new-topics.ts` · `bench/context-reachability.ts` · `bench/contexts-tf2.json`
- `changesets/20260723-tf2-context/README.md` — step 1~2 검증 체크
- 크기 회고: 선언 changesets>=2 / 실측 changeset 디렉터리 1 · step 2 · 커밋 3 — 정합
  (디렉터리 카운트는 기록-합본 규약상 milestone 당 1개).
실표면: none — 벤치 데이터·검사기 변경이라 사용자가 만지는 표면이 없다(`git diff --stat src/`
  0줄, 배포 사본 재빌드 불요). 홀드아웃 봉인이 플래그 없이 여전히 throw 하는 것은 확인했다.
재현: `npx tsx bench/leak-detect.ts bench/corpus.json` (PASS 124건) ·
  `npx tsx bench/check-no-new-topics.ts` (PASS, 실패 주입 시 exit 1) ·
  `npx tsx bench/context-reachability.ts --split dev --only-new` · `npm test` 314/314
평가 못 함: dev 재기준선(`pass^3`·`SR@1`·`AT`·기권 정밀도/재현율)을 내지 않았다. 유효한 기준선은
  여전히 AR2 의 dev 20건 `pass^3` 90% 이고, 코퍼스가 커진 만큼 그 값이 새 세트를 대표하지 않는다.
  하네스는 준비 완료(`evidence/bench/2026-07-23-tf2-baseline/`) — 세션만 띄우면 된다.
  단발 도달 MISS 26건도 사람이 하나씩 볼 목록으로 남아 있다(대조군도 13/20 MISS 라 비율 자체는
  이상하지 않다).
