/**
 * M2 실 MCP 체인 스모크 — 신규 자료원 3종 + 예규 본문 도달.
 *
 * dist/index.js 를 실제 MCP 클라이언트(stdio)로 띄워 소비자가 받는 응답 그대로 확인한다.
 * 사용: npm run build && npx tsx src/m2-sources-smoke.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function firstText(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.find((c) => c.type === "text")?.text ?? "";
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.resolve(__dirname, "../dist/index.js")],
  });
  const client = new Client({ name: "m2-sources-smoke", version: "0.1.0" });
  await client.connect(transport);

  // ① 조약: 검색 → 전문
  const trty = JSON.parse(firstText(await client.callTool({
    name: "search_legal_source",
    arguments: { source: "trty", query: "소득에 대한 조세의 이중과세회피", limit: 3 },
  })));
  console.log("[trty] total:", trty.total, "| authority:", trty.authority, "| 1위:", trty.items?.[0]?.title?.slice(0, 50));
  const trtyDetail = JSON.parse(firstText(await client.callTool({
    name: "get_legal_source",
    arguments: { source: "trty", source_id: String(trty.items[0].source_id) },
  })));
  console.log("[trty 전문] len:", String(trtyDetail.조약내용 ?? "").length);
  if (!String(trtyDetail.조약내용 ?? "").includes("체약국")) throw new Error("조약 전문 내용 검증 실패");

  // ② 신구법: 검색 → 신/구 조문 목록
  const oan = JSON.parse(firstText(await client.callTool({
    name: "search_legal_source",
    arguments: { source: "oldAndNew", query: "소득세법", limit: 1 },
  })));
  const oanDetail = JSON.parse(firstText(await client.callTool({
    name: "get_legal_source",
    arguments: { source: "oldAndNew", source_id: String(oan.items[0].source_id) },
  })));
  console.log("[oldAndNew 전문] 신:", oanDetail.신조문목록?.length, "행 / 구:", oanDetail.구조문목록?.length, "행");
  if (!(oanDetail.신조문목록?.length > 0 && oanDetail.구조문목록?.length > 0)) throw new Error("신구법 목록 검증 실패");

  // ③ 별표: 검색(메타+링크) → 전문은 사유 있는 거절
  const byl = JSON.parse(firstText(await client.callTool({
    name: "search_legal_source",
    arguments: { source: "licbyl", query: "세율", limit: 1 },
  })));
  console.log("[licbyl] total:", byl.total, "| PDF링크:", byl.items?.[0]?.별표서식PDF파일링크);
  if (!byl.items?.[0]?.별표서식PDF파일링크) throw new Error("별표 PDF 링크 누락");
  const bylDetail = await client.callTool({
    name: "get_legal_source",
    arguments: { source: "licbyl", source_id: String(byl.items[0].source_id) },
  });
  const bylText = firstText(bylDetail);
  if (!/PDF/.test(bylText)) throw new Error("별표 전문 거절 안내가 없다: " + bylText.slice(0, 120));
  console.log("[licbyl 전문] 사유 있는 거절 확인");

  // ④ 예규: 검색 → 원문링크를 source_id 로 → 본문
  const expc = JSON.parse(firstText(await client.callTool({
    name: "search_legal_source",
    arguments: { source: "ntsExpc", query: "가산세", limit: 1 },
  })));
  const expcDetail = JSON.parse(firstText(await client.callTool({
    name: "get_legal_source",
    arguments: { source: "ntsExpc", source_id: String(expc.items[0].원문링크) },
  })));
  console.log("[ntsExpc 전문] 안건명:", String(expcDetail.안건명 ?? "").slice(0, 40), "| 본문 len:", String(expcDetail.본문 ?? "").length);
  if (String(expcDetail.본문 ?? "").length < 500) throw new Error("예규 본문이 비었거나 짧다");

  await client.close();
  console.log("M2 실 MCP 체인 스모크 — 전부 통과");
}

main().catch((error) => {
  console.error("SMOKE FAIL:", error);
  process.exit(1);
});
