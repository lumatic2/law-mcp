import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  cleanSegment,
  extractArticles,
  flattenContentSegments,
  isTableSegment,
  readContent,
} from "../src/article-index.js";

/** 법제처가 표를 담은 조문에서 실제로 주는 모양 (2026-07-22 실측 축약). */
const 표_항내용 = [[
  "①거주자의 종합소득에 대한 소득세는 다음의 세율을 적용한다. <개정 2022.12.31> ",
  '<img src="http://www.law.go.kr/flDownload.do?flSeq=123278409"  alt="img123278409" >',
  "┌────────┬──────────────────┐",
  "│종합소득        │세   율           │",
  "├────────┼──────────────────┤",
  "│1,400만원 이하  │과세표준의 6퍼센트│",
  "└────────┴──────────────────┘",
]];

describe("배열형 내용 평탄화", () => {
  it("중첩 배열을 조각으로 펼친다", () => {
    assert.equal(flattenContentSegments(표_항내용).length, 7);
  });

  it("문자열도 그대로 받는다 — 기존 모양이 깨지지 않는다", () => {
    assert.deepEqual(flattenContentSegments("① 본문"), ["① 본문"]);
  });

  it("빈 값·빈 문자열은 조각이 되지 않는다", () => {
    assert.deepEqual(flattenContentSegments([["", "   ", null, undefined]]), []);
  });
});

describe("표 줄은 원문 그대로 (재조판 금지)", () => {
  it("표 줄을 알아본다", () => {
    assert.equal(isTableSegment("│1,400만원 이하  │과세표준의 6퍼센트│"), true);
    assert.equal(isTableSegment("① 거주자의 종합소득에 대한"), false);
  });

  it("표 줄의 칸 공백을 접지 않는다 — 정렬이 곧 의미다", () => {
    const row = "│종합소득        │세   율           │";
    assert.equal(cleanSegment(row), row);
  });

  it("산문 줄은 공백을 접는다", () => {
    assert.equal(cleanSegment("①  거주자의   종합소득 "), "① 거주자의 종합소득");
  });

  it("이미지 태그는 본문에서 빠진다", () => {
    assert.equal(cleanSegment('<img src="x" alt="y" >'), "");
  });
});

describe("본문 유실 (TV5 가 없앤 결함)", () => {
  it("배열형 항내용에서 본문이 사라지지 않는다", () => {
    // 수리 전에는 pickString 이 null 을 돌려 이 항 전체가 빠졌다.
    const text = readContent({ 항내용: 표_항내용 }, ["항내용"]);
    assert.ok(text, "본문이 있어야 한다");
    assert.match(text, /거주자의 종합소득/, "산문이 살아 있다");
    assert.match(text, /1,400만원 이하/, "표 내용이 살아 있다");
  });

  it("표가 여러 줄로 남는다 — 한 줄로 뭉개지지 않는다", () => {
    const text = readContent({ 항내용: 표_항내용 }, ["항내용"]) ?? "";
    assert.ok(text.split("\n").length >= 5, "표 줄이 줄바꿈으로 보존된다");
  });

  it("조문 추출 전체에서 세율표가 살아남는다", () => {
    const root = {
      법령: {
        조문: {
          조문단위: [{
            조문번호: "55", 조문여부: "조문", 조문제목: "세율",
            조문내용: "제55조(세율)", 항: [{ 항번호: "①", 항내용: 표_항내용 }],
          }],
        },
      },
    };
    const [article] = extractArticles(root);
    assert.equal(article.article_no, "55");
    assert.match(article.text, /1,400만원 이하/);
    assert.match(article.text, /과세표준의 6퍼센트/);
  });

  it("실패 프로브 — 이미지·빈 문자열만 있는 항에서 오류가 나지 않는다", () => {
    assert.equal(readContent({ 항내용: [['<img src="x">', "  "]] }, ["항내용"]), null);
    assert.equal(readContent({}, ["항내용"]), null);
  });
});

describe("두 표면이 같은 본문을 낸다 (DoD ⑤)", () => {
  const provider = readFileSync(new URL("../src/providers/lawgo-provider.ts", import.meta.url), "utf8");

  it("단건 조회도 같은 readContent 를 쓴다", () => {
    assert.match(provider, /import \{[^}]*readContent[^}]*\} from "\.\.\/article-index\.js"/);
    const fn = provider.slice(provider.indexOf("function extractFullArticleContent"));
    const body = fn.slice(0, fn.indexOf("\nfunction ", 10));
    assert.match(body, /readContent\(항Obj, \["항내용"/);
    assert.doesNotMatch(body, /pickString\(항Obj, \["항내용"/, "옛 경로가 남아 있으면 표면마다 답이 갈린다");
  });

  it("조문 조회가 JO 로 자르지 않는다 — upstream 이 표를 빼고 준다", () => {
    // 2026-07-22 실측: JO 조회는 251자·표 없음, 전문은 1596자·표 있음.
    assert.match(provider, /private async fetchArticleRootCached/);
    assert.match(provider, /fetchLawArticleRoot\(key, keyField, undefined, efYd\)/);
    assert.doesNotMatch(provider, /fetchLawArticleRoot\(resolvedLawId, "ID", joParam\)/);
  });

  it("전문을 캐시한다 — 771KB 를 두 번 받지 않는다", () => {
    assert.match(provider, /articleRootCache/);
  });
});
