export type LawMatchType = "exact" | "prefix" | "contains";

export interface SearchLawItem {
  law_id: string;
  law_name: string;
  effective_date?: string | null;
  law_mst?: string | null;
  match_type: LawMatchType;
  /**
   * 법령용어 연계가 지목한 조문 (예: ["제23조", "제28조"]). 쿼리의 쟁점어가 실제로 쓰인
   * 조문이라 "어느 법 몇 조" 로 바로 이어진다. 연계 신호가 있을 때만 채워진다.
   */
  linked_articles?: string[];
  /**
   * 법제처 지능형 검색(`aiSearch`)이 이 질의에 대해 지목한 이 법령의 조문 (UD2 step-3).
   *
   * `linked_articles` 와 **출처가 다르다** — 저쪽은 "그 용어가 쓰인 조문"(용어 연계)이고
   * 이쪽은 "이 질문에 답하는 조문"(관련도 순위)이다. 소비 LLM 이 어느 신호를 받았는지
   * 알아야 하므로 섞지 않는다. 해당 없으면 **필드 자체가 없다**.
   */
  ai_articles?: Array<{ article: string; title: string | null }>;
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
  /**
   * 이 조문이 속한 법령판의 시행일자 (TV3). 시점을 지정하지 않아도 **항상** 싣는다 —
   * 조문을 인용하는 쪽에 시행일이 없는 게 검색 결과에 없는 것보다 위험하다.
   */
  effective_date?: string;
  /** 시점을 지정했을 때, 우리가 그 시점을 어떻게 해석했는지 (사용자가 검증할 수 있어야 한다) */
  as_of_rule?: string;
  /**
   * 이 조문의 "대통령령으로 정하는" 이 실제로 가리키는 하위 법령 조문 (UD3 step-2).
   * upstream(`lsDelegated`)이 이미 계산해 둔 값이다. 위임이 없으면 **필드 자체가 없다**.
   */
  delegated_to?: Array<{
    law: string;
    kind: string | null;
    article: string;
    title: string | null;
    phrase: string | null;
  }>;
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

/** 법원(法源) 5종 공통 검색 결과 (LB3) */
export interface SearchLegalSourceResult {
  /** 사람이 읽는 법원명 (법령해석례·헌재결정례·행정심판재결례·자치법규·법령용어) */
  source: string;
  /** DRF target */
  target: string;
  /**
   * 구속력 등급 (TV2). 모든 법원(法源)이 같은 무게가 아니다 — 예규는 법원(法院)을 구속하지
   * 않는 참고자료이고, 심판례는 그 사건을 종결시킨 판단이다. **필수 필드다**: 등급 없이
   * 나가면 소비 LLM 이 예규를 조문처럼 인용한다.
   */
  authority: "adjudication" | "reference_only" | "constitutional" | "statute" | "dictionary";
  /** 이 자료를 어떻게 써야 하는지 한 줄 */
  authority_note: string;
  /** upstream 이 밝힌 데이터 기준일(추정 아님). 그 이후 문서는 없다. */
  data_as_of: string | null;
  query: string;
  total: number;
  items: Array<{ source_id: string; title: string | null; [key: string]: string | null }>;
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
