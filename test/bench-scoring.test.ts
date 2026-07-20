import assert from "node:assert/strict";
import test from "node:test";
import {
  isHitAtK,
  isSameArticle,
  normalizeName,
  parseArticleLabel,
  summarize,
  type ItemOutcome,
} from "../bench/scoring.js";

function outcome(over: Partial<ItemOutcome> = {}): ItemOutcome {
  return {
    query: "q",
    domain: "노동",
    split: "dev",
    hit1: false,
    hit3: false,
    precHit: false,
    articleChecked: false,
    articleCorrect: false,
    returned: [],
    ...over,
  };
}

test("normalizeName strips spacing and punctuation", () => {
  assert.equal(normalizeName("상가건물 임대차보호법"), "상가건물임대차보호법");
  assert.equal(normalizeName("독점규제 및 공정거래에 관한 법률"), "독점규제및공정거래에관한법률");
});

test("isHitAtK honours k and allows multiple expected laws", () => {
  const returned = ["예금자보호법", "근로기준법", "의료법"];
  assert.equal(isHitAtK(returned, ["근로기준법"], 1), false);
  assert.equal(isHitAtK(returned, ["근로기준법"], 3), true);
  assert.equal(isHitAtK(returned, ["노동위원회법", "근로기준법"], 3), true);
  assert.equal(isHitAtK(returned, ["형법"], 3), false);
});

// 부분일치로 채점하면 "민법" 이 "국제사법"·"민법 시행령" 에 걸려 점수가 부풀려진다.
test("isHitAtK requires exact normalized match, not substring", () => {
  assert.equal(isHitAtK(["민법 시행령"], ["민법"], 3), false);
  assert.equal(isHitAtK(["국제사법"], ["민법"], 3), false);
  assert.equal(isHitAtK(["민법"], ["민법"], 3), true);
});

test("parseArticleLabel splits law name and article number", () => {
  assert.deepEqual(parseArticleLabel("민법 제839조의2"), { law: "민법", article: "제839조의2" });
  assert.deepEqual(parseArticleLabel("상가건물 임대차보호법 제10조의4"), {
    law: "상가건물 임대차보호법",
    article: "제10조의4",
  });
  assert.equal(parseArticleLabel("민법"), null);
});

test("isSameArticle absorbs 제/조 notation differences", () => {
  assert.equal(isSameArticle("제28조", "28"), true);
  assert.equal(isSameArticle("제839조의2", "839조의2"), true);
  assert.equal(isSameArticle("제28조", "제29조"), false);
});

test("summarize computes recall and keeps errors out of the denominator", () => {
  const summary = summarize([
    outcome({ hit1: true, hit3: true }),
    outcome({ hit3: true, domain: "형사" }),
    outcome({ domain: "형사" }),
    outcome({ error: "auth failed" }),
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.scored, 3);
  assert.equal(summary.errors, 1);
  assert.equal(summary.recall_at_3, 0.6667);
  assert.equal(summary.recall_at_1, 0.3333);
  assert.equal(summary.by_domain["형사"].recall_at_3, 0.5);
  assert.equal(summary.article_accuracy, null);
});

test("summarize reports article accuracy only over checked items", () => {
  const summary = summarize([
    outcome({ articleChecked: true, articleCorrect: true }),
    outcome({ articleChecked: true }),
    outcome({}),
  ]);

  assert.equal(summary.article_checked, 2);
  assert.equal(summary.article_accuracy, 0.5);
});
