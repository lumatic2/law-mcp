import assert from "node:assert/strict";
import test from "node:test";
import { canonicalArticleNo, isSameTitle, pickExactLawId, verifyCitation } from "../src/citation-verify.js";
import type { IndexedArticle } from "../src/article-index.js";

const ARTICLES: IndexedArticle[] = [
  { article_no: "21", display: "제21조", title: "정당방위", text: "현재의 부당한 침해로부터 자기 또는 타인의 법익을 방위하기 위하여 한 행위는 상당한 이유가 있는 경우에는 벌하지 아니한다." },
  { article_no: "22", display: "제22조", title: "긴급피난", text: "자기 또는 타인의 법익에 대한 현재의 위난을 피하기 위한 행위" },
  { article_no: "347", display: "제347조", title: "사기", text: "사람을 기망하여 재물의 교부를 받거나" },
];

test("canonicalArticleNo absorbs 제/조 notation", () => {
  assert.equal(canonicalArticleNo("제21조"), "21");
  assert.equal(canonicalArticleNo("21조"), "21");
  assert.equal(canonicalArticleNo(" 제839조의2 "), "839의2");
});

test("isSameTitle ignores spacing, punctuation and hanja parentheses", () => {
  assert.equal(isSameTitle("정당방위", "정당 방위"), true);
  assert.equal(isSameTitle("정당방위", "정당방위(正當防衛)"), true);
  assert.equal(isSameTitle("정당방위", "긴급피난"), false);
});

test("verifyCitation confirms a real citation with matching title", () => {
  const result = verifyCitation(ARTICLES, "형법", "제21조", "정당방위");

  assert.equal(result.verdict, "ok");
  assert.equal(result.actual_title, "정당방위");
  assert.ok(result.excerpt?.includes("현재의 부당한 침해"));
});

test("verifyCitation accepts a citation without a cited title", () => {
  assert.equal(verifyCitation(ARTICLES, "형법", "21조").verdict, "ok");
});

// 전형적 환각 1: 존재하지 않는 조문번호
test("verifyCitation flags a hallucinated article number and suggests nearby articles", () => {
  const result = verifyCitation(ARTICLES, "형법", "제9999조", "정당방위");

  assert.equal(result.verdict, "not_found");
  assert.ok(result.reason.includes("환각"));
  assert.deepEqual(result.nearby, ["제347조", "제22조", "제21조"]);
});

// 전형적 환각 2: 조문은 맞지만 제목을 지어냄
test("verifyCitation flags a title that does not match the real article", () => {
  const result = verifyCitation(ARTICLES, "형법", "제21조", "사기");

  assert.equal(result.verdict, "title_mismatch");
  assert.equal(result.actual_title, "정당방위");
  assert.ok(result.reason.includes("정당방위"));
});

// Failure probe: 조회 실패(null)를 ok 로 오판하지 않는다 — 거짓 안심 방지
test("verifyCitation never reports ok when the law could not be loaded", () => {
  const failed = verifyCitation(null, "형법", "제21조", "정당방위");
  assert.equal(failed.verdict, "law_not_found");
  assert.ok(failed.reason.includes("판정하지 못했다"));

  const empty = verifyCitation([], "없는법", "제1조");
  assert.equal(empty.verdict, "law_not_found");
});

// 실측 결함(2026-07-21): "존재하지않는법률" 이 검색 폴백으로 건축법 시행령에 매칭돼 ok 판정이 났다.
// 검증 도구에서 거짓 안심은 가장 나쁜 실패이므로 완전일치만 채택한다.
test("pickExactLawId only accepts an exact law-name match", () => {
  const items = [
    { law_id: "010", law_name: "건축법 시행령" },
    { law_id: "011", law_name: "건축법" },
  ];

  assert.equal(pickExactLawId(items, "건축법"), "011");
  assert.equal(pickExactLawId(items, "건축법 시행령"), "010");
  assert.equal(pickExactLawId(items, "존재하지않는법률"), null);
  assert.equal(pickExactLawId([], "형법"), null);
});

test("pickExactLawId ignores spacing differences in law names", () => {
  const items = [{ law_id: "009", law_name: "상가건물 임대차보호법" }];
  assert.equal(pickExactLawId(items, "상가건물임대차보호법"), "009");
});
