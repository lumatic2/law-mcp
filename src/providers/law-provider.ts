import type {
  GetAdminRuleResult,
  GetLawArticleResult,
  GetPrecedentResult,
  SearchAdminRulesResult,
  SearchLawResult,
  SearchPrecedentsResult,
} from "../types.js";

export interface LawProvider {
  searchLaw(query: string, options?: { limit?: number }): Promise<SearchLawResult>;
  getLawArticle(lawId: string, articleNo: string): Promise<GetLawArticleResult | null>;
  searchPrecedents(query: string, options?: { limit?: number }): Promise<SearchPrecedentsResult>;
  getPrecedent(precedentId: string): Promise<GetPrecedentResult | null>;
  searchAdminRules(query: string, options?: { limit?: number }): Promise<SearchAdminRulesResult>;
  getAdminRule(
    ruleId: string,
    options?: { offset?: number; limit?: number },
  ): Promise<GetAdminRuleResult | null>;
}
