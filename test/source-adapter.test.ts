import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_DESCRIPTORS,
  extractDetail,
  extractRows,
  mapRow,
  searchWithLadder,
} from "../src/providers/source-adapter.js";

// 아래 fixture 는 2026-07-21 실 API 응답에서 그대로 잘라온 것이다(값 축약만 함).
// 타깃마다 컨테이너·행 키가 다르다는 사실 자체가 이 테스트의 대상이다.
const FIXTURES: Record<string, unknown> = {
  expc: {
    Expc: {
      resultMsg: "success", target: "expc", totalCnt: "3",
      expc: [{
        id: "1",
        안건명: "부당해고기간의 임금 상당액이 근로소득에 해당되는지",
        법령해석례일련번호: "312859",
        안건번호: "10-0075",
        회신기관명: "법제처",
        회신일자: "2010.04.23",
        질의기관명: "",
      }],
    },
  },
  detc: {
    DetcSearch: {
      resultMsg: "success", target: "detc", totalCnt: "2",
      Detc: [{
        id: "1",
        사건번호: "2014헌마215",
        종국일자: "2014.04.23",
        헌재결정례일련번호: "44111",
        사건명: "명예훼손에 대한 반의사불벌죄 위헌확인",
      }],
    },
  },
  decc: {
    Decc: {
      target: "decc", totalCnt: "2442",
      decc: [{
        id: "1",
        재결청: "경기도행정심판위원회",
        사건번호: "2019-00446",
        행정심판재결례일련번호: "261903",
        의결일자: "2019.05.27",
        재결구분명: "국민권익위원회",
        사건명: "2019경기행심○○○ 정보공개 이행청구",
        처분청: "",
      }],
    },
  },
  ordin: {
    OrdinSearch: {
      resultMsg: "success", target: "ordin", totalCnt: "884",
      // 행 키가 "ordin" 이 아니라 "law" 다.
      law: [{
        자치법규ID: "2212519",
        자치법규명: "가평군 전통시장 공영주차장 관리 운영 조례",
        자치법규일련번호: "2124591",
        시행일자: "20260420",
        지자체기관명: "경기도 가평군",
        자치법규종류: "조례",
        공포일자: "20260420",
        제개정구분명: "일부개정",
      }],
    },
  },
  lstrm: {
    LsTrmSearch: {
      resultMsg: "success", target: "lstrm", totalCnt: "100",
      lstrm: [{
        id: "1",
        법령용어ID: "5504153",
        법령용어명: "퇴직소득금액",
        법령종류코드: "010101",
      }],
    },
  },
};

test("extractRows finds rows for all five sources despite irregular container/row keys", () => {
  for (const [target, root] of Object.entries(FIXTURES)) {
    const descriptor = SOURCE_DESCRIPTORS[target];
    const extracted = extractRows(root, descriptor);
    assert.equal(extracted.rows.length, 1, `${target}: 행 1건`);
    assert.deepEqual(extracted.warnings, [], `${target}: 실측 키와 일치하므로 경고 없음`);
    assert.ok(extracted.total >= 1, `${target}: totalCnt 파싱`);
  }
});

test("mapRow standardises id and title per source", () => {
  const cases: Array<[string, string, string]> = [
    ["expc", "312859", "부당해고기간의 임금 상당액이 근로소득에 해당되는지"],
    ["detc", "44111", "명예훼손에 대한 반의사불벌죄 위헌확인"],
    ["decc", "261903", "2019경기행심○○○ 정보공개 이행청구"],
    ["ordin", "2124591", "가평군 전통시장 공영주차장 관리 운영 조례"],
    ["lstrm", "5504153", "퇴직소득금액"],
  ];

  for (const [target, expectedId, expectedTitle] of cases) {
    const descriptor = SOURCE_DESCRIPTORS[target];
    const { rows } = extractRows(FIXTURES[target], descriptor);
    const item = mapRow(rows[0], descriptor, 0);
    assert.equal(item.source_id, expectedId, `${target}: source_id`);
    assert.equal(item.title, expectedTitle, `${target}: title`);
  }
});

// 타깃명↔법원 대응이 직관과 어긋나므로(detc=헌재, decc=행정심판) 응답 필드로 고정한다.
test("detc/decc are pinned to the source their response fields prove, not their target name", () => {
  const detc = extractRows(FIXTURES.detc, SOURCE_DESCRIPTORS.detc).rows[0];
  const decc = extractRows(FIXTURES.decc, SOURCE_DESCRIPTORS.decc).rows[0];
  assert.ok("헌재결정례일련번호" in detc, "detc 응답이 헌재결정례임을 증명하는 필드");
  assert.ok("행정심판재결례일련번호" in decc, "decc 응답이 행정심판재결례임을 증명하는 필드");
  assert.equal(SOURCE_DESCRIPTORS.detc.label, "헌재결정례");
  assert.equal(SOURCE_DESCRIPTORS.decc.label, "행정심판재결례");
});

// Failure probe: 빈 응답·알 수 없는 컨테이너 키 → 예외 없이 0건.
test("extractRows returns zero rows without throwing on empty or unknown responses", () => {
  const descriptor = SOURCE_DESCRIPTORS.expc;

  for (const root of [null, undefined, {}, "", 42, { Expc: {} }]) {
    const extracted = extractRows(root, descriptor);
    assert.deepEqual(extracted.rows, []);
    assert.equal(extracted.total, 0);
  }

  // 정상 0건(totalCnt=0)은 경고 없이 조용히 0건이다.
  const legitZero = extractRows({ Expc: { totalCnt: "0", resultMsg: "success" } }, descriptor);
  assert.deepEqual(legitZero.rows, []);
  assert.deepEqual(legitZero.warnings, []);
});

// Failure probe: upstream 이 키를 바꿔도 조용히 0건이 되지 않고, 형태로 찾아내고 경고한다.
test("extractRows falls back to shape matching and warns when keys change", () => {
  const renamed = {
    ExpcSearchV2: { totalCnt: "1", rows: [{ 법령해석례일련번호: "999", 안건명: "바뀐 키" }] },
  };

  const extracted = extractRows(renamed, SOURCE_DESCRIPTORS.expc);
  assert.equal(extracted.rows.length, 1);
  assert.equal(extracted.warnings.length, 1);
  assert.match(extracted.warnings[0], /응답 구조가 실측값과 다르다/);
  assert.equal(mapRow(extracted.rows[0], SOURCE_DESCRIPTORS.expc, 0).source_id, "999");
});

// --- 사다리 회귀: searchLaw/searchAdminRules 가 이 헬퍼로 이관돼도 단계·경고가 같아야 한다 ---

const ladderDeps = {
  relaxQuery: (q: string) => {
    const tokens = q.trim().split(/\s+/).filter(Boolean);
    return tokens.length <= 1 ? null : tokens.slice(0, -1).join(" ");
  },
  bridgeTerm: (q: string) =>
    q.includes("접대비") ? { replaced: q.replace("접대비", "기업업무추진비"), direction: "old-to-new" } : null,
  formatBridgeWarning: (bridged: { replaced: string }, q: string) => `'${q}' → '${bridged.replaced}' 치환`,
  bridgeThenRelaxSearch: async () => null,
};

function recordingFetch(hitOn: (q: string, mode?: 1 | 2) => boolean) {
  const calls: Array<{ query: string; mode?: 1 | 2 }> = [];
  const fetchOnce = async (query: string, mode?: 1 | 2) => {
    calls.push({ query, mode });
    return hitOn(query, mode) ? { items: ["hit"], total: 1 } : { items: [] as string[], total: 0 };
  };
  return { calls, fetchOnce };
}

test("searchWithLadder returns immediately on a primary-name hit with no warnings", async () => {
  const { calls, fetchOnce } = recordingFetch(() => true);
  const result = await searchWithLadder("법인세법", fetchOnce, {
    primaryZeroWarning: "법령명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.",
    bodySearchWarning: "BODY",
    supportsBodySearch: true,
    ...ladderDeps,
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, undefined);
});

test("searchWithLadder climbs name -> body -> relax -> bridge in order", async () => {
  const { calls, fetchOnce } = recordingFetch((q) => q === "기업업무추진비 손금불산입 기준");
  await searchWithLadder("접대비 손금불산입 기준", fetchOnce, {
    primaryZeroWarning: "P",
    bodySearchWarning: "BODY",
    supportsBodySearch: true,
    ...ladderDeps,
  });

  assert.deepEqual(
    calls.map((call) => [call.query, call.mode]),
    [
      ["접대비 손금불산입 기준", undefined],
      ["접대비 손금불산입 기준", 2],
      ["접대비 손금불산입", 2],
      ["기업업무추진비 손금불산입 기준", 2],
    ],
    // 완화는 **1단만** 시도하고 바로 용어 브리지로 넘어간다 — 기존 searchLaw/searchAdminRules 와
    // 동일한 계약이다(다단 완화는 브리지 이후 bridgeThenRelaxSearch 가 맡는다).
    "이름 → 본문 → 완화 1단 → 용어 브리지 순서",
  );
});

test("searchWithLadder appends the body-search rank warning to every fallback hit", async () => {
  const { fetchOnce } = recordingFetch((_q, mode) => mode === 2);
  const result = await searchWithLadder("가지급금 인정이자", fetchOnce, {
    primaryZeroWarning: "법령명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.",
    bodySearchWarning: "BODY",
    supportsBodySearch: true,
    ...ladderDeps,
  });

  assert.deepEqual(result.warnings, ["법령명 검색 0건 → 본문(전문) 검색으로 재시도해 결과를 찾음.", "BODY"]);
});

// 본문검색 미지원 타깃(lstrm)은 mode 2 를 아예 쓰지 않고, "관련도 정렬 아님" 경고도 붙이지 않는다.
test("searchWithLadder never issues a body search for sources that do not support it", async () => {
  const { calls, fetchOnce } = recordingFetch((q) => q === "퇴직소득");
  const result = await searchWithLadder("퇴직소득 금액", fetchOnce, {
    primaryZeroWarning: "P",
    bodySearchWarning: "BODY",
    supportsBodySearch: false,
    ...ladderDeps,
  });

  assert.ok(calls.every((call) => call.mode === undefined), "mode 2 호출 없음");
  assert.deepEqual(result.warnings, ["원 쿼리 0건 → '퇴직소득'로 재검색(본문 검색)."]);
  assert.ok(!result.warnings.includes("BODY"));
});

test("searchWithLadder reports zero results when every rung misses", async () => {
  const { fetchOnce } = recordingFetch(() => false);
  const result = await searchWithLadder("아무것도없는쿼리", fetchOnce, {
    primaryZeroWarning: "P",
    bodySearchWarning: "BODY",
    supportsBodySearch: true,
    ...ladderDeps,
  });

  assert.deepEqual(result, { query: "아무것도없는쿼리", total: 0, items: [], warnings: [] });
});

// --- 단건 조회(extractDetail) — 검색과는 또 다른 컨테이너·필드 이름을 쓴다 ---------------

test("extractDetail maps a flat detail response", () => {
  const root = {
    ExpcService: {
      안건명: "부당해고기간의 임금 상당액",
      안건번호: "10-0075",
      해석기관명: "법제처",
      질의요지: "질의 내용",
      회답: "회답 내용",
      이유: "이유 내용",
    },
  };

  const detail = extractDetail(root, SOURCE_DESCRIPTORS.expc, "312859");
  assert.equal(detail?.source_id, "312859");
  assert.equal(detail?.source, "법령해석례");
  assert.equal(detail?.안건번호, "10-0075");
  assert.equal(detail?.회답, "회답 내용");
  // 응답에 없는 필드는 키를 남기되 null 이다(호출자가 "없음"과 "안 봤음"을 구분할 수 있게).
  assert.equal(detail?.해석일자, null);
});

// 행정심판재결례의 단건 컨테이너는 판례와 같은 `PrecService` 다 — 검색 컨테이너(`Decc`)와 다르다.
test("extractDetail reads 행정심판재결례 from the PrecService container", () => {
  const root = { PrecService: { 사건명: "정보공개 이행청구", 재결청: "경기도행정심판위원회" } };
  const detail = extractDetail(root, SOURCE_DESCRIPTORS.decc, "261903");
  assert.equal(detail?.사건명, "정보공개 이행청구");
  assert.equal(detail?.재결청, "경기도행정심판위원회");
});

// 자치법규만 기본정보를 한 단계 아래에 중첩해 둔다.
test("extractDetail looks one level into nested containers and reads 자치법규 articles", () => {
  const root = {
    LawService: {
      자치법규기본정보: {
        자치법규명: "가평군 전통시장 공영주차장 관리 운영 조례",
        지자체기관명: "경기도 가평군",
        공포일자: "20260420",
      },
      조문: {
        조: [
          {
            // 자치법규의 조문번호는 문자열이 아니라 배열이다.
            조문번호: ["000100", "000100"],
            조제목: "목적",
            조내용: "제1조(목적) 이 조례는 <개정 2025.4.9.> 목적으로 한다.",
            조문여부: "Y",
          },
        ],
      },
    },
  };

  const detail = extractDetail(root, SOURCE_DESCRIPTORS.ordin, "2124591", (v) =>
    v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

  assert.equal(detail?.자치법규명, "가평군 전통시장 공영주차장 관리 운영 조례");
  assert.equal(detail?.articles?.length, 1);
  assert.equal(detail?.articles?.[0].조문번호, "000100", "배열의 첫 값을 쓴다");
  assert.equal(detail?.articles?.[0].조제목, "목적");
  assert.ok(!detail?.articles?.[0].조내용?.includes("<개정"), "조내용의 태그가 벗겨진다");
});

// 조문이 1건이면 DRF 가 배열이 아니라 객체로 준다.
test("extractDetail accepts a single article delivered as an object", () => {
  const root = {
    LawService: {
      자치법규기본정보: { 자치법규명: "단조문 조례" },
      조문: { 조: { 조문번호: ["000100"], 조제목: "목적", 조내용: "본문" } },
    },
  };
  const detail = extractDetail(root, SOURCE_DESCRIPTORS.ordin, "1");
  assert.equal(detail?.articles?.length, 1);
});

test("extractDetail decodes entities in the term definition", () => {
  const root = { LsTrmService: { 법령용어명_한글: "퇴직소득", 법령용어정의: "금액을 말한다. &lt;신설 2015.2.3&gt;" } };
  const detail = extractDetail(root, SOURCE_DESCRIPTORS.lstrm, "20750", (v) =>
    v.replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  assert.equal(detail?.법령용어정의, "금액을 말한다. <신설 2015.2.3>");
});

// Failure probe: 존재하지 않는 ID 는 빈 컨테이너를 주므로 null(→ NOT_FOUND)이어야 한다.
test("extractDetail returns null for empty, missing, or field-less responses", () => {
  for (const root of [null, undefined, {}, { ExpcService: {} }, { Other: { x: "1" } }]) {
    assert.equal(extractDetail(root, SOURCE_DESCRIPTORS.expc, "999"), null);
  }
});

// 모든 법원의 단건 조회 파라미터가 명시적으로 고정돼 있어야 한다 — `ordin` 을 ID 로 부르면
// 200 과 함께 **다른 조례**가 돌아온다(2026-07-21 실측). 조용한 오답이라 테스트로 못 박는다.
test("every source pins its detail lookup parameter", () => {
  assert.equal(SOURCE_DESCRIPTORS.ordin.detail.idParam, "MST");
  assert.equal(SOURCE_DESCRIPTORS.lstrm.detail.idParam, "trmSeqs");
  for (const target of ["expc", "detc", "decc"]) {
    assert.equal(SOURCE_DESCRIPTORS[target].detail.idParam, "ID");
  }
});
