import type { GetLawArticleResult, SearchLawResult } from "../types.js";

export interface LawProvider {
  searchLaw(query: string, options?: { limit?: number }): Promise<SearchLawResult>;
  getLawArticle(lawId: string, articleNo: string): Promise<GetLawArticleResult | null>;
}
