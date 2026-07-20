import assert from "node:assert/strict";
import test from "node:test";
import { rerankByArticleScore, scoreArticles, tokenizeQuery } from "../src/article-match.js";
import type { IndexedArticle } from "../src/article-index.js";

const article = (no: string, text: string, title: string | null = null): IndexedArticle => ({
  article_no: no,
  display: `제${no}조`,
  title,
  text,
});

test("tokenizeQuery drops short tokens and generic legal filler", () => {
  assert.deepEqual(tokenizeQuery("부당해고 구제신청 기간"), ["부당해고", "구제신청"]);
  assert.deepEqual(tokenizeQuery("정당방위 성립 요건"), ["정당방위", "성립"]);
  assert.deepEqual(tokenizeQuery("   "), []);
});

test("scoreArticles ranks articles by matched token count", () => {
  const articles = [
    article("23", "사용자는 근로자에게 정당한 이유 없이 해고하지 못한다", "해고 등의 제한"),
    article("28", "부당해고등을 하면 근로자는 노동위원회에 구제신청을 할 수 있다", "부당해고등의 구제신청"),
  ];

  const result = scoreArticles(articles, "부당해고 구제신청");

  assert.equal(result.matched_articles, 1);
  assert.equal(result.covered_tokens, 2);
  // 제28조는 본문 2토큰 + 제목("부당해고등의 구제신청") 2토큰 → (2 + 2×3)² = 64.
  // F4(제목 가중) 도입 전에는 4였다 — 의도된 변경.
  assert.equal(result.score, 64);
  assert.equal(result.top[0].display, "제28조");
  // 본문 2 + 제목 2 (F4 이후) — 제목 매칭도 matched_tokens 에 합산된다.
  assert.equal(result.top[0].matched_tokens, 4);
  assert.ok(result.top[0].excerpt.includes("부당해고"));
});

// 제곱 가중의 의도: 같은 토큰 수라도 한 조문에 몰린 쪽이 높다.
test("scoreArticles favours tokens concentrated in one article over scattered ones", () => {
  const concentrated = [article("1", "정당방위 성립 요건을 정한다")];
  const scattered = [article("1", "정당방위에 관하여"), article("2", "성립 시기에 관하여")];

  const a = scoreArticles(concentrated, "정당방위 성립");
  const b = scoreArticles(scattered, "정당방위 성립");

  assert.equal(a.score, 4);
  assert.equal(b.score, 2);
  assert.ok(a.score > b.score);
});

test("scoreArticles returns a zero score when nothing matches", () => {
  const result = scoreArticles([article("1", "전혀 다른 내용")], "정당방위 성립");
  assert.equal(result.score, 0);
  assert.equal(result.matched_articles, 0);
  assert.deepEqual(result.top, []);
});

// Failure probe: 신호가 없으면 순서를 흔들지 않는다 (ib3 회귀 교훈)
test("rerankByArticleScore preserves the original order when every score is zero", () => {
  const candidates = ["법인세법", "예금자보호법", "방송법 시행규칙"];
  assert.deepEqual(rerankByArticleScore(candidates, () => 0), candidates);
});

test("rerankByArticleScore sorts by score and keeps original order as tiebreak", () => {
  const candidates = ["A", "B", "C", "D"];
  const scores: Record<string, number> = { A: 0, B: 9, C: 4, D: 9 };

  assert.deepEqual(
    rerankByArticleScore(candidates, (c) => scores[c]),
    ["B", "D", "C", "A"],
  );
});

// F4 (2026-07-21 실측): 제목이 곧 쟁점명인 경우가 많아 제목 매칭은 본문 매칭보다 강한 신호다.
// "사실적시 명예훼손 처벌"이 제목 "명예훼손"인 조문을 못 집고 제1·14·18조를 예측한 실패의 수정.
test("scoreArticles weights a title match above body-only matches", () => {
  const articles = [
    article("1", "명예훼손 이라는 낱말이 본문에 한 번 나오는 조문", "목적"),
    article("307", "공연히 사실을 적시하여 사람의 명예를 훼손한 자는", "명예훼손"),
  ];

  const result = scoreArticles(articles, "명예훼손 처벌");

  assert.equal(result.top[0].display, "제307조", "제목 매칭 조문이 1위");
  assert.ok(result.score > 0);
});

test("scoreArticles still ranks body matches when no title matches", () => {
  const articles = [
    article("10", "전혀 다른 내용", "제목없음"),
    article("20", "정당방위 성립 여부를 정한다", null),
  ];

  const result = scoreArticles(articles, "정당방위 성립");
  assert.equal(result.top[0].display, "제20조");
});
