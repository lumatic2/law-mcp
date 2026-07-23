/**
 * 검색→시점조회 체인 실 MCP 관측 (TF4 step-2).
 *
 * 사람 손으로 법령ID 를 넣어 보는 것과 다르다 — **`search_law` 가 준 값을 그대로**
 * `get_law_article` 에 넘겨 체인이 실제로 이어지는지 본다. 그게 에이전트가 하는 일이다.
 *
 * 사용: npx tsx src/asof-chain-smoke.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parsed(result: unknown): any {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = content.find((c) => c.type === "text")?.text ?? "{}";
  // 도구는 실패를 JSON 이 아닌 "ERROR: ..." 평문으로 줄 수 있다 — 그대로 살려서 보고한다.
  try { return JSON.parse(text); } catch { return { __error: text }; }
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.resolve(__dirname, "../dist/index.js")],
  });
  const client = new Client({ name: "law-mcp-asof-chain-smoke", version: "0.1.0" });
  await client.connect(transport);

  console.log("① search_law('근로소득세액공제')");
  const search = parsed(await client.callTool({ name: "search_law", arguments: { query: "근로소득세액공제", limit: 3 } }));
  // 에이전트가 하듯 1위를 그대로 쓴다 — 다만 조문이 실재하는 본법을 고르기 위해 시행령은 건너뛴다.
  const top = (search.items ?? []).find((i: any) => !/시행령|시행규칙/.test(i.law_name)) ?? search.items?.[0];
  console.log(`   → ${top?.law_name} (law_id=${top?.law_id})`);

  console.log("② 받은 law_id 를 그대로 as_of 에 넘긴다");
  for (const asOf of ["2020", "2024"]) {
    const res = parsed(await client.callTool({
      name: "get_law_article",
      arguments: { law_id: top.law_id, article_no: "제59조", as_of: asOf },
    }));
    if (res.__error) {
      console.log(`   as_of=${asOf} → ${res.__error.slice(0, 120)}`);
      continue;
    }
    const body = String(res.content ?? "").replace(/\s+/g, "");
    console.log(`   as_of=${asOf} → 시행일 ${res.effective_date} · 본문 ${body.length}자 · rule="${String(res.as_of_rule ?? "").slice(0, 40)}..."`);
  }

  console.log("③ 시점 없이(현행)");
  const cur = parsed(await client.callTool({
    name: "get_law_article",
    arguments: { law_id: top.law_id, article_no: "제59조" },
  }));
  console.log(`   → 시행일 ${cur.effective_date} · 본문 ${String(cur.content ?? "").replace(/\s+/g, "").length}자`);

  await client.close();
}

main().catch((e) => { console.error("스모크 실패:", (e as Error).message); process.exit(1); });
