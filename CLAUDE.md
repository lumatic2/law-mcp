# law-mcp

> 한 줄 설명. (갈래: tooling)

## 범위 (2026-07-23 사용자 확정)

**law-mcp 는 Claude·Codex 가 *법* 관련 작업을 할 때 쓰는 도구다.** 세법은 법이라서 다루고,
**회계는 다루지 않는다** — 기업회계기준·K-IFRS·회계 실무는 이 레포의 영역이 아니다.
("회계·세무"처럼 붙어 다니는 말에서 회계까지 범위로 읽지 말 것. 2026-07-23 실제 오류.)

## 진행 순서 (2026-07-23 사용자 확정 — 재확인 2회)

**기능 완성이 먼저고 배포는 그다음이다.** 순서는 ① 회계·세무 분야를 충분히 완성 →
② 다음 분야 완성 → ③ **기능적으로 충족됐을 때** 남에게 보여줄지 판단.

- **③은 에이전트가 제안하지 않는다.** npm 공개·발견성·설치 편의는 ①②가 끝나기 전에는
  후보로 올리지 않는다. `package.json` 의 `private: true` 는 의도된 상태이지 결함이 아니다.
- 왜 적어 두나: 2026-07-23 TF3 D-TF3-3 에서 사용자가 npm 배포를 명시 제외했는데, 같은 세션에서
  에이전트가 "설치 경로가 없다"를 근거로 다시 제안했다. 도달률 지표가 낮아 보일 때 배포를
  돌파구로 착각하기 쉬운데, 덜 익은 것을 내놓으면 첫인상은 한 번뿐이다.

## 기술 스택
<!-- TODO: 채우기 전엔 빈 섹션임을 알 수 있게 표시만 두고 지우지 않는다 -->

## 프로젝트 구조
<!-- TODO: 채우기 전엔 빈 섹션임을 알 수 있게 표시만 두고 지우지 않는다 -->

## 개발 명령어
```bash
# TODO: dev/test/build/lint 명령어를 채운다
```

## Gotchas
- **배포 사본 분리**: Claude MCP 설정(`~/.claude.json`)은 이 레포가 아니라
  `~/projects/custom-mcps/law-mcp/dist/index.js` 를 실행한다. 이 레포에서 수정·커밋해도 MCP 에
  반영되지 않는다 — 반영 절차: 여기서 push → custom-mcps 사본에서 `git pull && npm run build` →
  **MCP 서버 재시작**(사용자). 소스 수정만 하고 완료 처리 금지 (2026-07-12 RX2 재실험에서 적발).
- `LAW_API_OC` env 필요(법제처 DRF). NTS(taxlaw.nts.go.kr) 폴백은 인증 불요.

## 작업 방식
- 1 tooling changeset = 1 작업 단위
- 변경 전 영향 파일과 배포 경로를 먼저 식별
- SKILL.md 변경 시 `bash setup.sh` sync + trigger acceptance + hardening parity 확인

## ROADMAP 운영
- `ROADMAP.md` 는 current horizon / active milestone 장부이며 150줄 이하로 유지한다.
- `docs/BACKLOG.md` 는 완료·보류·아카이브된 milestone 압축 이력이다.
- ROADMAP/BACKLOG 쓰기 소유자는 `/harness` 이다. milestone 완료·compact·horizon-check 는 `/harness` 가 처리한다.
- `session-end` 는 ROADMAP 을 수정하지 않는다. read-only 로 확인하고 `CLAUDE.local.md` handoff 에만 반영한다.

## 컨텍스트 갱신 규칙
- 사용자가 같은 교정을 2회 이상 반복하거나 "항상 ~해줘"·"다시는 ~하지 마" 식으로 말하면, 메모리에 넣지 말고 그 자리에서 이 파일(그리고 이 레포 `AGENTS.md`)에 추가를 제안한다.
- 이 레포에만 해당하는 사실은 여기에, 모든 레포에 해당하면 글로벌(`~/.claude/CLAUDE.md`/`~/.codex/AGENTS.md`)에 제안한다 — 헷갈리면 물어본다.
- Claude 와 Codex 둘 다 지켜야 할 규칙이면 이 `CLAUDE.md` 와 `AGENTS.md` 양쪽에 추가한다(문구는 달라도 되나 내용은 일치).
- 정기적으로(주 1회 또는 감이 안 잡힐 때) `context-manager` 를 "전체 점검"으로 돌려 배치 오류·drift 를 확인한다.

## ⚠ Judge 규약
> 스킬·런타임 변경은 targeted test/smoke/sync 증거 없이는 완료 보고 금지. 배포본까지 확인한다.

## 의사결정 이력
"왜 X 안 함?" 같은 *의도적으로 안 한 선택*은 `docs/adr/` 에 ADR 로 보존.
