# 선행 사례 조사 — 한국 법령 MCP 들은 "쟁점 → 법령" 매핑을 어떻게 푸는가

- 작성: 2026-07-21
- 소비처: LB2 (후보 생성 방향 결정) — `plans/2026-07-20-lb2-article-level-reach.md`
- 계기: LB2 step-2 에서 조문 재정렬 가설이 기각되고(recall@3 44.0% 무변), 병목이 **후보 생성**으로
  확정됨 → 같은 문제를 이미 푼 사례를 먼저 본다.
- 방법: GitHub 저장소 검색(스타 내림차순) + README 정독. 접근일 전부 2026-07-21.

## 조사 대상 (스타순)

| ★ | 레포 | 성격 |
|---|---|---|
| 6,390 | [NomaDamas/k-skill](https://github.com/NomaDamas/k-skill) (`korean-law-search` 스킬) | 스킬(프롬프트) 형태 |
| 2,252 | [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) | MCP 서버 — 이 분야 1위 |
| 125 | [SeoNaRu/lexguard-mcp](https://github.com/SeoNaRu/lexguard-mcp) | MCP 서버(159 API) |
| — | [Choihello/startup-law-mcp](https://github.com/Choihello/startup-law-mcp) | MCP 서버 — **유일한 조문 단위 사전 색인** |
| — | [ssifood/lexdiff](https://github.com/ssifood/lexdiff) | 웹 플랫폼(FC-RAG) |

일반 legal-RAG 레포(인도·파키스탄·말레이시아 등)도 훑었으나 전부 0~1★ 습작 수준이라 제외한다.

## 발견 1 — **아무도 API 의 자연어 검색에 기대지 않는다. 법령명은 LLM 이 안다고 전제한다.**

이게 가장 중요한 발견이다. 4개 전부 "쟁점 → 법령" 매핑을 **소비자 LLM 쪽에 맡긴다**:

- **k-skill**: "약칭(`화관법`)이면 `target=law` 로 **정식 법령명을 먼저 확인**한다" — 법령명 후보를
  LLM 이 떠올리고, API 는 그 이름을 *확인*하는 데 쓴다.
  (`korean-law-search/SKILL.md`, 접근일 2026-07-21)
- **chrisryugj (2,252★)**: 로컬 색인 없음. 대신 **약칭 사전 52개**(`LAW_ALIAS_ENTRIES`, 화관법 →
  화학물질관리법) + 법령명 유사도 스코어(`scoreLawRelevance` — substring + bigram Jaccard) +
  도메인 감지 라우팅("관세" 감지 → 조세심판 검색으로 체이닝). **모두 법령 *이름* 기준 신호다.**
- **lexguard (125★)**: 로컬 코퍼스 없음. 질문을 **10개 법률 도메인으로 분류**한 뒤 여러 타깃에
  병렬 질의하고, 결과를 **BM25 + 키워드 하이브리드로 재정렬**.
- **lexdiff**: 벡터 RAG·그래프 RAG 를 **명시적으로 거부**("쪼개면 의미가 흔들립니다" / 법제처가
  이미 정본 그래프를 갖고 있어 로컬 색인은 "결국 법제처 원본보다 뒤처지기 마련"). Gemini
  Function Calling 라우터가 어느 API 를 부를지 고른다.

→ **우리 골든셋은 이 분야가 의도적으로 기대지 않는 경로를 측정하고 있었다.** "정당방위 성립 요건"을
`search_law` 에 그대로 넣는 사용은 실제 MCP 소비 패턴이 아니다 — 실제로는 소비자 LLM 이
"정당방위 = 형법" 을 알고 `search_law("형법")` → `get_law_article` 로 간다. 기준선 44% 는
**"법률 지식이 없는 소비자" 모드**의 수치이며, 그 모드는 이 생태계에서 아무도 풀지 않았다.

## 발견 2 — 조문 단위 사전 색인을 한 사례는 하나. 그리고 **범위를 좁혀서** 했다.

[Choihello/startup-law-mcp](https://github.com/Choihello/startup-law-mcp) 이 우리 옵션 1을 실제로 구현한 유일 사례다.

- **범위 큐레이션이 핵심**: 전체 법령이 아니라 **창업 도메인 19개 법**(본법+시행령+시행규칙 = 50 문서,
  8,191 조문). 6개 주제(창업·회사운영·고용·IP·온라인사업)로 나눠 사람이 골랐다. 목록은
  `data/laws.json` 에 있고 추가하려면 항목을 넣고 sync 를 다시 돈다.
- **저장 방식**: `law_sync.py sync` → `data/laws/*.md`(레포에 커밋) → `law_search.py build` →
  `data/index.json`(커밋 안 함, sync 마다 재생성).
- **검색 알고리즘**: "한국어 조사 제거 토크나이저 + TF·IDF 가중 스코어링 + 옵션으로 음절 bi-gram
  퍼지 매칭". **임베딩을 명시적으로 거부**(키워드 정확도·해석가능성 우선). 부칙 조문은 ×0.2 감점.
- 정확도 수치는 공개하지 않는다.

→ 우리 옵션 1은 검증된 패턴이되, **"주요 법령"을 정의하는 큐레이션이 설계의 본체**다. 이들은
도메인을 좁혀서 그 문제를 회피했다(창업). 우리는 "법 일반"이 목표라 같은 방식이 그대로 안 맞는다.

## 발견 3 — 공통 차별화 기능은 **인용 검증**이고, 우리에겐 없다.

- chrisryugj: `verify_citations` — 인용된 조문이 실제 존재하는지, 조문 제목이 맞는지 법제처 DB 와 대조.
- startup-law-mcp: `verify_citation` — `ok` / `not_found` / `content_mismatch`(제목 환각) /
  `unknown_source` / `ambiguous_source` 로 분류. 헤드라인 문구가 "LLM이 지어내는 '○○법 제N조'
  환각 대신, 인덱스에서 대조한 진짜 조문만".
- lexdiff: 인용 검증 + 신뢰도 스코어링 + `[現行]`/`[沿革]` 라벨.

우리 도구에는 이 기능이 없다. 그리고 **우리는 이미 조문 인덱스(LB2 step-1)를 갖고 있어 구현이 싸다**
— 법령 ID 를 알 때 조문 실재·제목 일치를 대조하는 건 지금 코드로 바로 된다.

## 발견 4 — 아무도 정확도를 측정해 공개하지 않는다.

4개 전부 정량 지표가 없다. lexdiff 는 "정량 평가 대신 추적가능성·최신성을 설계 보증으로" 라고
명시한다. **LB1 의 골든셋·기준선(recall@3 44.0%)은 이 생태계에서 드문 자산이다** — 개선을 주장할 수
있는 유일한 근거이고, 그 자체가 차별점이 된다.

## 그 밖의 기술 관찰

- **약칭 사전은 표준 장비다**(chrisryugj 52개, k-skill 프롬프트 규약). 우리 `term-bridge.ts` 는
  신·구 용어 3쌍뿐이라 같은 계열의 자산이 얇다.
- **캐시 TTL**: chrisryugj 검색 1시간 / 전문 24시간, lexguard 성공 30분 / 실패 5분.
  우리 LB2 step-1 의 LRU(프로세스 생존)보다 정교하다.
- **0건 처리 규약**: k-skill 은 "0건이어도 '관련 규범이 없다'고 단정하지 말고 검색어·법원·사건번호·
  선고일자·출처명을 바꿔 재시도"를 프롬프트에 박아둔다. 우리 폴백 사다리(ib3)와 같은 철학이 프롬프트
  레이어에 있는 셈.
- **도구 수**: chrisryugj 10개(+숨김 도구를 `discover_tools`/`execute_tool` 로 노출),
  lexguard 18개, startup-law 14개. 우리는 7개. LB3 의 "도구 인플레 억제" 결정과 상충하지 않는다 —
  1위 레포도 표면에 10개만 두고 나머지는 메타 도구 뒤로 숨겼다.

## 포화 판정

**포화로 닫았다.** 마지막 확인한 소스(lexdiff, k-skill)가 새 설계 패턴을 더하지 않고 앞의 결론
(API 직결 + LLM 이 법령명 담당 + 재정렬, 또는 큐레이션된 조문 색인)을 확인만 했다. 일반 legal-RAG
레포군은 습작 수준이라 신호가 없었다.

미확인으로 남긴 것: 각 레포의 실제 코드(README 기준 조사임 — chrisryugj `scoreLawRelevance` 의
구체 구현, startup-law 의 TF-IDF 파라미터). 방향 결정 후 채택한 패턴에 한해 코드를 확인한다.
