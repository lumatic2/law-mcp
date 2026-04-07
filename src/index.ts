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
    description: "Search laws by keyword via provider adapter.",
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
