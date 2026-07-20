import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import * as z from "zod";
import { ArticleIndexCache, extractArticles } from "./article-index.js";
import { pickExactLawId, verifyCitation } from "./citation-verify.js";
import { LAW_API_OC, LAW_SERVICE_BASE_URL } from "./config.js";
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

const citationArticleCache = new ArticleIndexCache(20);

/**
 * 인용 검증용 조문 인덱스 로더. 법령을 못 찾거나 조회에 실패하면 null 을 돌려
 * `law_not_found` 로 판정되게 한다 — upstream 장애를 `ok` 로 오판하지 않기 위함.
 */
async function loadArticlesForCitation(lawName: string) {
  const cached = citationArticleCache.get(lawName);
  if (cached) return cached;

  // 완전일치만 채택한다 — 폴백이 준 "비슷한" 법령으로 대조하면 거짓 ok 가 나온다(2026-07-21 실측).
  const search = await provider.searchLaw(lawName, { limit: 5 });
  const lawId = pickExactLawId(search.items, lawName);
  if (!lawId) return null;

  const response = await axios.get<unknown>(LAW_SERVICE_BASE_URL, {
    params: { OC: LAW_API_OC, target: "law", type: "JSON", ID: lawId },
    timeout: 20_000,
    validateStatus: () => true,
  });
  if (response.status >= 400) return null;

  const articles = extractArticles(response.data as Record<string, unknown>);
  if (articles.length === 0) return null;
  citationArticleCache.set(lawName, articles);
  return articles;
}

server.registerTool(
  "verify_citation",
  {
    title: "Verify Legal Citation",
    description:
      "Check whether a cited Korean statute article actually exists, and whether the cited article "
      + "title matches the real one. Use this to catch hallucinated citations like \"형법 제9999조\" or "
      + "a real article number paired with a made-up title. Returns one of: ok, not_found (article "
      + "number does not exist — nearby article numbers are suggested), title_mismatch (article exists "
      + "but its real title differs), law_not_found (the statute itself could not be resolved, which "
      + "also covers upstream lookup failure — never treated as ok).",
    inputSchema: {
      law_name: z.string().min(1).describe("법령명 (예: 형법, 근로기준법)"),
      article: z.string().min(1).describe("조문 (예: 제21조, 21조, 제839조의2)"),
      cited_title: z.string().optional().describe("인용된 조문 제목 — 주면 제목 일치까지 검증한다"),
    },
  },
  async ({ law_name, article, cited_title }) => {
    try {
      const articles = await loadArticlesForCitation(law_name);
      const result = verifyCitation(articles, law_name, article, cited_title);
      return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: toStructuredContent(result),
      };
    } catch (error) {
      return toMcpErrorResponse(error);
    }
  },
);

// --- 법원(法源) 5종 (LB3 step-3) --------------------------------------------
// 기여도 게이트 결과: 법원별 대표 쿼리에서 5종 전부 이름매칭 도달 ≥1 → 전부 등록한다.
// 다만 법원마다 search/get 2개씩 노출하면 도구가 +10 개가 된다(plan 프리모템 시나리오 3).
// `source` 를 파라미터로 받는 **도구 2개**로 5종을 모두 덮는다 — 표면은 9 → 11.
const LEGAL_SOURCES = ["expc", "detc", "decc", "ordin", "lstrm"] as const;

server.registerTool(
  "search_legal_source",
  {
    title: "Search Legal Source",
    description:
      "Search Korean legal sources other than statutes and court precedents: "
      + "expc=법령해석례 (MOLEG statutory interpretations), detc=헌재결정례 (Constitutional Court), "
      + "decc=행정심판재결례 (administrative appeals), ordin=자치법규 (local ordinances), "
      + "lstrm=법령용어 (statutory term dictionary). "
      + "Works best when the query is a topic/case name, since the primary match is on the document "
      + "title. If the title match returns 0 results the tool falls back to full-text search, then a "
      + "relaxed query — and a warning says so. Treat fallback results with suspicion: upstream "
      + "full-text results are ordered by 가나다 (alphabet), NOT by relevance. "
      + "Note lstrm indexes terms *defined in statutes*, so common doctrinal words like 정당방위 "
      + "return 0 results.",
    inputSchema: {
      source: z.enum(LEGAL_SOURCES).describe("검색할 법원(法源)"),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10),
    },
  },
  async ({ source, query, limit }) => {
    try {
      const result = await provider.searchLegalSource(source, query, { limit });
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
  "get_legal_source",
  {
    title: "Get Legal Source",
    description:
      "Get the full document for a legal source item found via search_legal_source. Pass the same "
      + "`source` and the `source_id` returned by the search. 자치법규 results additionally include "
      + "an `articles` array (조문번호/조제목/조내용).",
    inputSchema: {
      source: z.enum(LEGAL_SOURCES).describe("조회할 법원(法源) — 검색에 쓴 값과 같아야 한다"),
      source_id: z.string().min(1).describe("search_legal_source 가 돌려준 source_id"),
    },
  },
  async ({ source, source_id }) => {
    try {
      const result = await provider.getLegalSource(source, source_id);
      if (!result) {
        return toMcpErrorResponse(
          createMcpError({
            code: "NOT_FOUND",
            message: `Legal source document not found: source=${source}, source_id=${source_id}`,
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

const transport = new StdioServerTransport();
await server.connect(transport);
