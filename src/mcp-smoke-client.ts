import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    // 이 파일 기준 상대경로. 예전에는 다른 머신의 절대경로가 박혀 있어 이 레포에서 실행되지 않았다.
    args: [path.resolve(__dirname, "../dist/index.js")],
  });

  const client = new Client({ name: "law-mcp-smoke-client", version: "0.1.0" });
  await client.connect(transport);

  const search = await client.callTool({
    name: "search_law",
    arguments: { query: "소득세", limit: 3 },
  });

  const entry = await client.callTool({
    name: "get_law_article",
    arguments: { law_id: "001565", article_no: "1" },
  });

  const legalTerms = await client.callTool({
    name: "batch_validate_legal_terms",
    arguments: {
      terms: ["절세팁", "공제율", "소득세법", "세금폭탄"],
      profile: "tax",
    },
  });

  const patches = await client.callTool({
    name: "suggest_term_patches",
    arguments: {
      text: "이번 절세팁에서는 공제율 변화로 세금폭탄을 피하는 방법을 설명합니다.",
      profile: "tax",
    },
  });

  console.log("search_law:", JSON.stringify(search, null, 2));
  console.log("get_law_article:", JSON.stringify(entry, null, 2));
  console.log("batch_validate_legal_terms:", JSON.stringify(legalTerms, null, 2));
  console.log("suggest_term_patches:", JSON.stringify(patches, null, 2));

  await client.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
