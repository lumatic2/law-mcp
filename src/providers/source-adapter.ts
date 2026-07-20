/**
 * 법원(法源) 공통 어댑터 (LB3 step-1).
 *
 * 법제처 DRF 는 타깃마다 검색 응답의 **컨테이너 키와 행 배열 키가 제각각**이다 — 규칙이 없다.
 * 2026-07-21 실 API 프로브 결과:
 *
 * | target  | 실제 법원        | 컨테이너      | 행 배열 키 |
 * |---------|------------------|---------------|------------|
 * | expc    | 법령해석례       | `Expc`        | `expc`     |
 * | detc    | 헌재결정례       | `DetcSearch`  | `Detc`     |
 * | decc    | 행정심판재결례   | `Decc`        | `decc`     |
 * | ordin   | 자치법규         | `OrdinSearch` | `law`  ←!! |
 * | lstrm   | 법령용어         | `LsTrmSearch` | `lstrm`    |
 *
 * 타깃명↔법원 대응은 **응답 필드로 확정**했다(plan 의 주의사항). `detc` 가 헌재결정례,
 * `decc` 가 행정심판재결례로 이름의 직관과 어긋나는데, 각각 응답에 `헌재결정례일련번호`/
 * `행정심판재결례일련번호` 가 있어 확정된다. `ordin` 은 행 키가 `law` 라 타깃명으로 추측하면 0건이 된다.
 *
 * 그래서 키는 **실측값을 선언하되, 어긋나면 형태(객체 배열)로 찾는 폴백**을 둔다 — upstream 이
 * 키를 바꿔도 조용히 0건이 되지 않게 하기 위함이다.
 */

export type SourceFieldSpec = {
  /** 표준화된 출력 필드명 */
  as: string;
  /** 응답 행에서 찾을 후보 키(앞에서부터) */
  from: string[];
};

export type SourceDescriptor = {
  /** DRF target 파라미터 */
  target: string;
  /** 사람이 읽는 법원명 */
  label: string;
  /** 실측된 컨테이너 키 */
  container: string;
  /** 실측된 행 배열 키 */
  rowKey: string;
  /** 단건 조회용 ID 로 쓸 행 필드(앞에서부터) */
  idKeys: string[];
  /** 결과 제목으로 쓸 행 필드(앞에서부터) */
  titleKeys: string[];
  /** 그 외 노출할 필드 */
  fields: SourceFieldSpec[];
  /** 본문(전문) 검색(search=2) 지원 여부 — 미지원이면 사다리에서 mode 2 를 쓰지 않는다 */
  supportsBodySearch: boolean;
};

export const SOURCE_DESCRIPTORS: Record<string, SourceDescriptor> = {
  expc: {
    target: "expc",
    label: "법령해석례",
    container: "Expc",
    rowKey: "expc",
    idKeys: ["법령해석례일련번호"],
    titleKeys: ["안건명"],
    fields: [
      { as: "안건번호", from: ["안건번호"] },
      { as: "회신기관명", from: ["회신기관명"] },
      { as: "질의기관명", from: ["질의기관명"] },
      { as: "회신일자", from: ["회신일자"] },
    ],
    supportsBodySearch: true,
  },
  detc: {
    target: "detc",
    label: "헌재결정례",
    container: "DetcSearch",
    rowKey: "Detc",
    idKeys: ["헌재결정례일련번호"],
    titleKeys: ["사건명"],
    fields: [
      { as: "사건번호", from: ["사건번호"] },
      { as: "종국일자", from: ["종국일자"] },
    ],
    supportsBodySearch: true,
  },
  decc: {
    target: "decc",
    label: "행정심판재결례",
    container: "Decc",
    rowKey: "decc",
    idKeys: ["행정심판재결례일련번호"],
    titleKeys: ["사건명"],
    fields: [
      { as: "사건번호", from: ["사건번호"] },
      { as: "재결청", from: ["재결청"] },
      { as: "처분청", from: ["처분청"] },
      { as: "의결일자", from: ["의결일자"] },
      { as: "재결구분명", from: ["재결구분명"] },
    ],
    supportsBodySearch: true,
  },
  ordin: {
    target: "ordin",
    label: "자치법규",
    container: "OrdinSearch",
    // 행 키가 타깃명이 아니라 `law` 다 — 이름으로 추측하면 조용히 0건이 된다(실측).
    rowKey: "law",
    idKeys: ["자치법규일련번호", "자치법규ID"],
    titleKeys: ["자치법규명"],
    fields: [
      { as: "지자체기관명", from: ["지자체기관명"] },
      { as: "자치법규종류", from: ["자치법규종류"] },
      { as: "공포일자", from: ["공포일자"] },
      { as: "시행일자", from: ["시행일자"] },
      { as: "제개정구분명", from: ["제개정구분명"] },
    ],
    supportsBodySearch: true,
  },
  lstrm: {
    target: "lstrm",
    label: "법령용어",
    container: "LsTrmSearch",
    rowKey: "lstrm",
    idKeys: ["법령용어ID"],
    titleKeys: ["법령용어명"],
    fields: [{ as: "법령종류코드", from: ["법령종류코드"] }],
    supportsBodySearch: false,
  },
};

export type SourceItem = {
  source_id: string;
  title: string | null;
  [key: string]: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function isObjectArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value)
    && value.length > 0
    && value.every((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry))
  );
}

export type ExtractedRows = {
  rows: Record<string, unknown>[];
  total: number;
  /** 선언된 키가 아니라 형태 폴백으로 찾았을 때의 경고 */
  warnings: string[];
};

/**
 * 검색 응답에서 행 배열과 총건수를 뽑는다.
 *
 * 1) 선언된 컨테이너·행 키 → 2) 컨테이너 안의 "객체 배열인 값" → 3) 최상위의 임의 컨테이너 순으로
 * 내려가며 찾는다. 어떤 단계로도 못 찾으면 **예외 대신 0건 + 경고**다 — upstream 스키마 변경이
 * 도구 크래시가 되면 안 되고, 조용한 0건이 되어서도 안 된다.
 */
export function extractRows(root: unknown, descriptor: SourceDescriptor): ExtractedRows {
  const rootObj = asObject(root);
  const warnings: string[] = [];

  const containers: Array<[string, Record<string, unknown>]> = [];
  const declared = asObject(rootObj[descriptor.container]);
  if (Object.keys(declared).length > 0) {
    containers.push([descriptor.container, declared]);
  }
  for (const key of Object.keys(rootObj)) {
    if (key === descriptor.container) continue;
    const candidate = asObject(rootObj[key]);
    if (Object.keys(candidate).length > 0) containers.push([key, candidate]);
  }

  for (const [containerKey, container] of containers) {
    let rowKey: string | null = null;
    if (isObjectArray(container[descriptor.rowKey])) {
      rowKey = descriptor.rowKey;
    } else {
      rowKey = Object.keys(container).find((key) => isObjectArray(container[key])) ?? null;
    }
    if (!rowKey) continue;

    if (containerKey !== descriptor.container || rowKey !== descriptor.rowKey) {
      warnings.push(
        `${descriptor.label}(${descriptor.target}) 응답 구조가 실측값과 다르다 — `
        + `선언 ${descriptor.container}.${descriptor.rowKey} 대신 ${containerKey}.${rowKey} 로 읽었다.`,
      );
    }

    const rows = (container[rowKey] as Record<string, unknown>[]).filter(
      (row) => Object.keys(asObject(row)).length > 0,
    );
    const totalRaw = pickString(container, ["totalCnt", "TotalCnt"]);
    const total = totalRaw ? Number(totalRaw) : rows.length;
    return { rows, total: Number.isFinite(total) ? total : rows.length, warnings };
  }

  // 정상적인 0건(totalCnt=0)과 구조 미상을 구분한다.
  const zeroContainer = containers.find(([, container]) => pickString(container, ["totalCnt", "TotalCnt"]) !== null);
  if (!zeroContainer && containers.length > 0) {
    warnings.push(
      `${descriptor.label}(${descriptor.target}) 응답에서 결과 배열을 찾지 못했다 — 0건으로 처리한다.`,
    );
  }
  return { rows: [], total: 0, warnings };
}

/** 행 하나를 표준 항목으로 변환한다. */
export function mapRow(
  row: Record<string, unknown>,
  descriptor: SourceDescriptor,
  index: number,
): SourceItem {
  const item: SourceItem = {
    source_id: pickString(row, descriptor.idKeys) ?? `unknown-${index + 1}`,
    title: pickString(row, descriptor.titleKeys),
  };
  for (const field of descriptor.fields) {
    item[field.as] = pickString(row, field.from);
  }
  return item;
}

export type LadderResult<T> = { items: T[]; total: number };

/**
 * 검색 폴백 사다리 (이름 매칭 → 본문검색 → 완화 → 용어 브리지 → 브리지+완화).
 *
 * `searchLaw`/`searchAdminRules` 에 각각 복제돼 있던 사다리를 파라미터화한 것이다 — ib3 에서
 * 행정규칙만 사다리가 2칸이라 다단어 쿼리가 구제 없이 0건으로 끝난 비대칭 결함(#6)이 났었다.
 * 신규 법원도 같은 사다리를 타게 해 그 비대칭이 재발하지 않게 한다.
 *
 * `supportsBodySearch: false` 인 타깃은 mode 2 를 아예 쓰지 않고 같은 순서를 mode 1 로 탄다.
 */
export async function searchWithLadder<T, B extends { replaced: string }>(
  query: string,
  fetchOnce: (query: string, mode?: 1 | 2) => Promise<LadderResult<T>>,
  options: {
    /** 이름 매칭 0건 후 본문검색으로 넘어갈 때 붙일 경고 */
    primaryZeroWarning: string;
    /** 본문검색 결과에 항상 붙일 "관련도 정렬 아님" 경고 */
    bodySearchWarning: string;
    supportsBodySearch: boolean;
    relaxQuery: (query: string) => string | null;
    bridgeTerm: (query: string) => B | null;
    formatBridgeWarning: (bridged: B, query: string) => string;
    bridgeThenRelaxSearch: (
      query: string,
      bridged: B,
      fetchOnce: (query: string) => Promise<LadderResult<T>>,
    ) => Promise<(LadderResult<T> & { warning: string }) | null>;
  },
): Promise<{ query: string; total: number; items: T[]; warnings: string[] }> {
  const fallbackMode: 1 | 2 | undefined = options.supportsBodySearch ? 2 : undefined;
  // 본문검색 미지원 타깃에서는 "관련도 정렬 아님" 경고가 해당 없다.
  const bodyWarnings = options.supportsBodySearch ? [options.bodySearchWarning] : [];

  const primary = await fetchOnce(query);
  if (primary.items.length > 0) {
    return { query, total: primary.total, items: primary.items, warnings: [] };
  }

  if (options.supportsBodySearch) {
    const bodySearch = await fetchOnce(query, 2);
    if (bodySearch.items.length > 0) {
      return {
        query,
        total: bodySearch.total,
        items: bodySearch.items,
        warnings: [options.primaryZeroWarning, ...bodyWarnings],
      };
    }
  }

  const relaxed = options.relaxQuery(query);
  if (relaxed) {
    const relaxedSearch = await fetchOnce(relaxed, fallbackMode);
    if (relaxedSearch.items.length > 0) {
      return {
        query,
        total: relaxedSearch.total,
        items: relaxedSearch.items,
        warnings: [`원 쿼리 0건 → '${relaxed}'로 재검색(본문 검색).`, ...bodyWarnings],
      };
    }
  }

  const bridged = options.bridgeTerm(query);
  if (bridged) {
    const bridgeSearch = await fetchOnce(bridged.replaced, fallbackMode);
    if (bridgeSearch.items.length > 0) {
      return {
        query,
        total: bridgeSearch.total,
        items: bridgeSearch.items,
        warnings: [options.formatBridgeWarning(bridged, query), ...bodyWarnings],
      };
    }

    const bridgeRelax = await options.bridgeThenRelaxSearch(query, bridged, (q) =>
      fetchOnce(q, fallbackMode),
    );
    if (bridgeRelax) {
      return {
        query,
        total: bridgeRelax.total,
        items: bridgeRelax.items,
        warnings: [bridgeRelax.warning, ...bodyWarnings],
      };
    }
  }

  return { query, total: 0, items: [], warnings: [] };
}
