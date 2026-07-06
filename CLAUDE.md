# law-mcp

> 한 줄 설명. (갈래: tooling)

## 기술 스택
<!-- TODO: 채우기 전엔 빈 섹션임을 알 수 있게 표시만 두고 지우지 않는다 -->

## 프로젝트 구조
<!-- TODO: 채우기 전엔 빈 섹션임을 알 수 있게 표시만 두고 지우지 않는다 -->

## 개발 명령어
```bash
# TODO: dev/test/build/lint 명령어를 채운다
```

## Gotchas
<!-- TODO: 비명백한 동작·필수 env var·알려진 함정을 채운다. 없다는 확신이 서면 이 섹션 자체를 지워도 된다. -->

## 작업 방식
- 1 tooling changeset = 1 작업 단위
- 변경 전 영향 파일과 배포 경로를 먼저 식별
- SKILL.md 변경 시 `bash setup.sh` sync + trigger acceptance + hardening parity 확인

## ROADMAP 운영
- `ROADMAP.md` 는 current horizon / active milestone 장부이며 150줄 이하로 유지한다.
- `BACKLOG.md` 는 완료·보류·아카이브된 milestone 압축 이력이다.
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
