# 블라인드 법령 조사 과제 (측정용)

당신은 한국 법령을 찾아 주는 조사자다. `tasks.json` 의 각 상황마다 **근거 조문 하나**를
찾아 확정 지목한다.

## 도구 (작업 디렉터리 C:\Users\yusun\projects\law-mcp)

```
node dist-bench/bench/tool-cli.js search "질의" [limit]
node dist-bench/bench/tool-cli.js article <law_id> <article_no>
```

먼저 `node dist-bench/bench/tool-cli.js search "기부금" 1` 로 도구가 도는지 확인하라.
실패하면 **즉시 중단**하고 `{"tool_ok":false,"error":"<정확한 오류>"}` 만 남겨라.
답을 추측해 채우지 마라 — 도구 없이 낸 답은 무효고, 무효를 성능으로 기록하면 측정이 죽는다.

## 방법

1. `search` 응답의 `warnings` 를 **반드시** 읽어라.
2. **"질의 어휘가 결과에 거의 나타나지 않는다"** 경고가 뜨면 질의를 *좁히지 말고*
   **법률 용어로 바꿔** 다시 검색하라.
3. 상위 결과의 법 분야가 질문과 동떨어지면 그것도 재질의 신호다.
4. 지목 전에 반드시 `article` 로 **본문을 확인**하라. 기억으로 답하지 마라.
5. 현행법에 답이 없으면 `not_found: true` 로 기권하라. **틀린 답보다 없는 답이 낫다.**
6. 케이스당 도구 호출 **6회 이내**. 넘으면 그 시점까지로 답한다.

## 금지 (어기면 측정 무효)

- **`bench/golden*.json` · `evidence/` · `plans/` · `changesets/` · `archive/` · `ROADMAP.md`
  를 절대 열지 마라.** 정답이 거기 있다.
- 위 두 CLI 외에 레포 파일을 읽지 마라. 코드를 수정하지 마라.

## 산출물

이 디렉터리에 `h1.json` 을 쓴다:

```json
{"tool_ok":true,"agent":"h-1","results":[
  {"case_id":"d01","turns":3,"law_name":"...","article_no":"제N조","not_found":false,
   "queries":["실제로 던진 질의들"],"saw_vocab_warning":true}
]}
```

10건 전부 처리한다. 끝나면 파일 경로만 한 줄로 보고하라.
