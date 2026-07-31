/**
 * M3 실 MCP 재현 스모크 — 함정 J·I·D 의 수리 후 동작을 실제 MCP 클라이언트로 관측.
 * (F 5xx 재분류는 정상 인증 환경에서 상류 5xx 를 재현할 수 없어 단위 테스트로 검증 —
 *  test/m3-trap-fixes.test.ts)
 *
 * 사용: npm run build && npx tsx src/m3-traps-smoke.ts
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
  const client = new Client({ name: "m3-traps-smoke", version: "0.1.0" });
  await client.connect(transport);

  // J — 재현 케이스: 001586 제59조 as_of=2024. 종전 law_name: null.
  const j = JSON.parse(firstText(await client.callTool({
    name: "get_law_article",
    arguments: { law_id: "001586", article_no: "59", as_of: "2024" },
  })));
  console.log("[J] law_name:", j.law_name, "| effective_date:", j.effective_date);
  if (!j.law_name) throw new Error("J 미수리 — law_name 이 여전히 null");

  // D — 위임 지점 조문(소득세법 제12조 비과세소득): delegated_to + 소비 안내
  const d = JSON.parse(firstText(await client.callTool({
    name: "get_law_article",
    arguments: { law_id: "001565", article_no: "12" },
  })));
  const dNotice = (d.warnings ?? []).some((w: string) => /본법이 아니라/.test(w));
  console.log("[D] delegated_to:", (d.delegated_to ?? []).length, "건 | 소비 안내 실림:", dNotice);
  if ((d.delegated_to ?? []).length > 0 && !dNotice) throw new Error("D 미수리 — 위임 지점인데 안내 없음");

  // D 대조 — 위임 없는 조문은 소음 없음 (국세기본법 제59조 대리인)
  const dNone = JSON.parse(firstText(await client.callTool({
    name: "get_law_article",
    arguments: { law_id: "001586", article_no: "59" },
  })));
  const noiseless = !(dNone.warnings ?? []).some((w: string) => /본법이 아니라/.test(w)) && !dNone.delegated_to;
  console.log("[D 대조] 위임 없는 조문 소음 없음:", noiseless);
  if (!noiseless) throw new Error("D 과잉 — 위임 없는 조문에 안내가 붙었다");

  // J+as_of — 과거 시점 + 위임 지점: 현행 기준 고지
  const jAsOf = JSON.parse(firstText(await client.callTool({
    name: "get_law_article",
    arguments: { law_id: "001565", article_no: "12", as_of: "2024" },
  })));
  const asOfNotice = (jAsOf.warnings ?? []).some((w: string) => /현행 법령 기준/.test(w));
  console.log("[I/D as_of] delegated_to:", (jAsOf.delegated_to ?? []).length, "건 | 현행 기준 고지:", asOfNotice, "| law_name:", jAsOf.law_name);

  // I — 병렬화·캐시 지연: 같은 법령 두 번 조회
  const t1 = Date.now();
  await client.callTool({ name: "get_law_article", arguments: { law_id: "001565", article_no: "20" } });
  const cold = Date.now() - t1;
  const t2 = Date.now();
  await client.callTool({ name: "get_law_article", arguments: { law_id: "001565", article_no: "21" } });
  const warm = Date.now() - t2;
  console.log(`[I] cold(위임 병렬): ${cold}ms | warm(위임 캐시 적중): ${warm}ms`);

  await client.close();
  console.log("M3 실 MCP 재현 스모크 — 전부 통과");
}

main().catch((error) => {
  console.error("SMOKE FAIL:", error);
  process.exit(1);
});
