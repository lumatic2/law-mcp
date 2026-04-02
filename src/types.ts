export interface LawSummary {
  law_id: string;
  law_name: string;
  effective_date?: string | null;
}

export interface LawArticle {
  article_no: string;
  title?: string | null;
  content: string;
}

export interface SearchLawResult {
  query: string;
  total: number;
  items: LawSummary[];
}

export interface GetLawArticleResult {
  law_id: string;
  article_no: string;
  title?: string | null;
  content: string;
}

export interface BatchValidateLegalTermsResult {
  items: Array<{
    term: string;
    status: "ok" | "suspect";
    reason: string;
    suggested?: string;
    profile?: "legal" | "tax" | "custom";
  }>;
}
