import axios from "axios";
import {
  assertLawApiKey,
  LAW_API_OC,
  LAW_SEARCH_BASE_URL,
  LAW_SERVICE_BASE_URL,
} from "../config.js";
import { createMcpError } from "../mcp-error.js";
import { bridgeTerm, formatBridgeWarning, type TermBridgeMatch } from "../term-bridge.js";
import type {
  GetAdminRuleResult,
  GetLawArticleResult,
  GetPrecedentResult,
  SearchAdminRulesResult,
  SearchLawResult,
  SearchPrecedentsResult,
} from "../types.js";
import type { LawProvider } from "./law-provider.js";
import { searchWithLadder } from "./source-adapter.js";

const ARTICLE_NUMBER_KEYS = ["조문번호", "JO_NO", "article_no", "no"] as const;
const ARTICLE_BRANCH_KEYS = ["조문가지번호", "JO_BRANCH", "branch_no", "가지번호"] as const;
const ARTICLE_ENABLED_KEYS = ["조문여부", "조문여부YN", "JO_YN", "is_article"] as const;

// NTS(국세법령정보시스템) 소스 판례 폴백 경로. law.go.kr lawService(target=prec) 단건조회가
// NTS sourced 판례에서는 빈 응답을 주기 때문에, precInfoP.do 리다이렉트를 따라가 국세청
// taxlaw.nts.go.kr 문서 API(action.do)로 본문을 확보한다.
const NTS_PREC_REDIRECT_URL = "https://www.law.go.kr/LSW/precInfoP.do";
const NTS_TAXLAW_ACTION_URL = "https://taxlaw.nts.go.kr/action.do";
const NTS_ACTION_ID = "ASIQTB002PR01";
const NTS_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const NTS_PLACEHOLDER_CONTENT_PATTERN = /붙임과\s*같습니다/;

// 본문(전문) 검색 결과에는 upstream 이 매칭 스니펫·관련도 점수를 주지 않는다(2026-07-20 실측).
// 정렬은 법령명 토큰 겹침 → upstream 순서(가나다)일 뿐이므로, 상위 = 가장 관련 있는 법령이 아니다.
const BODY_SEARCH_RANK_WARNING =
  "본문검색 결과는 관련도순이 아님(upstream 이 관련도 점수를 제공하지 않음) — 목록에서 쟁점에 맞는 항목을 직접 고를 것.";

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

const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  middot: "·",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
};

/**
 * HTML 엔티티를 원문자로 되돌린다. 태그만 벗기면 NTS 변환 HTML 의 `&nbsp;` 가 판례 전문에 그대로
 * 남아 인용문에 섞여 들어간다(2026-07-20 실표면 관측: get_precedent(612611) 전문).
 */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function stripHtml(value: string | null): string | null {
  if (!value) return value;
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeLawName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * 본문(전문) 검색 결과의 정렬 점수. 본문검색은 쿼리가 법령명에 걸리지 않아 match_type 이 전부
 * "contains" 로 동률이 되고, 그러면 법령명 글자수 타이브레이커가 사실상 유일한 정렬 기준이 되어
 * "이름 짧은 법 순"이 된다(2026-07-20 실측: '가지급금 인정이자' → 예금자보호법·방송법 시행규칙이
 * 법인세법 시행령보다 상위). upstream 응답 순서도 관련도가 아닌 가나다순이라 대안이 못 된다.
 * 응답에 매칭 스니펫·스코어 필드가 없으므로 쓸 수 있는 유일한 쿼리 의존 신호는 법령명 토큰 겹침이다.
 */
export function countNameTokenMatches(lawName: string, query: string): number {
  const normalizedName = normalizeLawName(lawName);
  if (!normalizedName) return 0;

  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => normalizeLawName(token))
    .filter(Boolean);

  return tokens.filter((token) => normalizedName.includes(token)).length;
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

/**
 * precInfoP.do 302 응답의 Location 헤더에서 NTS 문서 ID(ntstDcmId)를 추출한다.
 * NTS 소스가 아닌 리다이렉트(법제처 자체 페이지 등)는 null을 반환한다.
 */
export function extractNtstDcmIdFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  try {
    const url = new URL(location, "https://www.law.go.kr");
    if (!url.hostname.toLowerCase().endsWith("nts.go.kr")) return null;
    return url.searchParams.get("ntstDcmId");
  } catch {
    return null;
  }
}

/**
 * NTS 문서 API는 전문(全文)이 HWP 첨부에만 있는 문서(대부분의 판결·결정)의 경우
 * 본문 필드에 "판결 내용은 붙임과 같습니다" 류의 플레이스홀더만 채워 넣는다.
 */
export function isNtsPlaceholderContent(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return true;
  return NTS_PLACEHOLDER_CONTENT_PATTERN.test(value);
}

/**
 * NTS taxlaw.nts.go.kr action.do 응답(data.ASIQTB002PR01)을 GetPrecedentResult로 매핑한다.
 * 판시사항·정확한 선고일자 등 NTS 구조에 없는 필드는 null로 두고 warnings 에 한계를 명시한다.
 */
/**
 * dcmHwpEditorDVOList 에서 서버가 HWP 첨부를 변환해 둔 HTML 전문(dcmFleTy === 'html' && dcmFleByte 有)을
 * dcmFleSn 순으로 이어붙여 텍스트로 반환한다. 해당 항목이 없으면 null.
 */
function extractNtsFullTextFromHwpEditorList(actionData: Record<string, unknown>): string | null {
  const entries = toArray(actionData.dcmHwpEditorDVOList).map((row) => asObject(row));
  const htmlEntries = entries
    .filter((row) => pickString(row, ["dcmFleTy"]) === "html" && pickString(row, ["dcmFleByte"]))
    .sort((a, b) => {
      const snA = Number(pickString(a, ["dcmFleSn"]) ?? 0);
      const snB = Number(pickString(b, ["dcmFleSn"]) ?? 0);
      return snA - snB;
    });

  if (htmlEntries.length === 0) return null;

  const text = htmlEntries
    .map((row) => stripHtml(pickString(row, ["dcmFleByte"])))
    .filter((value): value is string => !!value)
    .join("\n\n");

  return text.trim() || null;
}

export function mapNtsPrecedentDetail(
  actionData: Record<string, unknown>,
  precedentId: string,
  ntstDcmId: string,
): GetPrecedentResult {
  const dcmDVO = asObject(actionData.dcmDVO);
  const relatedProvisions = toArray(actionData.dcmRltnStttList).map((row) => asObject(row));

  const title = stripHtml(pickString(dcmDVO, ["ntstDcmTtl"]));
  const gist = stripHtml(pickString(dcmDVO, ["ntstDcmGistCntn"]));
  const rawContent = stripHtml(pickString(dcmDVO, ["ntstDcmCntn"]));
  const caseNo = pickString(dcmDVO, ["dsbdHpnnNo"]);
  const court = caseNo ? (caseNo.split("-")[0]?.trim() || null) : null;

  const referenceArticles = relatedProvisions
    .map((row) => pickString(row, ["ntstTextNm"]))
    .filter((value): value is string => !!value);

  const contentIsPlaceholder = isNtsPlaceholderContent(rawContent);
  const webLink = `https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=${ntstDcmId}`;
  const fullText = extractNtsFullTextFromHwpEditorList(actionData);

  const warnings = [
    "NTS(국세법령정보시스템) 소스 판례 — law.go.kr lawService 단건조회 미지원으로 국세청 문서 API로 폴백함. "
      + "판시사항·정확한 선고일자는 NTS 응답에 없어 공란임(사건명·판결요지·참조조문만 매핑).",
  ];

  let content: string | null;
  if (fullText) {
    content = fullText;
    warnings.push("전문은 NTS 서버 변환 HTML(첨부 HWP 변환본)에서 추출함");
  } else if (contentIsPlaceholder) {
    content = gist;
    warnings.push(`판례 전문은 첨부파일(HWP)에 있어 이 도구로 도달 불가 — 판결요지로 대체함. 원문 확인: ${webLink}`);
  } else {
    content = rawContent;
  }

  return {
    precedent_id: precedentId,
    사건명: title,
    법원명: court,
    선고일자: null,
    판시사항: null,
    판결요지: gist,
    참조조문: referenceArticles.length > 0 ? referenceArticles.join("; ") : null,
    판례내용: content,
    warnings,
  };
}

/**
 * 다단어 자연어 쿼리가 0건일 때 쓰는 완화 재시도 1단: 공백 기준 마지막 토큰을 제거한다.
 * 토큰이 1개 이하면(더 완화할 수 없으면) null을 반환한다.
 */
export function relaxQuery(query: string): string | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;
  return tokens.slice(0, -1).join(" ");
}

/**
 * 용어 브리지 치환 쿼리가 그 자체로도 0건일 때 쓰는 다단 완화: relaxQuery를 반복 적용해
 * (토큰 1개가 남을 때까지) 재검색한다. 히트 시 브리지 치환과 완화 경위를 모두 담은 warning과
 * 함께 결과를 반환하고, 끝까지 0건이면 null을 반환한다(기존 동작 회귀 없음).
 */
export async function bridgeThenRelaxSearch<T>(
  originalQuery: string,
  bridged: TermBridgeMatch,
  fetchOnce: (query: string) => Promise<{ items: T[]; total: number }>,
): Promise<{ items: T[]; total: number; warning: string } | null> {
  let candidate = bridged.replaced;
  for (let relaxed = relaxQuery(candidate); relaxed; relaxed = relaxQuery(candidate)) {
    candidate = relaxed;
    const result = await fetchOnce(candidate);
    if (result.items.length > 0) {
      const label = bridged.direction === "old-to-new" ? "개정 후" : "개정 전";
      return {
        items: result.items,
        total: result.total,
        warning: `'${originalQuery}' 0건 → ${label} 용어 '${bridged.replaced}'로 치환 후 '${candidate}'로 완화 재검색`,
      };
    }
  }
  return null;
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

/**
 * precInfoP.do 를 리다이렉트 없이 호출해 302 Location 헤더로 NTS 문서 ID를 알아낸다.
 * NTS 소스가 아니거나(법제처 자체 상세) 리다이렉트가 없으면 null.
 */
async function resolveNtstDcmId(precedentId: string): Promise<string | null> {
  const response = await axios.get<unknown>(NTS_PREC_REDIRECT_URL, {
    params: { precSeq: precedentId, mode: 0 },
    timeout: 15_000,
    maxRedirects: 0,
    validateStatus: () => true,
    headers: { "User-Agent": NTS_BROWSER_USER_AGENT },
  });

  if (response.status < 300 || response.status >= 400) return null;
  return extractNtstDcmIdFromLocation(response.headers?.location as string | undefined);
}

/**
 * NTS taxlaw.nts.go.kr 문서 상세 AJAX(action.do, actionId=ASIQTB002PR01)를 호출한다.
 * 응답의 data.ASIQTB002PR01(dcmDVO 포함)을 그대로 반환하며, 문서가 없으면 null.
 */
async function fetchNtsActionData(ntstDcmId: string): Promise<Record<string, unknown> | null> {
  const response = await axios.post<unknown>(
    NTS_TAXLAW_ACTION_URL,
    new URLSearchParams({
      actionId: NTS_ACTION_ID,
      paramData: JSON.stringify({ dcmDVO: { ntstDcmId } }),
    }).toString(),
    {
      timeout: 15_000,
      validateStatus: () => true,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": NTS_BROWSER_USER_AGENT,
      },
    },
  );

  if (response.status >= 400) return null;
  const root = asObject(response.data);
  const data = asObject(root.data);
  const actionData = asObject(data[NTS_ACTION_ID]);
  if (Object.keys(asObject(actionData.dcmDVO)).length === 0) return null;
  return actionData;
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
  /**
   * lawSearch.do(target=law) 1회 호출 + 파싱. search=2 는 본문(전문) 검색 모드.
   */
  private async fetchLawSearchOnce(
    query: string,
    limit: number,
    display: number,
    searchMode?: 1 | 2,
  ): Promise<{ items: SearchLawResult["items"]; total: number }> {
    const root = await fetchLawApi(LAW_SEARCH_BASE_URL, {
      OC: LAW_API_OC,
      target: "law",
      type: "JSON",
      mobileYn: "Y",
      query,
      display,
      ...(searchMode ? { search: searchMode } : {}),
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
          _nameTokenMatches: countNameTokenMatches(lawName, query),
        };
      })
      .sort((left, right) => {
        if (left._sortRank !== right._sortRank) return left._sortRank - right._sortRank;
        // 본문검색 모드는 match_type 이 전부 contains 로 동률이라, 쿼리 의존 신호인 법령명 토큰
        // 겹침을 기존 타이브레이커 *위에* 얹는다. 겹침이 0으로 동률이면 아래 기존 순서(짧은 이름
        // 우선 — 시행령·시행규칙보다 본법을 앞에 두는 약한 사전확률)로 떨어진다.
        // upstream 순서는 관련도가 아니라 가나다순이므로 신호로 쓰지 않는다(2026-07-20 실측).
        if (searchMode === 2 && left._nameTokenMatches !== right._nameTokenMatches) {
          return right._nameTokenMatches - left._nameTokenMatches;
        }
        if (left._normalizedLawLength !== right._normalizedLawLength) {
          return left._normalizedLawLength - right._normalizedLawLength;
        }
        return left._sortIndex - right._sortIndex;
      })
      .slice(0, limit)
      .map(({ _sortRank, _sortIndex, _normalizedLawLength, _nameTokenMatches, ...item }) => item);

    const totalRaw = pickString(root, ["totalCnt", "total", "TotalCnt"]);
    const total = totalRaw ? Number(totalRaw) : items.length;

    return { items, total: Number.isFinite(total) ? total : items.length };
  }

  async searchLaw(query: string, options: { limit?: number } = {}): Promise<SearchLawResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const display = Math.max(limit * 3, 30);

    // 사다리(이름 → 본문 → 완화 → 브리지 → 브리지+완화)는 `searchWithLadder` 공통 구현이다.
    // 행정규칙과 같은 사다리를 쓰게 해 ib3 #6 식 비대칭이 재발하지 않게 한다(LB3 step-1).
    return searchWithLadder(query, (q, mode) => this.fetchLawSearchOnce(q, limit, display, mode), {
      primaryZeroWarning: "법령명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.",
      bodySearchWarning: BODY_SEARCH_RANK_WARNING,
      supportsBodySearch: true,
      relaxQuery,
      bridgeTerm,
      formatBridgeWarning,
      bridgeThenRelaxSearch,
    });
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

  private async fetchPrecedentSearchOnce(
    query: string,
    limit: number,
  ): Promise<{ items: SearchPrecedentsResult["items"]; total: number }> {
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

    return { items, total: Number.isFinite(total) ? total : items.length };
  }

  async searchPrecedents(query: string, options: { limit?: number } = {}): Promise<SearchPrecedentsResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);

    const primary = await this.fetchPrecedentSearchOnce(query, limit);
    if (primary.items.length > 0) {
      return { query, total: primary.total, items: primary.items, warnings: [] };
    }

    // 다단어 자연어 쿼리 0건 → 마지막 토큰을 제거해 한 번 완화 재시도.
    const relaxed = relaxQuery(query);
    if (relaxed) {
      const relaxedSearch = await this.fetchPrecedentSearchOnce(relaxed, limit);
      if (relaxedSearch.items.length > 0) {
        return {
          query,
          total: relaxedSearch.total,
          items: relaxedSearch.items,
          warnings: [`원 쿼리 0건 → '${relaxed}'로 재검색.`],
        };
      }
    }

    // 완화 재시도까지 전부 0건 + 쿼리에 개정 신·구 용어가 있으면 대응 용어로 1회 치환해
    // 마지막 재시도(판례 색인이 선고 당시 구용어에 묶여 신용어 검색이 0건인 경우 구제).
    const bridged = bridgeTerm(query);
    if (bridged) {
      const bridgeSearch = await this.fetchPrecedentSearchOnce(bridged.replaced, limit);
      if (bridgeSearch.items.length > 0) {
        return {
          query,
          total: bridgeSearch.total,
          items: bridgeSearch.items,
          warnings: [formatBridgeWarning(bridged, query)],
        };
      }

      // 브리지 치환 쿼리조차 0건이면(다단어 신용어 쿼리 등) 마지막 토큰부터 점진 완화해 재시도.
      const bridgeRelax = await bridgeThenRelaxSearch(query, bridged, (q) =>
        this.fetchPrecedentSearchOnce(q, limit),
      );
      if (bridgeRelax) {
        return {
          query,
          total: bridgeRelax.total,
          items: bridgeRelax.items,
          warnings: [bridgeRelax.warning],
        };
      }
    }

    return { query, total: 0, items: [], warnings: [] };
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
      // JSON 단건 미지원 (주로 NTS sourced 판례). NTS 문서 API로 폴백 시도.
      const webLink = `https://www.law.go.kr/LSW/precInfoP.do?precSeq=${precedentId}&mode=0`;
      try {
        const ntstDcmId = await resolveNtstDcmId(precedentId);
        if (ntstDcmId) {
          const actionData = await fetchNtsActionData(ntstDcmId);
          if (actionData) return mapNtsPrecedentDetail(actionData, precedentId, ntstDcmId);
        }
      } catch {
        // NTS 폴백 실패 시 아래 기본 안내로 대체 (도구 자체를 실패시키지 않음).
      }

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

  private async fetchAdminRuleSearchOnce(
    query: string,
    limit: number,
    searchMode?: 1 | 2,
  ): Promise<{ items: SearchAdminRulesResult["items"]; total: number }> {
    const root = await fetchLawApi(LAW_SEARCH_BASE_URL, {
      OC: LAW_API_OC,
      target: "admrul",
      type: "JSON",
      query,
      display: limit,
      ...(searchMode ? { search: searchMode } : {}),
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

    return { items, total: Number.isFinite(total) ? total : items.length };
  }

  async searchAdminRules(query: string, options: { limit?: number } = {}): Promise<SearchAdminRulesResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);

    // 사다리는 searchLaw 와 **같은 공통 구현**을 쓴다 — 복제본이 두 벌이라 한쪽만 2칸이던 것이
    // 2026-07-20 #6 결함이었다(LB3 step-1 에서 추출).
    return searchWithLadder(query, (q, mode) => this.fetchAdminRuleSearchOnce(q, limit, mode), {
      primaryZeroWarning: "행정규칙명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.",
      bodySearchWarning: BODY_SEARCH_RANK_WARNING,
      supportsBodySearch: true,
      relaxQuery,
      bridgeTerm,
      formatBridgeWarning,
      bridgeThenRelaxSearch,
    });
  }

  async getAdminRule(
    ruleId: string,
    options: { offset?: number; limit?: number } = {},
  ): Promise<GetAdminRuleResult | null> {
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
    const 전체조문내용 = toArray(serviceObj.조문내용)
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
    if (!행정규칙명 && 전체조문내용.length === 0) return null;

    // 법제처 API는 조문 단위 offset/limit 을 지원하지 않으므로, 클라이언트에서 조문내용
    // 배열을 잘라 반환한다(대형 문서가 MCP 도구 토큰 한도를 넘겨 자체 차단되는 것을 방지).
    const offset = Math.max(options.offset ?? 0, 0);
    const limit = options.limit;
    const 조문내용 = typeof limit === "number"
      ? 전체조문내용.slice(offset, offset + limit)
      : 전체조문내용.slice(offset);

    const warnings: string[] = [];
    const hasMore = offset + 조문내용.length < 전체조문내용.length;
    if (offset > 0 || hasMore) {
      warnings.push(
        `조문 ${offset + 1}~${offset + 조문내용.length}/${전체조문내용.length}건 반환.`
          + (hasMore ? ` 이어보려면 offset=${offset + 조문내용.length} 로 재조회.` : ""),
      );
    }

    return {
      rule_id: ruleId,
      행정규칙명,
      행정규칙종류: stripHtml(pickString(basicInfo, ["행정규칙종류"])),
      소관부처명: stripHtml(pickString(basicInfo, ["소관부처명"])),
      발령일자: pickString(basicInfo, ["발령일자"]),
      시행일자: pickString(basicInfo, ["시행일자"]),
      조문내용,
      total_article_count: 전체조문내용.length,
      offset,
      has_more: hasMore,
      warnings,
    };
  }
}
