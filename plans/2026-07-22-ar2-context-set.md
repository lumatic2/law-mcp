# PLAN — AR2 맥락 세트 + 기준선

> 생성: 2026-07-22 · 갈래: tooling · 소비 증거: AR1 산출물 · `evidence/bench/2026-07-22-context-effect-probe.md`
> execution mode: continuous
> milestone-레벨 durable plan doc.

Status: 승인 대기

## Objective → horizon → milestone → step (위계)

- **Objective**: 한국 사람들이 '법' 관련 작업을 AI 에이전트로 할 때 설치하게 되는 MCP 의 대표 중
  하나가 된다 (← `OBJECTIVE.md`)
- **horizon**: 에이전트가 쓰는 대로 재고, 그 기준으로 올린다 (← `plans/horizons/agentic-reach.md`)
- **milestone**: AR2 — **잴 것을 만들고 기준선을 박는다.** 구 홀드아웃 20건에 맥락을 붙여 dev 로
  강등하고, 답이 없는 기권 케이스를 섞고, 새 홀드아웃을 봉인한 뒤 기준선을 측정한다.
  규모 근거: 맥락 세트 제작·기권 케이스·봉인+기준선이 독립 changeset 3, 통합검증 = 단발 75% 대비 대조표.

## 범위 / 중단점

- execution mode: continuous
- **범위**: 평가 데이터 제작 + 기준선 측정.
- **제외**: `src/` 수정 · 도구 개선(AR3) · 새 홀드아웃 **개봉**(AR4 에서 1회) · 기준선을 보고 하는
  튜닝(그 순간 dev 가 죽는다).
- **중단점**: blocked / error / **유출 탐지기가 반복적으로 걸림**(맥락을 쓸수록 답이 새면 설계
  재논의) / 기준선이 100% 나옴(= 변별력 0, 세트를 다시 만들어야 한다 → 정지하고 올린다).
- 롤백/정리: 평가 데이터·측정 산출물만 추가. `src/` 불변.

## 스캐폴딩 결정

**① 범용 코어 3**
- source-of-truth: 이 레포 `bench/golden-tax-agentic.json`(신규). **`src/` 미변경 → 배포 불요.**
- 검증: 유출 탐지기 전건 통과 + 일부러 유출시킨 문단이 잡힘 + AR1 러너로 완주.
- 배포/운영: **해당 없음 — `src/` 를 안 바꾼다.**

**② 자기선언 도메인**
- **유출 차단(이 milestone 의 존재 이유)**: 맥락 문단에 정답 **법령명·조문번호의 부분 문자열**이
  등장하면 기계가 거부한다. 페르소나는 "법률 비전문가 — 법령명도 조문번호도 모른다".
  근거: 리서치 실측 사례에서 유출 완화 전후 매치율이 24.2%→45.3% 로 바뀌었다. 완화 안 하면
  벤치가 낙관적으로 왜곡된다.
- **과잉 제약도 왜곡이다**: 맥락을 지나치게 빈약하게 쓰면 실제 사용자보다 무능한 질의자가 되어
  이번엔 비관적으로 왜곡된다. 기준 = **"실제 세무 대화에서 사람이 할 법한 말"**. 판단이 갈리는
  문단은 채택하지 않고 버린다(애매한 것을 넣고 해석하지 않는다).
- **세트 구성**: ① 구 홀드아웃 20건 → 맥락 부착해 **dev 로 강등**(봉인이 이미 풀렸으므로 튜닝용).
  ② **기권 케이스**를 섞는다 — 현행 법령에 답이 없는 질의. ③ 새 홀드아웃을 별도 제작해 **봉인**
  (`assertHoldoutSeal` 재사용).
- **기권 케이스 설계**: 티나는 함정은 실제 분포를 대표하지 못해 기권 정밀도를 왜곡한다(리서치 권고
  5 함정). 폐지 조문·개정으로 사라진 제도 등 **자연스럽게 답이 없는** 질의로 만들고, 그 사유를
  케이스에 명시한다.
- **정답 라벨**: 조문번호까지 고정한다. 실 API 조회로 존재를 확인한다(TV1 규약 답습).
- 검토 후 제외: 화면·디자인 · 인증 · 관측 · 신규 도구 · `src/` 변경 · 배포 · LLM 시뮬레이터.

**③ 제외 자기점검**
- 검토 후 제외: 위 ② 마지막 줄. 특히 **기준선을 본 뒤의 세트 손질** — 낮게 나오면 케이스를 쉽게
  고치고 싶어지는 것이 정상이지만, 그 순간 이 세트는 도구를 닮은 세트가 된다(구 horizon 프리모템 ①).

## 결정 로그

- status: resolved
- **구 홀드아웃을 어떻게 쓰나** → 확정(2026-07-22 사용자): **dev 로 강등 + 새 홀드아웃 봉인.**
  동일 20건에서 단발 75% ↔ 에이전트형 X% 를 직접 대조할 수 있어 이번 가설의 가장 강한 증거가 된다.
- **맥락 문단을 누가 쓰나** → 확정: 에이전트가 작성하고 **기계 탐지기가 검열**한다. 사람 검토는
  탐지기 통과분에 대해서만.
- **기권 케이스를 넣나** → 확정: 넣는다. 넣지 않으면 "항상 답을 지목하는" 퇴화 에이전트를 못 거른다.
- 그 외 사용자 소유 결정: 없음.

## Step 트리

- [ ] **step-1** 맥락 문단 제작 + 유출 탐지기
  - Artifact: `bench/leak-detect.ts`(맥락 문단에 정답 법령명·조문번호 부분 문자열이 있으면 거부) +
    `bench/golden-tax-agentic.json` 의 dev 20건(구 홀드아웃에 맥락 부착)
  - Files: write `bench/leak-detect.ts`·`bench/golden-tax-agentic.json`·
    `changesets/20260722-ar2-context-authoring/README.md` / read `bench/golden-tax.json`·
    `evidence/bench/2026-07-22-context-effect-probe.md`
  - Dependencies: AR1 완료
  - Verify: 20건 전건이 유출 탐지기를 통과 + `npx tsx bench/verify-labels.ts` 로 정답 조문 존재 확인 +
    `git diff --stat src/` **0 줄**
  - Failure probe: 정답 법령명을 일부러 넣은 문단("국세기본법에서 기한 지나고 신고하면…")이
    **거부되는지** 확인 — 탐지기가 실제로 작동하는지의 증명
  - Commit: `changesets/20260722-ar2-context-authoring/`
- [ ] **step-2** 기권 케이스 + 새 홀드아웃 봉인
  - Artifact: `bench/golden-tax-agentic.json` 에 기권 케이스(현행법에 답이 없는 질의, 사유 명시)
    추가 + 새 holdout split 제작 후 `assertHoldoutSeal` 적용
  - Files: write `bench/golden-tax-agentic.json`·`bench/agentic-run.ts`(seal 배선)·
    `changesets/20260722-ar2-holdout-seal/README.md` / read `bench/run.ts`(기존 seal 구현)
  - Dependencies: step-1
  - Verify: 개봉 플래그 **없이** holdout split 을 부르면 **exit 1** + 기권 케이스가 채점기에서
    별도 결과값으로 분류됨
  - Failure probe: 개봉 플래그를 붙였을 때만 열리는지 양방향 확인(봉인이 상시 열려 있는 상태를 배제)
  - Commit: `changesets/20260722-ar2-holdout-seal/`
- [ ] **step-3** 기준선 측정 + 단발 대조표
  - Artifact: `evidence/bench/2026-07-22-ar2-baseline.md` — dev 20건 에이전트형 기준선
    (`pass@3`·`pass^3`·범위·`AT`·`SR@t`·기권 정밀도/재현율) + **단발 75% 대비 대조표** +
    유형별 분해 + 비용 실측
  - Files: write `evidence/bench/2026-07-22-ar2-baseline.md`·`.json`·
    `changesets/20260722-ar2-baseline/README.md` / read AR1 러너·채점기
  - Dependencies: step-2
  - Verify: 3회 반복 완주 + 세 지표 동시 출력 + **범용 dev 셋 `golden-v2` recall@3 ≥88%**(회귀) +
    `git diff --stat src/` **0 줄**
  - Failure probe: 기준선이 **100% 면 정지**한다 — 변별력 0 인 세트는 자가 아니다. 그 경우
    유출 탐지기를 통과했더라도 맥락이 과했다는 뜻이므로 사용자에게 올린다
  - Commit: `changesets/20260722-ar2-baseline/`

## 검증/DoD

- **DoD**: ① dev 20건 맥락 부착 완료, 전건 유출 탐지기 통과 ② 일부러 유출시킨 문단은 거부됨
  ③ 기권 케이스 포함, 채점기가 별도 분류 ④ 새 홀드아웃 봉인, 플래그 없이 exit 1 ⑤ 기준선이
  `pass@3`·`pass^3`·범위·`AT`·`SR@t`·기권 정밀도/재현율 전부 포함 ⑥ **단발 75% 대비 대조표**
  ⑦ 범용 dev ≥88% ⑧ 기준선 100% 아님(변별력 존재) ⑨ `git diff --stat src/` **0 줄**

## 수치 출처

- **dev 20건** — 구 `bench/golden-tax.json` 의 holdout split 항목 수.
  재현: `python -c "import json;d=json.load(open('bench/golden-tax.json',encoding='utf-8'));print(len([x for x in d['items'] if x['split']=='holdout']))"` → `20`
- **단발 75.0%** — 그 20건의 구 방식(단발 recall@3) 실측. TV6 홀드아웃 개봉값(n=3, σ0.0%p).
  재현: `npm run bench:golden -- --set golden-tax --split holdout --repeat 3 --i-am-closing-the-horizon`
  (⚠ 이미 개봉·소진됨 — 재실행은 기록 확인용이며 새 판정 근거가 아니다)
  출처: `evidence/bench/2026-07-21-tv6-holdout.md` · `evidence/bench/2026-07-22-holdout-repeat.json`
- **범용 dev ≥88%** — 회귀 문턱. 현 실측 88.0%.
  재현: `npm run bench:golden -- --set golden-v2 --split dev`
- **유출 완화 전후 24.2%→45.3%** — 외부 리서치 인용값(이 레포 실측 아님).
  출처: `research/2026-07-22-agentic-eval-horizon-agentic-benchmark.md` §4

## hard-stop policy

- 기준선 100% → **정지.** 변별력 없는 자를 들고 AR3 로 가면 개선을 판정할 수 없다.
- 유출 탐지기가 반복적으로 걸림 → 정지. 맥락 작성 방식 재논의.
- 기준선을 보고 세트를 쉽게 고치고 싶어짐 → **금지.** finding 큐로만.
- blocked/error → `work.json` `stop_reason` 기록 후 정지.

## rollback/cleanup

- 평가 데이터·측정 산출물만 추가. `src/` 불변.
- ⚠ 새 홀드아웃은 봉인되며 **AR4 에서 1회만 열린다.**

## finding 큐

- 맥락을 붙이며 드러나는 도구 결함은 여기 — AR3 의 입력.

## 진행 로그 (append-only)
