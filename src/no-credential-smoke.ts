/**
 * 무자격 실표면 관측 (TF3 step-3).
 *
 * **우리는 이미 인증값을 갖고 있어서 이 함정을 못 본다.** 그래서 인증값이 *없는* 상태를
 * 인위적으로 만들어 실제 MCP 클라이언트가 무엇을 받는지 눈으로 확인한다. 문서 diff 는
 * 증거가 아니다 — 사용자가 받는 문자열이 증거다.
 *
 * `.env` 파일은 건드리지 않는다(시크릿 파일이라 이동·삭제가 위험하다). 대신 자식 프로세스에
 * `LAW_API_OC=""` 를 **명시로** 넘긴다 — dotenv 는 이미 정의된 키를 덮어쓰지 않으므로 이러면
 * 디스크의 `.env` 가 있어도 빈 값이 유지된다.
 *
 * 사용: npx tsx src/no-credential-smoke.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 무자격에서 각각 어떻게 되는지 — 도구 성격별로 하나씩. */
const PROBES: Array<{ name: string; args: Record<string, unknown>; expect: string }> = [
  { name: "search_law", args: { query: "소득세", limit: 3 }, expect: "상류 조회 — 실패해야 정상" },
  { name: "get_law_article", args: { law_id: "001565", article_no: "1" }, expect: "상류 조회 — 실패해야 정상" },
  {
    name: "batch_validate_legal_terms",
    args: { terms: ["절세팁"] },
    expect: "로컬 규칙 — 인증값 없이도 돌아야 정상",
  },
];

function firstText(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = content.find((c) => c.type === "text")?.text ?? "";
  return text;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.resolve(__dirname, "../dist/index.js")],
    // 핵심: 빈 문자열을 **명시로** 넘긴다. dotenv 가 .env 로 덮어쓰지 못한다.
    env: {
      LAW_API_OC: process.env.PROBE_OC ?? "",
      LAW_API_KEY: "",
      PATH: process.env.PATH ?? "",
    },
  });

  const client = new Client({ name: "law-mcp-no-credential-smoke", version: "0.1.0" });
  await client.connect(transport);

  const instructions = (client.getInstructions?.() ?? "").slice(0, 200);
  console.log("=== 서버가 기동은 되는가 ===");
  console.log(`연결 성공. instructions ${instructions ? "있음" : "없음"}`);
  console.log("");

  for (const probe of PROBES) {
    console.log(`=== ${probe.name} (${probe.expect}) ===`);
    try {
      const res = await client.callTool({ name: probe.name, arguments: probe.args });
      const text = firstText(res);
      console.log(text.slice(0, 700));
    } catch (e) {
      console.log(`[throw] ${(e as Error).message.slice(0, 700)}`);
    }
    console.log("");
  }

  await client.close();
}

main().catch((e) => {
  console.error("스모크 자체가 실패했다:", (e as Error).message);
  process.exit(1);
});
