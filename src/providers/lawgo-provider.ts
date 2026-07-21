import axios from "axios";
import {
  assertLawApiKey,
  LAW_API_OC,
  LAW_SEARCH_BASE_URL,
  LAW_SERVICE_BASE_URL,
} from "../config.js";
import {
  AiSearchCache,
  lookupAiSearch,
  type AiMergeConfig,
  type AiSearchFetcher,
  type AiSearchResult,
} from "../ai-search.js";
import { DelegationCache, lookupDelegations, type DelegationFetcher } from "../delegated.js";
import { missingParentNames, parentLawName } from "../parent-law.js";
import { createMcpError } from "../mcp-error.js";
import { bridgeTerm, formatBridgeWarning, type TermBridgeMatch } from "../term-bridge.js";
import type {
  GetAdminRuleResult,
  GetLawArticleResult,
  GetPrecedentResult,
  SearchAdminRulesResult,
  SearchLawResult,
  SearchLegalSourceResult,
  SearchPrecedentsResult,
} from "../types.js";
import type { LawProvider } from "./law-provider.js";
import { tokenizeQuery } from "../article-match.js";
import {
  TermLinkageCache,
  lookupTermLinkage,
  type LinkageFetcher,
  type TermLinkage,
} from "../term-linkage.js";
import {
  SOURCE_DESCRIPTORS,
  extractDetail,
  extractRows,
  mapRow,
  searchWithLadder,
  type SourceDescriptor,
  type SourceDetail,
  type SourceItem,
} from "./source-adapter.js";

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

/** 용어 연계 부스트 파라미터 — A/B 실측용으로 열어 둔다(기본값은 dev 측정으로 확정). */
export type TermBoostConfig = {
  enabled?: boolean;
  /** 상위로 올릴 연계 법령 수 */
  maxLaws?: number;
  /** 이 연계 조문 수 미만인 법령은 무시 */
  minLinks?: number;
  /** 연계를 시도할 쿼리 토큰 수(비용: 토큰당 최대 2 호출) */
  maxTerms?: number;
};

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

/**
 * 용어 연계를 시도할 토큰 — 긴 토큰일수록 쟁점어일 확률이 높다
 * ("부당해고 구제신청 기간" → 부당해고).
 *
 * 부스트 본체와 **프리페치가 같은 토큰을 봐야** 프리페치가 캐시로 이어진다. 두 곳에 복제하면
 * 한쪽만 바뀌었을 때 프리페치가 조용히 헛돈다.
 */
function linkageTokens(query: string, maxTerms: number): string[] {
  return tokenizeQuery(query)
    .sort((left, right) => right.length - left.length)
    .slice(0, Math.max(1, maxTerms));
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
/**
 * 이름으로 부른 법령을 검색 결과에서 고른다 — 정확일치 > prefix > 첫 항목.
 * `items[0]` 을 그냥 쓰면 순위 신호(부스트·본문검색)가 이름 조회를 오염시킨다(UD0).
 *
 * 마지막 폴백(첫 항목)은 느슨한 조회(`공정거래법` → `독점규제 및 공정거래에 관한 법률`)를
 * 살리려고 남겨 둔 것인데, **부분문자열 우연**으로 엉뚱한 법을 집기도 한다
 * (실측: `민법 시행령` → **난민법 시행령**). 그런 법은 실재하지 않아 사용자는 자기가 다른
 * 법의 조문을 읽고 있다는 걸 알 방법이 없다.
 *
 * ★ 사고와 정당한 느슨함을 가르는 선 (F20, 2026-07-21 실측):
 *   - 사고: 반환된 이름이 **요청을 부분문자열로 품되 앞에서 시작하지 않는다**
 *     (`난민법 시행령` ⊃ `민법 시행령`, `기상법 시행령` ⊃ `상법 시행령`).
 *     요청한 이름의 법이 따로 없다는 뜻이므로 `accidental` 로 표시해 **거절**한다.
 *   - 정당: 약칭·별칭은 요청을 부분문자열로 품지 않는다
 *     (`독점규제 및 공정거래에 관한 법률` 은 `공정거래법` 을 포함하지 않는다). 그대로 살린다.
 *   - `부가가치세` → `부가가치세법` 은 upstream 이 `prefix` 로 표시해 애초에 여기 안 온다.
 *     다만 그 표시를 못 믿는 경우를 위해 `startsWith` 후보를 먼저 뒤진다.
 */
export function pickLawByName(
  items: Array<{ law_id: string; law_name?: string; match_type?: string }>,
  requestedName?: string,
): { lawId: string; resolvedName: string | null; loose: boolean; accidental: boolean } {
  const exact = items.find((item) => item.match_type === "exact");
  const prefix = items.find((item) => item.match_type === "prefix");
  if (exact ?? prefix) {
    const hit = (exact ?? prefix)!;
    return { lawId: hit.law_id, resolvedName: hit.law_name ?? null, loose: false, accidental: false };
  }

  const request = requestedName ? normalizeLawName(requestedName) : null;

  // upstream 이 prefix 를 표시하지 않았어도 이름이 요청으로 시작하면 그건 느슨한 사고가 아니다.
  const startsWith = request
    ? items.find((item) => item.law_name && normalizeLawName(item.law_name).startsWith(request))
    : undefined;
  const picked = startsWith ?? items[0];
  const pickedName = picked.law_name ?? null;

  const accidental = Boolean(
    request
      && !startsWith
      && pickedName
      && normalizeLawName(pickedName).includes(request),
  );

  return { lawId: picked.law_id, resolvedName: pickedName, loose: true, accidental };
}

/** @deprecated `pickLawByName` 을 쓴다 — 해석된 이름까지 필요하다. */
export function pickLawIdByName(items: Array<{ law_id: string; match_type?: string }>): string {
  return pickLawByName(items).lawId;
}

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
  private readonly linkageCache = new TermLinkageCache(200);

  /** 용어 연계 조회 경로. 테스트에서 fixture 를 주입할 수 있게 생성자로 받는다. */
  private readonly linkageFetcher: LinkageFetcher;

  private readonly delegationCache = new DelegationCache();
  private readonly delegationFetcher: DelegationFetcher;

  /** 본법명 → 정확일치 법령(없으면 null). miss 도 캐시해 upstream 을 반복해서 때리지 않는다. */
  private readonly parentLawCache = new Map<string, SearchLawResult["items"][number] | null>();

  private readonly aiSearchCache = new AiSearchCache(100);
  private readonly aiSearchFetcher: AiSearchFetcher | undefined;

  constructor(
    linkageFetcher?: LinkageFetcher,
    delegationFetcher?: DelegationFetcher,
    aiSearchFetcher?: AiSearchFetcher,
  ) {
    this.aiSearchFetcher = aiSearchFetcher;
    this.delegationFetcher = delegationFetcher ?? ((lawId: string) =>
      fetchLawApi(LAW_SERVICE_BASE_URL, {
        OC: LAW_API_OC, target: "lsDelegated", type: "JSON", ID: lawId,
      }));
    this.linkageFetcher = linkageFetcher ?? {
      searchTerm: async (term: string) =>
        fetchLawApi(LAW_SEARCH_BASE_URL, {
          OC: LAW_API_OC, target: "lstrmAI", type: "JSON", query: term, display: 5,
        }),
      fetchLinkedArticles: async (mst: string) =>
        fetchLawApi(LAW_SERVICE_BASE_URL, {
          OC: LAW_API_OC, target: "lstrmRltJo", type: "JSON", MST: mst,
        }),
    };
  }

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

  async searchLaw(
    query: string,
    options: {
      limit?: number;
      termBoost?: TermBoostConfig;
      aiSearch?: AiMergeConfig;
      parentLaw?: { enabled?: boolean };
    } = {},
  ): Promise<SearchLawResult> {
    assertLawApiKey();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const display = Math.max(limit * 3, 30);

    // ★ `aiSearch` 를 **사다리와 동시에** 띄운다. 두 채널은 서로의 결과를 안 쓰므로 순차로
    //   돌릴 이유가 없다 — 순차였을 때 검색 1회가 중앙 4.1초였고 동시로 바꿔 사다리와
    //   같은 수준으로 내려왔다(UD2 step-4 실측). `lookupAiSearch` 는 모든 실패를 빈 결과로
    //   흡수하므로 이 promise 는 reject 하지 않는다(미처리 거부 없음).
    const aiPending = (options.aiSearch?.enabled ?? true)
      ? lookupAiSearch(query, this.aiSearchFetcher, this.aiSearchCache)
      : null;

    // 용어 연계도 같은 이유로 **사다리와 동시에** 띄운다 — 사다리 결과에 의존하지 않는데
    // 뒤에 붙어 있어서 지연 꼬리를 만들고 있었다(F19). 결과를 바꾸지 않고 캐시만 미리 채우므로
    // **품질 중립**이다(부스트 본체는 캐시에서 같은 값을 읽는다).
    const linkagePending = (options.termBoost?.enabled ?? true)
      ? this.prefetchLinkage(query, options.termBoost?.maxTerms ?? 1)
      : null;

    // 사다리(이름 → 본문 → 완화 → 브리지 → 브리지+완화)는 `searchWithLadder` 공통 구현이다.
    // 행정규칙과 같은 사다리를 쓰게 해 ib3 #6 식 비대칭이 재발하지 않게 한다(LB3 step-1).
    const base = await searchWithLadder(query, (q, mode) => this.fetchLawSearchOnce(q, limit, display, mode), {
      primaryZeroWarning: "법령명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.",
      bodySearchWarning: BODY_SEARCH_RANK_WARNING,
      supportsBodySearch: true,
      relaxQuery,
      bridgeTerm,
      formatBridgeWarning,
      bridgeThenRelaxSearch,
    });

    // 이 시점엔 사다리와 겹쳐 이미 끝나 있다 — 여기서 기다리는 시간은 max(사다리, 연계) 이지
    // 사다리 + 연계 가 아니다.
    if (linkagePending) await linkagePending;
    const boosted = await this.boostWithTermLinkage(query, base, limit, options.termBoost);
    // 부스트가 앞으로 끌어올린 건수 — `boost` 우선 배치에서 그 자리를 지켜 주기 위해 센다.
    // (부스트가 아무것도 안 했으면 `base` 와 **같은 객체**를 돌려주는 규약을 이용한다.)
    const boostPromoted = boosted === base ? 0 : boosted.items.filter((item) => item.linked_articles).length;
    const merged = await this.mergeAiSearch(aiPending, boosted, limit, boostPromoted, options.aiSearch);
    return this.promoteParentLaws(merged, limit, options.parentLaw?.enabled ?? true);
  }

  /**
   * 본법 승격 (UD4 step-1).
   *
   * 하위법령만 찾고 근거 본법을 안 주는 결함을 메운다. 복원한 본법명이 **실재하는지 조회로
   * 확인한 뒤에만** 편입한다 — 이름 규칙만 믿으면 없는 법을 그럴듯하게 반환하게 된다.
   *
   * 비용: 검색 1회당 추가 호출 **≤1**(본법 후보 1개만, 캐시). 실패는 전부 무시하고 `base` 를
   * 그대로 돌려준다 — 보조 보정이라 이것 때문에 검색이 죽으면 안 된다.
   */
  private async promoteParentLaws(
    base: SearchLawResult,
    limit: number,
    enabled: boolean,
  ): Promise<SearchLawResult> {
    if (!enabled) return base;

    const missing = missingParentNames(base.items.map((item) => item.law_name));
    if (missing.length === 0) return base;

    // 이 단계 전체를 흡수한다 — 조회 실패만이 아니라 어떤 예외든 검색을 죽이면 안 된다.
    // (실패 흡수를 조회 함수 안에만 뒀더니 승격 단계가 던지면 검색이 죽었다 — 테스트가 적발.)
    let parent: SearchLawResult["items"][number] | null = null;
    try {
      parent = await this.lookupExactLaw(missing[0]);
    } catch {
      return base;
    }
    if (!parent) return base;

    // ★ 끼워 넣지 않고 **그 하위법령 자리를 본법이 차지**한다.
    //
    // 처음엔 맨 앞에 끼워 넣었는데, 목록이 limit 에서 잘리는 바람에 하위 순위의 **정답을
    // 밀어냈다**(실측: `사용자책임 면책 사유` 의 민법이 3위 → 탈락). 자리를 바꾸면 목록 길이가
    // 그대로라 아무도 안 밀린다. 하위법령은 본법에서 다시 찾아갈 수 있지만, 밀려난 정답은
    // 소비 LLM 에게 아예 없는 것이 된다.
    const target = base.items.findIndex((item) => parentLawName(item.law_name) === parent!.law_name);
    if (target < 0) return base;

    const items = [...base.items];
    const replaced = items[target];
    items[target] = parent;

    return {
      query: base.query,
      total: base.total,
      items,
      warnings: [
        ...(base.warnings ?? []),
        `'${replaced.law_name}' 자리에 근거 본법 '${parent.law_name}' 을(를) 놓음`
          + " — 실제 조회로 존재를 확인한 법령이며, 하위법령은 본법에서 이어서 찾을 수 있음.",
      ],
    };
  }

  /** 법령명 정확일치 1건 조회. 없으면 null. miss 도 캐시한다. */
  private async lookupExactLaw(lawName: string): Promise<SearchLawResult["items"][number] | null> {
    const cached = this.parentLawCache.get(lawName);
    if (cached !== undefined) return cached;

    let found: SearchLawResult["items"][number] | null = null;
    try {
      const result = await this.fetchLawSearchOnce(lawName, 5, 15);
      found = result.items.find((item) => item.match_type === "exact") ?? null;
    } catch {
      found = null;
    }
    this.parentLawCache.set(lawName, found);
    return found;
  }

  /**
   * `aiSearch` 후보 병합 (UD2 step-2).
   *
   * 법제처는 자연어 질의를 **조문 단위로** 답하는 검색을 이미 갖고 있다. 우리가 다섯 milestone
   * 동안 만든 사다리보다 이 신호가 강할 수 있어, **대체가 아니라 앞단 채널로** 얹는다.
   * `aiSearch` 도 틀리는 유형이 있어서(정당방위 → 정당법) 기존 사다리 결과는 뒤에 보존한다.
   *
   * 부스트와 같은 원칙 — **신호가 있을 때만 움직인다**: 결과가 비거나 조회가 실패하면 `base` 를
   * 그대로(같은 객체) 돌려준다. `lookupAiSearch` 가 모든 실패를 빈 결과로 흡수하므로 이 경로는
   * upstream 장애 시 자동으로 LB5 동작으로 degrade 한다.
   */
  private async mergeAiSearch(
    pending: Promise<AiSearchResult> | null,
    base: SearchLawResult,
    limit: number,
    boostPromoted: number,
    config: AiMergeConfig = {},
  ): Promise<SearchLawResult> {
    const { maxLaws = 2, priority = "ai" } = config;
    if (!pending) return base;

    const found = await pending;
    if (found.laws.length === 0) return base;

    const normalized = (value: string) => normalizeLawName(value);
    const promoted: SearchLawResult["items"] = [];
    for (const law of found.laws.slice(0, maxLaws)) {
      const existing = base.items.find((item) => normalized(item.law_name) === normalized(law.lawName));
      // 법령ID 가 없고 기존 결과에도 없으면 싣지 않는다 — ID 없는 항목은 하류 도구가 못 쓴다.
      if (!existing && !law.lawId) continue;
      promoted.push({
        ...(existing ?? {
          law_id: law.lawId as string,
          law_name: law.lawName,
          match_type: "contains" as const,
        }),
        // upstream 이 이미 조문 단위로 답했다 — 그 조문을 그대로 실어 보낸다(추가 호출 0).
        // 이게 없으면 소비 LLM 이 "어느 법인지"까지만 받고 조문은 다시 추론해야 한다(F4).
        ai_articles: law.articles.slice(0, 5).map((article) => ({
          article: article.display,
          title: article.title,
        })),
      });
    }
    if (promoted.length === 0) return base;

    const promotedNames = new Set(promoted.map((item) => normalized(item.law_name)));
    const head = priority === "boost"
      ? base.items.slice(0, boostPromoted).filter((item) => !promotedNames.has(normalized(item.law_name)))
      : [];
    const headNames = new Set(head.map((item) => normalized(item.law_name)));
    const tail = base.items.filter(
      (item) => !promotedNames.has(normalized(item.law_name)) && !headNames.has(normalized(item.law_name)),
    );

    return {
      query: base.query,
      total: base.total,
      items: [...head, ...promoted, ...tail].slice(0, limit),
      warnings: [
        ...(base.warnings ?? []),
        `법제처 지능형 검색(aiSearch)이 ${promoted.map((item) => item.law_name).join(", ")}`
          + " 을(를) 상위로 올림 — upstream 이 매긴 관련도 순위이며, 우리 순위가 아님.",
      ],
    };
  }

  /** 용어 연계 캐시를 미리 채운다. 실패는 전부 무시한다 — 부스트 본체가 다시 시도한다. */
  private async prefetchLinkage(query: string, maxTerms: number): Promise<void> {
    for (const token of linkageTokens(query, maxTerms)) {
      try {
        const found = await lookupTermLinkage(token, this.linkageFetcher, this.linkageCache);
        if (found.laws.length > 0) return;
      } catch {
        return;
      }
    }
  }

  /**
   * 용어 연계 후보 부스트 (LB5 step-2).
   *
   * 본문검색은 관련도순이 아니라 가나다순이라(#7), 이름에 안 걸리는 쿼리는 사실상 무작위 목록을
   * 받는다. 용어 연계는 **그 용어가 실제로 쓰인 조문의 법령**을 주므로 그 목록보다 강한 신호다.
   *
   * 원칙 — **신호가 있을 때만 움직인다**: 연계가 비면 `base` 를 **그대로**(같은 객체) 돌려준다.
   * ib3 에서 신호 없이 재정렬했다가 법인세법이 1위→5위로 밀린 실패의 교훈.
   */
  private async boostWithTermLinkage(
    query: string,
    base: SearchLawResult,
    limit: number,
    config: TermBoostConfig = {},
  ): Promise<SearchLawResult> {
    const { enabled = true, maxLaws = 2, minLinks = 1, maxTerms = 1 } = config;
    if (!enabled) return base;

    const tokens = linkageTokens(query, maxTerms);
    if (tokens.length === 0) return base;

    let linkage: TermLinkage | null = null;
    for (const token of tokens) {
      const found = await lookupTermLinkage(token, this.linkageFetcher, this.linkageCache);
      if (found.laws.length > 0) { linkage = found; break; }
    }
    if (!linkage) return base;

    const candidates = linkage.laws
      .filter((law) => law.lawId !== null && law.linkCount >= minLinks)
      .slice(0, maxLaws);
    if (candidates.length === 0) return base;

    // 이미 결과에 있는 법령은 중복 추가하지 않고 **앞으로 끌어올린다**.
    const normalized = (value: string) => normalizeLawName(value);
    const promotedNames = new Set(candidates.map((law) => normalized(law.lawName)));

    const promoted: SearchLawResult["items"] = [];
    for (const law of candidates) {
      const existing = base.items.find((item) => normalized(item.law_name) === normalized(law.lawName));
      // 연계가 지목한 조문을 그대로 실어 보낸다 — 소비 LLM 이 "어느 법 몇 조"까지 한 번에 받는다.
      // 이 정보는 이미 손에 있고(추가 호출 0), 없으면 조문 도달은 여전히 별도 추론이 된다.
      const linkedArticles = law.articles.slice(0, 5).map((article) => article.display);
      promoted.push({
        ...(existing ?? {
          law_id: law.lawId as string,
          law_name: law.lawName,
          match_type: "contains" as const,
        }),
        linked_articles: linkedArticles,
      });
    }

    const rest = base.items.filter((item) => !promotedNames.has(normalized(item.law_name)));
    const items = [...promoted, ...rest].slice(0, limit);

    return {
      query: base.query,
      total: base.total,
      items,
      warnings: [
        ...(base.warnings ?? []),
        `'${linkage.term}' 법령용어 연계로 ${candidates.map((law) => `${law.lawName}(${law.linkCount}조문)`).join(", ")}`
          + " 을(를) 상위로 올림 — 용어가 실제로 쓰인 조문 기준이며, 쟁점의 의미와 다를 수 있음.",
      ],
    };
  }

  /**
   * Resolve a law identifier to a numeric ID.
   * If the input is already numeric, return as-is.
   * Otherwise, search by name and return the best match's law_id.
   */
  /**
   * 법령명 → 법령ID 해석.
   *
   * 이 경로는 **이름 조회**이지 주제 검색이 아니다. 그래서 두 가지를 지킨다:
   *   ① 용어 연계 부스트를 끈다 — 부스트는 쟁점형 질의("부당해고 구제신청 기간")용이고,
   *      법령명을 그대로 물을 때는 정확일치를 1위에서 밀어낸다.
   *   ② 정확일치 → prefix 순으로 고른다. items[0] 을 그냥 쓰지 않는다.
   *
   * 이 두 줄이 없으면 `get_law_article("민법","제245조")` 가 새마을금고법 조문을 HTTP 200 으로
   * 조용히 반환한다(UD0 에서 실측 재현). LB3 `ordin` 사고와 같은 부류 — **틀린 답이 성공처럼 온다.**
   */
  private async resolveLawId(lawId: string): Promise<string> {
    if (/^\d+$/.test(lawId)) return lawId;

    // ③ `aiSearch` 병합도 끈다 — 주제 검색용 채널이라 법령명 정확일치를 밀어낼 수 있다.
    //    지금은 기본값이 off 라 없어도 같지만, step-4 에서 기본을 켜는 순간 UD0 회귀가 재발한다.
    const result = await this.searchLaw(lawId, {
      limit: 10,
      termBoost: { enabled: false },
      aiSearch: { enabled: false },
      // ④ 본법 승격도 끈다 — `민법 시행령` 을 물었을 때 `민법` 이 1위로 올라오면
      //    그 법의 조문을 반환하게 된다. UD0 와 같은 부류의 조용한 오답이다.
      parentLaw: { enabled: false },
    });
    if (result.items.length === 0) {
      throw createMcpError({
        code: "LAW_NOT_FOUND",
        message: `법령 "${lawId}"을(를) 찾을 수 없습니다. 숫자 법령코드 또는 정확한 법령명을 사용해주세요.`,
        retryable: false,
      });
    }
    const picked = pickLawByName(result.items, lawId);

    // ⑤ 이름이 **우연히 겹쳤을 뿐**이면 조용히 다른 법을 주지 않고 못 찾았다고 말한다 (F20).
    //    `민법 시행령` 은 실재하지 않는데 `난민법 시행령` 이 그 문자열을 품는다 — 경고를 달아도
    //    소비 LLM 은 조문 본문을 그대로 인용한다. 틀린 답보다 없는 답이 낫다.
    if (picked.accidental) {
      throw createMcpError({
        code: "LAW_NOT_FOUND",
        message:
          `법령 "${lawId}"을(를) 찾을 수 없습니다. `
          + `("${picked.resolvedName}" 은(는) 이름이 우연히 겹칠 뿐 다른 법입니다.) `
          + `숫자 법령코드 또는 정확한 법령명을 사용해주세요.`,
        retryable: false,
      });
    }

    // 느슨하게 집혔으면 호출자가 경고를 달 수 있게 기록해 둔다.
    this.looseResolution = picked.loose ? { requested: lawId, resolved: picked.resolvedName } : null;
    return picked.lawId;
  }

  /** 직전 이름 해석이 정확일치·prefix 가 아니었을 때의 기록 (경고 부착용). */
  private looseResolution: { requested: string; resolved: string | null } | null = null;

  async getLawArticle(lawId: string, articleNo: string): Promise<GetLawArticleResult | null> {
    assertLawApiKey();

    // Auto-resolve law name to numeric ID if needed
    this.looseResolution = null;
    const resolvedLawId = await this.resolveLawId(lawId);

    const requestedArticle = parseArticleReference(articleNo);
    const normalizedArticleNo = normalizeArticleInput(articleNo);
    const joParam = requestedArticle?.joParam ?? normalizedArticleNo;

    try {
      const root = await fetchLawArticleRoot(resolvedLawId, "ID", joParam);
      const exactById = findArticleInRoot(root, requestedArticle, normalizedArticleNo, lawId, articleNo);
      if (exactById) return this.attachDelegations(exactById, resolvedLawId, requestedArticle);
    } catch (error) {
      if (shouldStopLawFetchFallback(error)) throw error;
    }

    const fallbackRoot = await fetchLawArticleRoot(resolvedLawId, "MST", joParam);
    const found = findArticleInRoot(fallbackRoot, requestedArticle, normalizedArticleNo, lawId, articleNo);
    return found ? this.attachDelegations(found, resolvedLawId, requestedArticle) : null;
  }

  /**
   * 조문 응답에 **그 조문이 위임한 하위 법령 조문**을 덧붙인다 (UD3 step-2).
   *
   * "대통령령으로 정하는 바에 따라"가 실제로 어느 시행령 몇 조인지를 upstream 이 이미 계산해
   * 뒀는데(`lsDelegated`), 지금까지 우리 도구는 그 점프를 못 했다.
   *
   * 보조 정보이므로 **실패는 조용히 흡수**하고(`lookupDelegations` 가 빈 배열을 돌려준다),
   * 위임이 없으면 **필드를 아예 달지 않는다**(빈 배열 오염 금지).
   */
  private async attachDelegations(
    result: GetLawArticleResult,
    resolvedLawId: string,
    requestedArticle: ArticleReference | null,
  ): Promise<GetLawArticleResult> {
    const article = requestedArticle
      ? (requestedArticle.branch > 0
        ? `제${requestedArticle.main}조의${requestedArticle.branch}`
        : `제${requestedArticle.main}조`)
      : null;
    const withWarning = this.attachLooseResolutionWarning(result);
    if (!article) return withWarning;

    const delegated = await lookupDelegations(
      resolvedLawId,
      article,
      this.delegationFetcher,
      this.delegationCache,
    );
    return delegated.length > 0 ? { ...withWarning, delegated_to: delegated } : withWarning;
  }

  /**
   * 이름이 느슨하게 해석됐으면 그 사실을 응답에 남긴다.
   *
   * 없는 법령명을 물었을 때 부분문자열이 겹치는 다른 법의 조문이 조용히 오는 것을 막지는
   * 못한다(그 폴백은 `부가가치세` → `부가가치세법` 같은 조회를 살린다). 대신 **조용하지 않게**
   * 만든다 — 소비 LLM 이 자기가 무엇을 읽고 있는지 알아야 한다.
   */
  private attachLooseResolutionWarning(result: GetLawArticleResult): GetLawArticleResult {
    const loose = this.looseResolution;
    if (!loose || !loose.resolved) return result;
    return {
      ...result,
      warnings: [
        ...(result.warnings ?? []),
        `'${loose.requested}' 는 정확히 일치하는 법령이 없어 '${loose.resolved}' 로 해석함`
          + " — 의도한 법령이 맞는지 확인할 것.",
      ],
    };
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

  // --- 법원(法源) 5종 공통 경로 (LB3 step-2) ---------------------------------
  // 법원별로 메서드를 5벌 쓰지 않고 디스크립터로 파라미터화한다. 도구 등록은 step-3 의
  // 기여도 게이트를 통과한 법원만 한다(도구 인플레 방지).

  private async fetchSourceSearchOnce(
    descriptor: SourceDescriptor,
    query: string,
    limit: number,
    searchMode?: 1 | 2,
  ): Promise<{ items: SourceItem[]; total: number; warnings: string[] }> {
    const root = await fetchLawApi(LAW_SEARCH_BASE_URL, {
      OC: LAW_API_OC,
      target: descriptor.target,
      type: "JSON",
      query,
      display: limit,
      ...(searchMode ? { search: searchMode } : {}),
    });

    const extracted = extractRows(root, descriptor);
    const items = extracted.rows
      .slice(0, limit)
      .map((row, index) => mapRow(row, descriptor, index))
      .map((item) => {
        const title = item.title;
        return title === null ? item : { ...item, title: stripHtml(title) };
      });

    return { items, total: extracted.total, warnings: extracted.warnings };
  }

  /** 법원 검색 — 사다리는 법령·행정규칙과 동일한 공통 구현을 쓴다. */
  async searchLegalSource(
    target: string,
    query: string,
    options: { limit?: number } = {},
  ): Promise<SearchLegalSourceResult> {
    assertLawApiKey();
    const descriptor = SOURCE_DESCRIPTORS[target];
    if (!descriptor) {
      throw createMcpError({
        code: "INVALID_ARGUMENT",
        message: `Unknown legal source target: ${target}`,
        retryable: false,
      });
    }

    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    // 구조 경고(응답 키가 실측과 다름)는 사다리 어느 칸에서 나오든 결과에 실어 보낸다.
    const structureWarnings = new Set<string>();

    const result = await searchWithLadder(
      query,
      async (q, mode) => {
        const once = await this.fetchSourceSearchOnce(descriptor, q, limit, mode);
        once.warnings.forEach((warning) => structureWarnings.add(warning));
        return { items: once.items, total: once.total };
      },
      {
        primaryZeroWarning: `${descriptor.label}명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.`,
        bodySearchWarning: BODY_SEARCH_RANK_WARNING,
        supportsBodySearch: descriptor.supportsBodySearch,
        relaxQuery,
        bridgeTerm,
        formatBridgeWarning,
        bridgeThenRelaxSearch,
      },
    );

    return {
      source: descriptor.label,
      target: descriptor.target,
      query: result.query,
      total: result.total,
      items: result.items,
      warnings: [...result.warnings, ...structureWarnings],
    };
  }

  /** 법원 단건 조회 — 문서 지정 파라미터는 타깃마다 다르므로 디스크립터가 못 박는다. */
  async getLegalSource(target: string, sourceId: string): Promise<SourceDetail | null> {
    assertLawApiKey();
    const descriptor = SOURCE_DESCRIPTORS[target];
    if (!descriptor) {
      throw createMcpError({
        code: "INVALID_ARGUMENT",
        message: `Unknown legal source target: ${target}`,
        retryable: false,
      });
    }

    const root = await fetchLawApi(LAW_SERVICE_BASE_URL, {
      OC: LAW_API_OC,
      target: descriptor.target,
      type: "JSON",
      [descriptor.detail.idParam]: sourceId,
    });

    return extractDetail(root, descriptor, sourceId, (value) => stripHtml(value) ?? value);
  }
}
