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
  /** 단건 조회(lawService.do) 사양 */
  detail: SourceDetailSpec;
};

export type SourceDetailSpec = {
  /** 단건 조회 응답의 컨테이너 키 (검색 응답과 다르다) */
  container: string;
  /**
   * 문서를 지정하는 파라미터 이름. 타깃마다 다르고, **틀리면 조용히 다른 문서가 온다** —
   * `ordin` 은 `MST` 가 맞고 `ID` 로 부르면 전혀 다른 자치법규가 200 으로 돌아온다(2026-07-21 실측:
   * 가평군 조례를 요청했는데 창원시 하수도 조례가 왔다). 그래서 타깃별로 못 박는다.
   */
  idParam: "ID" | "MST" | "trmSeqs";
  fields: SourceFieldSpec[];
  /** 조문 배열을 가진 법원(자치법규)만 지정 */
  articlesPath?: { container: string; rowKey: string };
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
    detail: {
      container: "ExpcService",
      idParam: "ID",
      fields: [
        { as: "안건명", from: ["안건명"] },
        { as: "안건번호", from: ["안건번호"] },
        { as: "해석기관명", from: ["해석기관명"] },
        { as: "질의기관명", from: ["질의기관명"] },
        { as: "해석일자", from: ["해석일자"] },
        { as: "질의요지", from: ["질의요지"] },
        { as: "회답", from: ["회답"] },
        { as: "이유", from: ["이유"] },
      ],
    },
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
    detail: {
      container: "DetcService",
      idParam: "ID",
      fields: [
        { as: "사건명", from: ["사건명"] },
        { as: "사건번호", from: ["사건번호"] },
        { as: "사건종류명", from: ["사건종류명"] },
        { as: "종국일자", from: ["종국일자"] },
        { as: "판시사항", from: ["판시사항"] },
        { as: "결정요지", from: ["결정요지"] },
        { as: "심판대상조문", from: ["심판대상조문"] },
        { as: "참조조문", from: ["참조조문"] },
        { as: "참조판례", from: ["참조판례"] },
        { as: "전문", from: ["전문"] },
      ],
    },
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
    detail: {
      // 단건 조회 컨테이너가 판례와 같은 `PrecService` 다(검색은 `Decc`). 검색 응답의
      // `행정심판재결례일련번호` 가 단건 응답에서는 `행정심판례일련번호` 로 이름이 또 다르다.
      container: "PrecService",
      idParam: "ID",
      fields: [
        { as: "사건명", from: ["사건명"] },
        { as: "사건번호", from: ["사건번호"] },
        { as: "재결청", from: ["재결청"] },
        { as: "처분청", from: ["처분청"] },
        { as: "의결일자", from: ["의결일자"] },
        { as: "처분일자", from: ["처분일자"] },
        { as: "재결례유형명", from: ["재결례유형명"] },
        { as: "청구취지", from: ["청구취지"] },
        { as: "주문", from: ["주문"] },
        { as: "재결요지", from: ["재결요지"] },
        { as: "이유", from: ["이유"] },
      ],
    },
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
    detail: {
      container: "LawService",
      // `ID` 가 아니라 `MST`(=검색이 준 자치법규일련번호). `ID` 로 부르면 다른 조례가 온다.
      idParam: "MST",
      fields: [
        { as: "자치법규명", from: ["자치법규명"] },
        { as: "지자체기관명", from: ["지자체기관명"] },
        { as: "자치법규종류", from: ["자치법규종류"] },
        { as: "공포일자", from: ["공포일자"] },
        { as: "시행일자", from: ["시행일자"] },
        { as: "제개정정보", from: ["제개정정보", "제개정구분명"] },
        { as: "담당부서명", from: ["담당부서명"] },
      ],
      // 자치법규 조문은 법령의 `조문.조문단위` 가 아니라 `조문.조` 다(실측).
      articlesPath: { container: "조문", rowKey: "조" },
    },
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
    detail: {
      container: "LsTrmService",
      // 용어는 ID 가 아니라 `trmSeqs` 로 조회한다.
      idParam: "trmSeqs",
      fields: [
        { as: "법령용어명", from: ["법령용어명_한글", "법령용어명"] },
        { as: "법령용어명_한자", from: ["법령용어명_한자"] },
        { as: "법령용어정의", from: ["법령용어정의"] },
        { as: "법령용어코드명", from: ["법령용어코드명"] },
        { as: "출처", from: ["출처"] },
      ],
    },
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

export type SourceDetail = {
  source_id: string;
  source: string;
  /** 자치법규처럼 조문을 가진 법원만 채워진다 */
  articles?: Array<{ 조문번호: string | null; 조제목: string | null; 조내용: string | null }>;
  [key: string]: unknown;
};

/**
 * 단건 조회 응답을 표준 상세로 바꾼다. 찾지 못하면 null(→ 도구가 NOT_FOUND 로 응답).
 *
 * 필드는 컨테이너 직속 → **한 단계 아래 중첩 객체** 순으로 찾는다. 자치법규가 기본정보를
 * `LawService.자치법규기본정보` 안에 넣기 때문이다(다른 법원은 평평하다).
 */
export function extractDetail(
  root: unknown,
  descriptor: SourceDescriptor,
  sourceId: string,
  decode: (value: string) => string = (value) => value,
): SourceDetail | null {
  const rootObj = asObject(root);
  const container = asObject(rootObj[descriptor.detail.container]);
  if (Object.keys(container).length === 0) return null;

  const nested = Object.values(container).map((value) => asObject(value));
  const lookup = (keys: string[]): string | null => {
    const direct = pickString(container, keys);
    if (direct !== null) return direct;
    for (const child of nested) {
      const found = pickString(child, keys);
      if (found !== null) return found;
    }
    return null;
  };

  const detail: SourceDetail = { source_id: sourceId, source: descriptor.label };
  let hasAnyField = false;
  for (const field of descriptor.detail.fields) {
    const value = lookup(field.from);
    if (value !== null) hasAnyField = true;
    detail[field.as] = value === null ? null : decode(value);
  }
  if (!hasAnyField) return null;

  const articlesPath = descriptor.detail.articlesPath;
  if (articlesPath) {
    const articleContainer = asObject(container[articlesPath.container]);
    const rows = articleContainer[articlesPath.rowKey];
    // 조문이 1건이면 배열이 아니라 객체로 온다(DRF 공통 습성).
    const list = isObjectArray(rows) ? rows : Object.keys(asObject(rows)).length > 0 ? [asObject(rows)] : [];
    detail.articles = list
      .filter((row) => Object.keys(row).length > 0)
      .map((row) => ({
        // 자치법규의 조문번호는 문자열이 아니라 배열이다(["000100","000100"]) — 실측.
        조문번호: Array.isArray(row.조문번호)
          ? (pickString({ v: row.조문번호[0] }, ["v"]))
          : pickString(row, ["조문번호"]),
        조제목: pickString(row, ["조제목"]),
        조내용: (() => {
          const text = pickString(row, ["조내용"]);
          return text === null ? null : decode(text);
        })(),
      }));
  }

  return detail;
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
