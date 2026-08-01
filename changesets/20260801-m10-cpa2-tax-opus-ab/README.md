# M10 — 공인회계사 2차 세법 Codex·Claude 2×2 평가

## Outcome

- 공식 문제와 24점 확정 채점분을 동결했다.
- Codex/Claude Opus 각각 law-mcp 사용·미사용 신규 세션, 총 4세션을 동일 입력으로 실행했다.
- 원시 답안과 도구 추적을 보존하고 블라인드 채점 후 arm을 공개했다.
- 답안 동결 후 발견한 원 정답표 오류 3건은 원본 SHA를 보존한 파생 정정표로 재판정했다.
- 종합 판정은 `미달`: C+와 O+ 모두 사전 절대 기준 5개를 전부 만족하지 못했다.

## Verification

```powershell
python evidence/cpa2/2026-m10/frozen/validate_frozen.py
python bench/cpa2-m10/validate_isolation.py
python bench/cpa2-m10/validate_runs.py evidence/cpa2/2026-m10/runs
python bench/cpa2-m10/validate_scoring.py
npm test
```
