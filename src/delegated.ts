/**
 * 위임조문 점프 (UD3 step-2).
 *
 * 법률 조문의 **"대통령령으로 정하는"** 이 실제로 어느 시행령 몇 조인지를 법제처가 이미 계산해
 * 준다(`lsDelegated`). 지금까지 우리 도구로는 이 점프를 못 했다 — 소비 LLM 은 "대통령령으로
 * 정하는 바에 따라"까지만 읽고 그 다음을 스스로 찾아야 했다.
 *
 * 실측 구조(2026-07-21, 소득세법 189건):
 *   lsDelegated.법령.위임조문정보[] → { 조정보: 이 법의 조문, 위임정보: 위임받은 하위 법령 조문 }
 *
 * ⚠ `위임법령조문정보` 는 **1건이면 배열이 아니라 객체**로 온다 — DRF 전반의 특성이고, 같은 함정이
 * `extractRows` 에서 `limit:1` 이면 0건이 되는 결함을 만들었다(UD3 step-1).
 */

export type DelegatedArticle = {
  /** 위임받은 법령 (예: 소득세법 시행령) */
  law: string;
  /** 위임 구분 (시행령·시행규칙) */
  kind: string | null;
  /** 사람이 읽는 조문 표기 (예: 제2조, 제2조의2) */
  article: string;
  /** 그 조문의 제목 (예: 주소와 거소의 판정) */
  title: string | null;
  /** 위임의 근거가 된 원문 구절 (예: 비거주자의 구분은 대통령령으로) */
  phrase: string | null;
};

/** 이 법령의 조문 표기(제1조의2 등) → 그 조문이 위임한 하위 법령 조문들 */
export type DelegationMap = Map<string, DelegatedArticle[]>;

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** 1건이면 객체로 오는 DRF 특성을 흡수한다. */
function toRows(value: unknown): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map(asObject).filter((row) => Object.keys(row).length > 0);
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** 조문번호 + 가지번호 → 제N조 / 제N조의M */
export function formatArticle(no: string | null, branch: string | null): string | null {
  const main = Number(no);
  if (!Number.isFinite(main) || main <= 0) return null;
  const sub = Number(branch ?? "0") || 0;
  return sub > 0 ? `제${main}조의${sub}` : `제${main}조`;
}

/**
 * 위임조문 응답을 "이 법의 조문 → 위임받은 조문들" 지도로 접는다.
 *
 * 같은 조문이 여러 하위 조문을 위임하는 경우가 흔하고(소득세법 제8조는 4건), 같은 하위 조문이
 * 여러 구절에서 반복 지목되기도 한다 — 중복은 제거하되 **순서는 upstream 그대로** 둔다.
 */
export function extractDelegations(root: unknown): DelegationMap {
  const container = asObject(asObject(root).lsDelegated);
  const entries = toRows(asObject(container.법령).위임조문정보);
  const map: DelegationMap = new Map();

  for (const entry of entries) {
    const own = asObject(entry.조정보);
    const ownArticle = formatArticle(pickString(own, "조문번호"), pickString(own, "조문가지번호"));
    if (!ownArticle) continue;

    const list = map.get(ownArticle) ?? [];
    // ⚠ `위임정보` 도 배열일 수 있다 — 한 조문이 시행령과 시행규칙에 **동시에** 위임하면 그렇다.
    // 객체로만 읽으면 그런 조문이 통째로 사라진다(실측: 소득세법 189건 중 23건이 이 형태였고,
    // 제70조 종합소득과세표준 확정신고가 그중 하나였다).
    for (const info of toRows(entry.위임정보)) {
      const law = pickString(info, "위임법령제목");
      if (!law) continue;
      const kind = pickString(info, "위임구분");

      for (const target of toRows(info.위임법령조문정보)) {
        const article = formatArticle(
          pickString(target, "위임법령조문번호"),
          pickString(target, "위임법령조문가지번호"),
        );
        if (!article) continue;

        // 같은 법·같은 조문이 여러 구절에서 지목되면 한 번만 싣는다.
        if (list.some((existing) => existing.law === law && existing.article === article)) continue;
        list.push({
          law,
          kind,
          article,
          title: pickString(target, "위임법령조문제목"),
          phrase: pickString(target, "라인텍스트"),
        });
      }
    }
    if (list.length > 0) map.set(ownArticle, list);
  }

  return map;
}

export type DelegationFetcher = (lawId: string) => Promise<unknown>;

export class DelegationCache {
  private readonly entries = new Map<string, DelegationMap>();

  constructor(private readonly maxSize = 30) {}

  get(key: string): DelegationMap | undefined {
    const value = this.entries.get(key);
    if (!value) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: DelegationMap): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * 한 조문이 위임한 하위 법령 조문을 찾는다.
 *
 * **모든 실패를 빈 배열로 흡수한다** — 이건 기존 응답에 얹는 보조 정보라, 이것 때문에
 * `get_law_article` 이 죽으면 안 된다. 위임이 없는 조문에서는 필드를 아예 달지 않도록
 * 빈 배열을 돌려준다(빈 값 오염 금지).
 */
export async function lookupDelegations(
  lawId: string,
  article: string,
  fetcher: DelegationFetcher,
  cache?: DelegationCache,
): Promise<DelegatedArticle[]> {
  if (!lawId || !article) return [];

  let map = cache?.get(lawId);
  if (!map) {
    try {
      map = extractDelegations(await fetcher(lawId));
    } catch {
      map = new Map();
    }
    cache?.set(lawId, map);
  }
  return map.get(article) ?? [];
}
