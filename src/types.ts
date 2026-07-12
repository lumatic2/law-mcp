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

export interface SearchPrecedentItem {
  precedent_id: string;
  사건번호?: string | null;
  사건명?: string | null;
  선고일자?: string | null;
  법원명?: string | null;
  사건종류명?: string | null;
  데이터출처명?: string | null;
  판례상세링크?: string | null;
}

export interface SearchPrecedentsResult {
  query: string;
  total: number;
  items: SearchPrecedentItem[];
  warnings?: string[];
}

export interface GetPrecedentResult {
  precedent_id: string;
  사건명?: string | null;
  법원명?: string | null;
  선고일자?: string | null;
  판시사항?: string | null;
  판결요지?: string | null;
  참조조문?: string | null;
  판례내용?: string | null;
  warnings?: string[];
}

export interface SearchAdminRuleItem {
  rule_id: string;
  행정규칙ID?: string | null;
  행정규칙명?: string | null;
  행정규칙종류?: string | null;
  소관부처명?: string | null;
  발령일자?: string | null;
  시행일자?: string | null;
  현행연혁구분?: string | null;
}

export interface SearchAdminRulesResult {
  query: string;
  total: number;
  items: SearchAdminRuleItem[];
  warnings?: string[];
}

export interface GetAdminRuleResult {
  rule_id: string;
  행정규칙명?: string | null;
  행정규칙종류?: string | null;
  소관부처명?: string | null;
  발령일자?: string | null;
  시행일자?: string | null;
  조문내용: string[];
  total_article_count?: number;
  offset?: number;
  has_more?: boolean;
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
