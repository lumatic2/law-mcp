import axios from "axios";
import {
  assertLawApiKey,
  LAW_API_OC,
  LAW_SEARCH_BASE_URL,
  LAW_SERVICE_BASE_URL,
} from "../config.js";
import type { GetLawArticleResult, SearchLawResult } from "../types.js";
import type { LawProvider } from "./law-provider.js";

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
  }
  return null;
}

function throwIfAuthError(root: Record<string, unknown>): void {
  const result = pickString(root, ["result"]);
  const msg = pickString(root, ["msg"]);
  if (result && msg && /검증|실패|error/i.test(`${result} ${msg}`)) {
    throw new Error(`법제처 API 인증/호출 실패: ${result} / ${msg}`);
  }
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

    const { data } = await axios.get<unknown>(LAW_SEARCH_BASE_URL, {
      params: {
        OC: LAW_API_OC,
        target: "law",
        type: "JSON",
        mobileYn: "Y",
        query,
        display: limit,
      },
      timeout: 15_000,
    });

    const root = asObject(data);
    throwIfAuthError(root);

    const directLawRows = toArray(root.법령 ?? root.law ?? root.Law);
    const nestedLawRows = toArray(asObject(root.LawSearch ?? root.search).law);
    const lawRows = (directLawRows.length > 0 ? directLawRows : nestedLawRows).filter(
      (row) => typeof row === "object" && row !== null,
    );

    const items = lawRows.slice(0, limit).map((row, index) => {
      const obj = asObject(row);
      return {
        law_id: pickString(obj, ["법령ID", "법령일련번호", "ID", "id"]) ?? `unknown-${index + 1}`,
        law_name: pickString(obj, ["법령명한글", "법령명", "name"]) ?? "",
        effective_date: pickString(obj, ["시행일자", "effective_date", "시행일"]),
      };
    });

    const totalRaw = pickString(root, ["totalCnt", "total", "TotalCnt"]);
    const total = totalRaw ? Number(totalRaw) : items.length;

    return {
      query,
      total: Number.isFinite(total) ? total : items.length,
      items,
    };
  }

  async getLawArticle(lawId: string, articleNo: string): Promise<GetLawArticleResult | null> {
    assertLawApiKey();

    const { data } = await axios.get<unknown>(LAW_SERVICE_BASE_URL, {
      params: {
        OC: LAW_API_OC,
        target: "law",
        type: "JSON",
        ID: lawId,
      },
      timeout: 15_000,
    });

    const root = asObject(data);
    throwIfAuthError(root);

    const lawObj = asObject(root.법령 ?? root.law ?? root.Law ?? asObject(root.LawService).법령);
    const joContainer = asObject(lawObj.조문 ?? lawObj.jo ?? lawObj.article);
    const joList = toArray(joContainer.조문단위 ?? joContainer.unit ?? joContainer.items);

    const normalizedArticleNo = articleNo.replace(/\s+/g, "");
    for (const jo of joList) {
      const joObj = asObject(jo);
      const joNo = pickString(joObj, ["조문번호", "JO_NO", "article_no", "no"]);
      if (!joNo) continue;

      const joNoNormalized = joNo.replace(/\s+/g, "");
      if (joNoNormalized !== normalizedArticleNo) continue;

      const content = pickString(joObj, ["조문내용", "JO_CONTENT", "content"]) ?? "";
      if (!content) return null;

      return {
        law_id: lawId,
        article_no: articleNo,
        title: pickString(joObj, ["조문제목", "JO_TITLE", "title"]),
        content,
      };
    }

    return null;
  }
}
