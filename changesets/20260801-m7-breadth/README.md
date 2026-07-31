# changeset 20260801-m7-breadth — M7 · 확장 기준선 측정 + 넓이 판정

계획: `archive/plans/2026-08-01-m7-확장기준선측정.md` · 목표: 코퍼스를 세법 전반으로(닫는 milestone)

측정·문서 milestone 이라 코드 변경은 없다(`src/`·`bench/` 무변경). 산출은 evidence 와 보고서다.

- step-1 `evidence/bench/2026-08-01-m7-fixed/` — 고정 43건 레코드 해시 불변(변경 0건) + 범용축
  고정 57건 재측정이 M4 와 전 지표 동일(recall@3 84.21%). `dist-bench` 재빌드 해시 기록.
- step-2 `evidence/bench/2026-08-01-m7-expanded/` — 확장 dev 40건 블라인드 ×3.
  pass^3 75.0% · pass@3 90.0% · SR@1 61.7% · AT 1.28 · 침묵 0%. 봉인 20건 미포함.
- step-3 `archive/reports/2026-08-01-m7-breadth-verdict.md` — 후보 S 판정(해소) + 한계 3개.

핵심 관측: 확장 세트의 낮은 값은 **도구가 아니라 문항 결함**이 주원인이다(미달 10건 중 8건).
점수를 본 뒤 문항을 고치지 않았다 — 그게 ADR 0002 가 경고하는 오염이라서, 결함 목록만 남기고
수정 여부·시점은 사용자 결정으로 넘겼다(후보 T).
