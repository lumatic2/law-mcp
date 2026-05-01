import axios from "axios";
import {
  assertLawApiKey,
  LAW_API_OC,
  LAW_SEARCH_BASE_URL,
  LAW_SERVICE_BASE_URL,
} from "../config.js";
import { createMcpError } from "../mcp-error.js";
import type {
  GetAdminRuleResult,
  GetLawArticleResult,
  GetPrecedentResult,
  SearchAdminRulesResult,
  SearchLawResult,
  SearchPrecedentsResult,
} from "../types.js";
import type { LawProvider } from "./law-provider.js";

const ARTICLE_NUMBER_KEYS = ["조문번호", "JO_NO", "article_no", "no"] as const;
const ARTICLE_BRANCH_KEYS = ["조문가지번호", "JO_BRANCH", "branch_no", "가지번호"] as const;
const ARTICLE_ENABLED_KEYS = ["조문여부", "조문여부YN", "JO_YN", "is_article"] as const;

type ArticleReference = {
  display: string;
  main: number;
  branch: number;
  matchKey: string;
  joParam: string;
};

type MatchType = "exact" | "prefix" | "contains";

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function stripHtml(value: string | null): string | null {
  if (!value) return value;
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLawName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function getMatchType(normalizedLawName: string, normalizedQuery: string): MatchType {
  if (normalizedLawName === normalizedQuery) return "exact";
  if (normalizedLawName.startsWith(normalizedQuery)) return "prefix";
  return "contains";
}

function getMatchRank(matchType: MatchType): number {
  switch (matchType) {
    case "exact":
      return 0;
    case "prefix":
      return 1;
    case "contains":
    default:
      return 2;
  }
}

function normalizeArticleInput(value: string): string {
  const compact = value.replace(/\s+/g, "");
  const explicitMatch = compact.match(/^제?(\d+)조(?:의(\d+))?$/);
  if (explicitMatch) {
    return explicitMatch[2] ? `${explicitMatch[1]}의${explicitMatch[2]}` : explicitMatch[1];
  }
  return compact.replace(/^제/, "").replace(/조/g, "").replace(/항$/, "");
}

function parseArticleReference(value: string, fallbackBranch?: string | null): ArticleReference | null {
  const normalized = normalizeArticleInput(value);
  if (!normalized) return null;

  let main = 0;
  let branch = 0;

  if (/^\d{6}$/.test(normalized)) {
    main = Number(normalized.slice(0, 4));
    branch = Number(normalized.slice(4, 6));
  } else {
    const match = normalized.match(/^(\d+)(?:(?:의|-)(\d+))?$/);
    if (!match) return null;
    main = Number(match[1]);
    branch = match[2] ? Number(match[2]) : 0;
  }

  if (fallbackBranch) {
    const branchDigits = fallbackBranch.replace(/\D/g, "");
    if (branchDigits) branch = Number(branchDigits);
  }

  if (!Number.isFinite(main) || main <= 0 || !Number.isFinite(branch) || branch < 0) return null;

  return {
    display: branch > 0 ? `${main}의${branch}` : `${main}`,
    main,
    branch,
    matchKey: `${main}:${branch}`,
    joParam: `${String(main).padStart(4, "0")}${String(branch).padStart(2, "0")}`,
  };
}

function getArticleReferenceFromRow(joObj: Record<string, unknown>): ArticleReference | null {
  const articleNo = pickString(joObj, [...ARTICLE_NUMBER_KEYS]);
  if (!articleNo) return null;
  const branchNo = pickString(joObj, [...ARTICLE_BRANCH_KEYS]);
  return parseArticleReference(articleNo, branchNo);
}

function buildUpstreamError(message: string, code: string, retryable: boolean, upstreamStatus?: number): Error {
  return createMcpError({
    code,
    message,
    retryable,
    upstream_status: upstreamStatus,
  });
}

function throwIfAuthError(root: Record<string, unknown>, upstreamStatus?: number): void {
  const result = pickString(root, ["result"]);
  const msg = pickString(root, ["msg"]);
  const combined = `${result ?? ""} ${msg ?? ""}`.trim();
  if (!combined) return;

  if (/인증|검증|권한|인가|서비스키|api\s*key|유효하지/i.test(combined)) {
    throw buildUpstreamError(`법제처 API 인증 실패: ${combined}`, "LAW_API_AUTH_ERROR", false, upstreamStatus ?? 401);
  }

  if (/rate|limit|quota|too many|초과|제한|트래픽/i.test(combined)) {
    throw buildUpstreamError(`법제처 API 호출 제한: ${combined}`, "LAW_API_RATE_LIMIT", true, upstreamStatus ?? 429);
  }

  if (/일시|temporary|temporarily|점검|장애|busy|timeout|unavailable/i.test(combined)) {
    throw buildUpstreamError(`법제처 API 일시 장애: ${combined}`, "LAW_API_TEMPORARY_ERROR", true, upstreamStatus ?? 503);
  }

  if (/실패|error/i.test(combined)) {
    throw buildUpstreamError(`법제처 API 호출 실패: ${combined}`, "LAW_API_ERROR", false, upstreamStatus);
  }
}

async function fetchLawApi(url: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  try {
    const response = await axios.get<unknown>(url, {
      params,
      timeout: 15_000,
      validateStatus: () => true,
    });

    const root = asObject(response.data);
    if (response.status >= 400) {
      const message = pickString(root, ["msg", "message", "error_description", "error"]) ?? `HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) {
        throw buildUpstreamError(`법제처 API 인증 실패: ${message}`, "LAW_API_AUTH_ERROR", false, response.status);
      }
      if (response.status === 429) {
        throw buildUpstreamError(`법제처 API 호출 제한: ${message}`, "LAW_API_RATE_LIMIT", true, response.status);
      }
      if (response.status >= 500) {
        throw buildUpstreamError(`법제처 API 일시 장애: ${message}`, "LAW_API_TEMPORARY_ERROR", true, response.status);
      }
      throw buildUpstreamError(`법제처 API 호출 실패: ${message}`, "LAW_API_ERROR", false, response.status);
    }

    throwIfAuthError(root, response.status);
    return root;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const upstreamStatus = error.response?.status;
      if (upstreamStatus === 401 || upstreamStatus === 403) {
        throw buildUpstreamError("법제처 API 인증 실패", "LAW_API_AUTH_ERROR", false, upstreamStatus);
      }
      if (upstreamStatus === 429) {
        throw buildUpstreamError("법제처 API 호출 제한", "LAW_API_RATE_LIMIT", true, upstreamStatus);
      }
      if ((upstreamStatus ?? 0) >= 500 || error.code === "ECONNABORTED") {
        throw buildUpstreamError("법제처 API 일시 장애", "LAW_API_TEMPORARY_ERROR", true, upstreamStatus);
      }
    }

    throw error;
  }
}

async function fetchLawArticleRoot(
  lawKey: string,
  keyField: "ID" | "MST",
  joParam?: string,
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    OC: LAW_API_OC,
    target: "law",
    type: "JSON",
    [keyField]: lawKey,
  };

  if (joParam) params.JO = joParam;
  return fetchLawApi(LAW_SERVICE_BASE_URL, params);
}

function shouldStopLawFetchFallback(error: unknown): boolean {
  const candidate = error as Error & { code?: string };
  return (
    candidate.code === "LAW_API_AUTH_ERROR"
    || candidate.code === "LAW_API_RATE_LIMIT"
    || candidate.code === "LAW_API_TEMPORARY_ERROR"
  );
}

/**
 * 법제처 API의 조문 중첩 구조(항 → 호 → 목)를 재귀적으로 수집해 전문(全文)을 반환한다.
 * 조문내용: 조문 표제 행 / 항내용: 각 항 본문 / 호내용: 각 호 / 목내용: 각 목
 */
function extractFullArticleContent(joObj: Record<string, unknown>): string {
  const parts: string[] = [];

  const heading = pickString(joObj, ["조문내용", "JO_CONTENT", "content"]);
  if (heading) parts.push(heading);

  const 항List = toArray((joObj["항"] ?? joObj["para"] ?? joObj["paragraph"]) as unknown);
  for (const 항 of 항List) {
    const 항Obj = asObject(항);
    const 항내용 = stripHtml(pickString(항Obj, ["항내용", "PARA_CONTENT", "para_content"]));
    if (항내용) parts.push(항내용);

    const 호List = toArray((항Obj["호"] ?? 항Obj["ho"] ?? 항Obj["subitem"]) as unknown);
    for (const 호 of 호List) {
      const 호Obj = asObject(호);
      const 호내용 = stripHtml(pickString(호Obj, ["호내용", "HO_CONTENT", "ho_content"]));
      if (호내용) parts.push(호내용);

      const 목List = toArray((호Obj["목"] ?? 호Obj["mok"] ?? 호Obj["detail"]) as unknown);
      for (const 목 of 목List) {
        const 목Obj = asObject(목);
        const 목내용 = stripHtml(pickString(목Obj, ["목내용", "MOK_CONTENT", "mok_content"]));
        if (목내용) parts.push(목내용);
      }
    }
  }

  return parts.join("\n").trim();
}

function findArticleInRoot(
  root: Record<string, unknown>,
  requestedArticle: ArticleReference | null,
  normalizedArticleNo: string,
  fallbackLawId: string,
  originalArticleNo: string,
): GetLawArticleResult | null {
  const lawObj = asObject(root.법령 ?? root.law ?? root.Law ?? asObject(root.LawService).법령);
  const joContainer = asObject(lawObj.조문 ?? lawObj.jo ?? lawObj.article);
  const joList = toArray(joContainer.조문단위 ?? joContainer.unit ?? joContainer.items);

  for (const jo of joList) {
    const joObj = asObject(jo);
    const articleEnabled = pickString(joObj, [...ARTICLE_ENABLED_KEYS]);
    // 법제처 API는 조문여부 값으로 "조문"(실제 조문) / "전문"(장·절 제목 등 비조문)을 사용
    if (articleEnabled && articleEnabled !== "조문") continue;

    const rowArticle = getArticleReferenceFromRow(joObj);
    if (!rowArticle) continue;

    const isMatch = requestedArticle
      ? rowArticle.matchKey === requestedArticle.matchKey
      : normalizeArticleInput(rowArticle.display) === normalizedArticleNo;
    if (!isMatch) continue;

    const content = extractFullArticleContent(joObj);
    if (!content) return null;

    return {
      law_id: pickString(lawObj, ["법령ID", "법령일련번호", "ID", "id"]) ?? fallbackLawId,
      law_name: pickString(lawObj, ["법령명한글", "법령명", "name"]),
      article_no: originalArticleNo,
      title: pickString(joObj, ["조문제목", "JO_TITLE", "title"]),
      content,
      warnings: [],
    };
  }

  return null;
}

/**
 * 법제처 Open API(국가법령정보 공동활용) 어댑터.
 * - 검색: DRF/lawSearch.do
 * - 법령 상세: DRF/lawService.do
 */
export class LawGoProvider implements LawProvider {
  async searchLaw(query: string, options: { limit?: number } = {}): Promise<SearchLawResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const display = Math.max(limit * 3, 30);

    const root = await fetchLawApi(LAW_SEARCH_BASE_URL, {
      OC: LAW_API_OC,
      target: "law",
      type: "JSON",
      mobileYn: "Y",
      query,
      display,
    });

    const directLawRows = root.법령 ?? root.law ?? root.Law;
    const nestedLawRows = toArray(asObject(root.LawSearch ?? root.search).law);
    const lawRows = (Array.isArray(directLawRows) ? directLawRows : nestedLawRows).filter(
      (row) => typeof row === "object" && row !== null,
    );
    const normalizedQuery = normalizeLawName(query);

    const items = lawRows
      .map((row, index) => {
        const obj = asObject(row);
        const lawName = pickString(obj, ["법령명한글", "법령명", "name"]) ?? "";
        const normalizedLaw = normalizeLawName(lawName);
        const matchType = getMatchType(normalizedLaw, normalizedQuery);

        return {
          law_id: pickString(obj, ["법령ID", "법령일련번호", "ID", "id"]) ?? `unknown-${index + 1}`,
          law_name: lawName,
          law_mst: pickString(obj, ["법령MST", "MST", "mst"]),
          effective_date: pickString(obj, ["시행일자", "effective_date", "시행일"]),
          match_type: matchType,
          _sortRank: getMatchRank(matchType),
          _sortIndex: index,
          _normalizedLawLength: normalizedLaw.length,
        };
      })
      .sort((left, right) => {
        if (left._sortRank !== right._sortRank) return left._sortRank - right._sortRank;
        if (left._normalizedLawLength !== right._normalizedLawLength) {
          return left._normalizedLawLength - right._normalizedLawLength;
        }
        return left._sortIndex - right._sortIndex;
      })
      .slice(0, limit)
      .map(({ _sortRank, _sortIndex, _normalizedLawLength, ...item }) => item);

    const totalRaw = pickString(root, ["totalCnt", "total", "TotalCnt"]);
    const total = totalRaw ? Number(totalRaw) : items.length;

    return {
      query,
      total: Number.isFinite(total) ? total : items.length,
      items,
      warnings: [],
    };
  }

  /**
   * Resolve a law identifier to a numeric ID.
   * If the input is already numeric, return as-is.
   * Otherwise, search by name and return the best match's law_id.
   */
  private async resolveLawId(lawId: string): Promise<string> {
    if (/^\d+$/.test(lawId)) return lawId;

    const result = await this.searchLaw(lawId, { limit: 1 });
    if (result.items.length === 0) {
      throw createMcpError({
        code: "LAW_NOT_FOUND",
        message: `법령 "${lawId}"을(를) 찾을 수 없습니다. 숫자 법령코드 또는 정확한 법령명을 사용해주세요.`,
        retryable: false,
      });
    }
    return result.items[0].law_id;
  }

  async getLawArticle(lawId: string, articleNo: string): Promise<GetLawArticleResult | null> {
    assertLawApiKey();

    // Auto-resolve law name to numeric ID if needed
    const resolvedLawId = await this.resolveLawId(lawId);

    const requestedArticle = parseArticleReference(articleNo);
    const normalizedArticleNo = normalizeArticleInput(articleNo);
    const joParam = requestedArticle?.joParam ?? normalizedArticleNo;

    try {
      const root = await fetchLawArticleRoot(resolvedLawId, "ID", joParam);
      const exactById = findArticleInRoot(root, requestedArticle, normalizedArticleNo, lawId, articleNo);
      if (exactById) return exactById;
    } catch (error) {
      if (shouldStopLawFetchFallback(error)) throw error;
    }

    const fallbackRoot = await fetchLawArticleRoot(resolvedLawId, "MST", joParam);
    return findArticleInRoot(fallbackRoot, requestedArticle, normalizedArticleNo, lawId, articleNo);
  }

  async searchPrecedents(query: string, options: { limit?: number } = {}): Promise<SearchPrecedentsResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);

    const root = await fetchLawApi(LAW_SEARCH_BASE_URL, {
      OC: LAW_API_OC,
      target: "prec",
      type: "JSON",
      query,
      display: limit,
    });

    const searchObj = asObject(root.PrecSearch);
    const items = toArray(searchObj.prec)
      .map((row) => asObject(row))
      .filter((row) => Object.keys(row).length > 0)
      .map((row, index) => ({
        precedent_id: pickString(row, ["판례일련번호", "판례ID", "ID", "id"]) ?? `unknown-${index + 1}`,
        사건번호: pickString(row, ["사건번호"]),
        사건명: stripHtml(pickString(row, ["사건명"])),
        선고일자: pickString(row, ["선고일자"]),
        법원명: stripHtml(pickString(row, ["법원명"])),
        사건종류명: stripHtml(pickString(row, ["사건종류명"])),
        데이터출처명: stripHtml(pickString(row, ["데이터출처명"])),
        판례상세링크: pickString(row, ["판례상세링크"]),
      }))
      .slice(0, limit);

    const totalRaw = pickString(searchObj, ["totalCnt", "TotalCnt"]);
    const total = totalRaw ? Number(totalRaw) : items.length;

    return {
      query,
      total: Number.isFinite(total) ? total : items.length,
      items,
      warnings: [],
    };
  }

  async getPrecedent(precedentId: string): Promise<GetPrecedentResult | null> {
    assertLawApiKey();
    const root = await fetchLawApi(LAW_SERVICE_BASE_URL, {
      OC: LAW_API_OC,
      target: "prec",
      ID: precedentId,
      type: "JSON",
    });

    const serviceObj = asObject(root.PrecService);
    const 사건명 = stripHtml(pickString(serviceObj, ["사건명"]));
    const 판례내용 = stripHtml(pickString(serviceObj, ["판례내용"]));

    if (Object.keys(serviceObj).length === 0 || (!사건명 && !판례내용)) {
      // JSON 단건 미지원 (주로 NTS sourced 판례). 웹 링크로 본문 확인 가능.
      const webLink = `https://www.law.go.kr/LSW/precInfoP.do?precSeq=${precedentId}&mode=0`;
      return {
        precedent_id: precedentId,
        사건명: "",
        법원명: "",
        선고일자: "",
        판시사항: "",
        판결요지: "",
        참조조문: "",
        판례내용: "",
        warnings: [
          `lawService JSON 단건 미지원 (NTS sourced 가능성). 웹 링크에서 본문 확인: ${webLink}`,
        ],
      };
    }

    return {
      precedent_id: precedentId,
      사건명,
      법원명: stripHtml(pickString(serviceObj, ["법원명"])),
      선고일자: pickString(serviceObj, ["선고일자"]),
      판시사항: stripHtml(pickString(serviceObj, ["판시사항"])),
      판결요지: stripHtml(pickString(serviceObj, ["판결요지"])),
      참조조문: stripHtml(pickString(serviceObj, ["참조조문"])),
      판례내용,
      warnings: [],
    };
  }

  async searchAdminRules(query: string, options: { limit?: number } = {}): Promise<SearchAdminRulesResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);

    const root = await fetchLawApi(LAW_SEARCH_BASE_URL, {
      OC: LAW_API_OC,
      target: "admrul",
      type: "JSON",
      query,
      display: limit,
    });

    const searchObj = asObject(root.AdmRulSearch);
    const items = toArray(searchObj.admrul)
      .map((row) => asObject(row))
      .filter((row) => Object.keys(row).length > 0)
      .map((row, index) => ({
        rule_id: pickString(row, ["행정규칙일련번호", "ID", "id"]) ?? `unknown-${index + 1}`,
        행정규칙ID: pickString(row, ["행정규칙ID"]),
        행정규칙명: stripHtml(pickString(row, ["행정규칙명"])),
        행정규칙종류: stripHtml(pickString(row, ["행정규칙종류"])),
        소관부처명: stripHtml(pickString(row, ["소관부처명"])),
        발령일자: pickString(row, ["발령일자"]),
        시행일자: pickString(row, ["시행일자"]),
        현행연혁구분: stripHtml(pickString(row, ["현행연혁구분"])),
      }))
      .slice(0, limit);

    const totalRaw = pickString(searchObj, ["totalCnt", "TotalCnt"]);
    const total = totalRaw ? Number(totalRaw) : items.length;

    return {
      query,
      total: Number.isFinite(total) ? total : items.length,
      items,
      warnings: [],
    };
  }

  async getAdminRule(ruleId: string): Promise<GetAdminRuleResult | null> {
    assertLawApiKey();
    const root = await fetchLawApi(LAW_SERVICE_BASE_URL, {
      OC: LAW_API_OC,
      target: "admrul",
      ID: ruleId,
      type: "JSON",
    });

    const serviceObj = asObject(root.AdmRulService);
    if (Object.keys(serviceObj).length === 0) return null;

    const basicInfo = asObject(serviceObj.행정규칙기본정보);
    const 조문내용 = toArray(serviceObj.조문내용)
      .map((item) => {
        if (typeof item === "string") return stripHtml(item);
        const obj = asObject(item);
        return stripHtml(
          pickString(obj, ["조문내용", "내용", "content", "text"])
          ?? (Object.keys(obj).length === 0 ? null : JSON.stringify(obj)),
        );
      })
      .filter((item): item is string => typeof item === "string" && item.length > 0);

    const 행정규칙명 = stripHtml(pickString(basicInfo, ["행정규칙명"]));
    if (!행정규칙명 && 조문내용.length === 0) return null;

    return {
      rule_id: ruleId,
      행정규칙명,
      행정규칙종류: stripHtml(pickString(basicInfo, ["행정규칙종류"])),
      소관부처명: stripHtml(pickString(basicInfo, ["소관부처명"])),
      발령일자: pickString(basicInfo, ["발령일자"]),
      시행일자: pickString(basicInfo, ["시행일자"]),
      조문내용,
      warnings: [],
    };
  }
}
