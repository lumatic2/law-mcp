/**
 * 도구 CLI — 살아있는 에이전트 세션이 실 MCP 도구를 한 번씩 호출하기 위한 얇은 진입점.
 *
 * **왜 있나** (2026-07-22 방향 전환): 평가 에이전트를 Anthropic SDK 로 새로 호출해 만드는
 * 대신, 이미 살아있는 에이전트 세션(Claude 본인 · Codex)이 소비자 역할을 한다. Codex 는
 * MCP 클라이언트가 아니라 셸만 쥐고 있으므로, 도구를 셸에서 부를 수 있어야 한다.
 *
 * **레포 내부를 안 읽어도 되게** 만드는 것이 핵심이다 — 블라인드 소비자가 정답 세트
 * (`bench/golden-tax.json`)를 우연히 읽으면 측정이 죽는다. 이 CLI 하나만 주면 된다.
 *
 * 사용:
 *   npx tsx bench/tool-cli.ts search "질의" [limit]
 *   npx tsx bench/tool-cli.ts article <law_id> <article_no> [as_of]
 *
 * 출력은 JSON 한 덩어리 — `warnings` 를 포함한 실 응답 그대로다(요약·필터 없음).
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const provider = new LawGoProvider();

  if (cmd === "search") {
    const args = rest.filter((a) => !a.startsWith("--"));
    const [query, limitRaw] = args;
    if (!query) throw new Error('사용법: search "질의" [limit] [--no-vocab-gap]');
    const limit = limitRaw ? Number(limitRaw) : 10;
    // `--no-vocab-gap`: AR3 어휘 공백 경고를 끈다. **A/B 전용** — 수리 전 arm 을 만들기 위한
    // 유일한 지점이다. 기본은 켜짐이므로 이 플래그가 없으면 제품 동작과 같다.
    const noVocabGap = rest.includes("--no-vocab-gap");
    const res = await provider.searchLaw(query, {
      limit,
      ...(noVocabGap ? { vocabGap: { enabled: false } } : {}),
    });
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return;
  }

  if (cmd === "article") {
    const [lawId, articleNo, asOf] = rest;
    if (!lawId || !articleNo) throw new Error("사용법: article <law_id> <article_no> [as_of]");
    const res = await provider.getLawArticle(lawId, articleNo, asOf ? { asOf } : undefined);
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return;
  }

  throw new Error(`알 수 없는 명령: ${cmd ?? "(없음)"} — search | article`);
}

main().catch((err) => {
  // 에이전트가 실패를 관측할 수 있어야 한다 — 조용히 죽지 않는다.
  process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
