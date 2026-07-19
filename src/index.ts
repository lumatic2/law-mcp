import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { evaluateLegalRuleIssues, groupLegalRuleIssuesByTerm } from "./legal-rules.js";
import { createMcpError, toMcpErrorResponse } from "./mcp-error.js";
import { LawGoProvider } from "./providers/lawgo-provider.js";
import { suggestTermPatches } from "./term-patches.js";
import type { BatchValidateLegalTermsResult } from "./types.js";

const provider = new LawGoProvider();

function toText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toStructuredContent(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

const server = new McpServer({
  name: "law-mcp",
  version: "0.1.0",
});

server.registerTool(
  "search_law",
  {
    title: "Search Law",
    description:
      "Search laws by keyword. Tries law-name match first; if 0 results, automatically retries "
      + "as a full-text (body) search, then once more with the query relaxed (last token dropped) "
      + "if still 0, then with revised legal terms substituted. A warning field notes when a "
      + "fallback mode was used; body-search results are NOT relevance-ranked.",
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
    },
  },
  async ({ query, limit }) => {
    try {
      const result = await provider.searchLaw(query, { limit });
      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "get_law_article",
  {
    title: "Get Law Article",
    description: "Get a specific law article by law id and article number.",
    inputSchema: {
      law_id: z.string().min(1),
      article_no: z.string().min(1),
    },
  },
  async ({ law_id, article_no }) => {
    try {
      const result = await provider.getLawArticle(law_id, article_no);
      if (!result) {
        return toMcpErrorResponse(
          createMcpError({
            code: "NOT_FOUND",
            message: `Article not found: law_id=${law_id}, article_no=${article_no}`,
            retryable: false,
          }),
        );
      }

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "search_precedents",
  {
    title: "Search Precedents",
    description:
      "Search court precedents by keyword (AND match across all query tokens). "
      + "Multi-word natural-language queries that return 0 results are automatically retried once "
      + "with the last token dropped; a warning field notes when this relaxed retry was used.",
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
    },
  },
  async ({ query, limit }) => {
    try {
      const result = await provider.searchPrecedents(query, { limit });
      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "get_precedent",
  {
    title: "Get Precedent",
    description:
      "Get precedent detail by precedent id. Most precedents resolve via law.go.kr lawService. "
      + "NTS(국세법령정보시스템)-sourced tax precedents fall back to the NTS taxlaw document API: "
      + "사건명/판결요지/참조조문 are recovered, but 판시사항 and exact 선고일자 are not available "
      + "from that source, and full text (판례내용) is often only in an HWP attachment the tool "
      + "cannot reach — in that case 판결요지 is used as 판례내용 and a warning notes the gap.",
    inputSchema: {
      precedent_id: z.string().min(1),
    },
  },
  async ({ precedent_id }) => {
    try {
      const result = await provider.getPrecedent(precedent_id);
      if (!result) {
        return toMcpErrorResponse(
          createMcpError({
            code: "NOT_FOUND",
            message: `Precedent not found: precedent_id=${precedent_id}`,
            retryable: false,
          }),
        );
      }

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "search_admin_rules",
  {
    title: "Search Admin Rules",
    description:
      "Search administrative rules by keyword. Tries rule-name match first; if 0 results, "
      + "automatically retries as a full-text (body) search, then with the query relaxed (last "
      + "token dropped), then with revised legal terms substituted (e.g. 기업업무추진비 <-> 접대비). "
      + "A warning field notes which fallback produced the results; body-search results are NOT "
      + "relevance-ranked.",
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
    },
  },
  async ({ query, limit }) => {
    try {
      const result = await provider.searchAdminRules(query, { limit });
      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "get_admin_rule",
  {
    title: "Get Admin Rule",
    description:
      "Get administrative rule detail by rule id. 조문내용 is an array of per-article text "
      + "segments; large rule documents can exceed tool output limits, so use offset/limit to "
      + "page through 조문내용 (response includes total_article_count/has_more).",
    inputSchema: {
      rule_id: z.string().min(1),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).optional(),
    },
  },
  async ({ rule_id, offset, limit }) => {
    try {
      const result = await provider.getAdminRule(rule_id, { offset, limit });
      if (!result) {
        return toMcpErrorResponse(
          createMcpError({
            code: "NOT_FOUND",
            message: `Admin rule not found: rule_id=${rule_id}`,
            retryable: false,
          }),
        );
      }

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "batch_validate_legal_terms",
  {
    title: "Batch Validate Legal Terms",
    description: "Validate legal/tax terms against replacement rules for writing-quality control.",
    inputSchema: {
      terms: z.array(z.string().min(1)).min(1).max(200),
      profile: z.enum(["legal", "tax"]).default("legal"),
      custom_replacements: z
        .array(
          z.object({
            bad: z.string().min(1),
            good: z.string().min(1),
            reason: z.string().min(1),
          }),
        )
        .max(100)
        .default([]),
    },
  },
  async ({ terms, profile, custom_replacements }) => {
    try {
      const issues = evaluateLegalRuleIssues(terms, profile, custom_replacements);
      const groupedIssues = new Map(
        groupLegalRuleIssuesByTerm(issues).map((group) => [group.term, group.issues]),
      );
      const uniqueTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
      const warnings = [...groupedIssues.entries()]
        .filter(([, grouped]) => grouped.length > 1)
        .map(([term]) => `충돌하는 대체 규칙이 감지되었습니다: ${term}`);

      const result: BatchValidateLegalTermsResult = {
        items: uniqueTerms.map((term) => {
          const termIssues = groupedIssues.get(term) ?? [];
          const [primaryIssue, ...conflicts] = termIssues;

          if (!primaryIssue) {
            return {
              term,
              status: "ok" as const,
              reason: "규칙 위반이 발견되지 않았습니다.",
            };
          }
          return {
            term,
            status: "suspect" as const,
            reason: primaryIssue.reason,
            suggested: primaryIssue.suggested,
            profile: primaryIssue.profile,
            conflicts: conflicts.length > 0
              ? conflicts.map((issue) => ({
                  suggested: issue.suggested,
                  reason: issue.reason,
                  profile: issue.profile,
                }))
              : undefined,
          };
        }),
        warnings,
      };

      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

server.registerTool(
  "suggest_term_patches",
  {
    title: "Suggest Term Patches",
    description: "Return before/after correction patches from legal-tax rules and optional dictionary evidence.",
    inputSchema: {
      text: z.string().default(""),
      terms: z.array(z.string().min(1)).max(300).default([]),
      profile: z.enum(["legal", "tax"]).default("legal"),
      include_dictionary: z.boolean().default(true),
      custom_replacements: z
        .array(
          z.object({
            bad: z.string().min(1),
            good: z.string().min(1),
            reason: z.string().min(1),
          }),
        )
        .max(100)
        .default([]),
    },
  },
  async ({ text, terms, profile, include_dictionary, custom_replacements }) => {
    try {
      const result = await suggestTermPatches({
        text,
        terms,
        profile,
        includeDictionary: include_dictionary,
        customReplacements: custom_replacements,
      });
      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
