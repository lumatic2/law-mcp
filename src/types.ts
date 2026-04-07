export type LawMatchType = "exact" | "prefix" | "contains";

export interface SearchLawItem {
  law_id: string;
  law_name: string;
  effective_date?: string | null;
  law_mst?: string | null;
  match_type: LawMatchType;
}

export interface LawSummary extends SearchLawItem {}

export interface LawArticle {
  article_no: string;
  title?: string | null;
  content: string;
}

export interface SearchLawResult {
  query: string;
  total: number;
  items: SearchLawItem[];
  warnings?: string[];
}

export interface GetLawArticleResult {
  law_id: string;
  law_name?: string | null;
  article_no: string;
  title?: string | null;
  content: string;
  warnings?: string[];
}

export interface BatchValidateLegalTermsItemConflict {
  suggested: string;
  reason: string;
  profile?: "legal" | "tax" | "custom";
}

export interface BatchValidateLegalTermsResult {
  items: Array<{
    term: string;
    status: "ok" | "suspect";
    reason: string;
    suggested?: string;
    profile?: "legal" | "tax" | "custom";
    conflicts?: BatchValidateLegalTermsItemConflict[];
  }>;
  warnings?: string[];
}

export interface SuggestTermPatchesResult {
  terms: string[];
  patches: Array<{
    before: string;
    after: string;
    reason: string;
    source: "rules" | "dictionary";
  }>;
  notes: string[];
  warnings?: string[];
  patched_text?: string;
  applied_patch_count?: number;
}
