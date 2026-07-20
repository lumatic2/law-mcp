import assert from "node:assert/strict";
import test from "node:test";
import { ArticleIndexCache, extractArticles } from "../src/article-index.js";

// 법제처 lawService(target=law) 응답 축약형 — 조문단위/항/호 구조와 비조문("전문") 행을 함께 담는다.
const LAW_ROOT = {
  법령: {
    법령ID: "001692",
    법령명한글: "형법",
    조문: {
      조문단위: [
        {
          조문번호: "21",
          조문여부: "조문",
          조문제목: "정당방위",
          조문내용: "제21조(정당방위) ① 현재의 부당한 침해로부터 자기 또는 타인의 법익을 방위하기 위하여 한 행위는 상당한 이유가 있는 경우에는 벌하지 아니한다.",
          항: [
            { 항내용: "② 방위행위가 그 정도를 초과한 때에는 정황에 따라 그 형을 감경하거나 면제할 수 있다." },
          ],
        },
        {
          조문번호: "2",
          조문여부: "전문",
          조문내용: "제1장 죄의 성립과 형의 감면",
        },
        {
          조문번호: "258",
          조문가지번호: "2",
          조문여부: "조문",
          조문제목: "특수상해",
          조문내용: "제258조의2(특수상해) ① 단체 또는 다중의 위력을 보이거나 위험한 물건을 휴대하여 제257조제1항의 죄를 범한 때에는",
          항: [
            {
              항내용: "② 제1항의 미수범은 처벌한다.",
              호: [
                { 호내용: "1. 첫째 호 내용", 목: [{ 목내용: "가. 목 내용" }] },
              ],
            },
          ],
        },
      ],
    },
  },
};

test("extractArticles splits articles and keeps 항/호/목 text", () => {
  const articles = extractArticles(LAW_ROOT as unknown as Record<string, unknown>);

  assert.equal(articles.length, 2, "비조문(전문) 행은 제외된다");

  const 정당방위 = articles[0];
  assert.equal(정당방위.article_no, "21");
  assert.equal(정당방위.display, "제21조");
  assert.equal(정당방위.title, "정당방위");
  assert.ok(정당방위.text.includes("현재의 부당한 침해"));
  assert.ok(정당방위.text.includes("정황에 따라 그 형을 감경"), "항 내용이 이어붙는다");
});

test("extractArticles handles branch article numbers and nested 호/목", () => {
  const articles = extractArticles(LAW_ROOT as unknown as Record<string, unknown>);
  const 특수상해 = articles[1];

  assert.equal(특수상해.article_no, "258의2");
  assert.equal(특수상해.display, "제258조의2");
  assert.ok(특수상해.text.includes("첫째 호 내용"));
  assert.ok(특수상해.text.includes("가. 목 내용"));
});

// Failure probe: 조문 구조가 없는 응답에서 예외 없이 빈 배열
test("extractArticles returns an empty array for responses without article structure", () => {
  assert.deepEqual(extractArticles({}), []);
  assert.deepEqual(extractArticles({ 법령: {} } as Record<string, unknown>), []);
  assert.deepEqual(
    extractArticles({ AdmRulService: { 행정규칙기본정보: { 행정규칙명: "조사사무처리규정" } } } as Record<string, unknown>),
    [],
  );
  // 조문 행은 있으나 본문이 비면 그 조문은 버린다(빈 텍스트 인덱스 방지)
  assert.deepEqual(
    extractArticles({ 법령: { 조문: { 조문단위: [{ 조문번호: "1", 조문여부: "조문" }] } } } as Record<string, unknown>),
    [],
  );
});

test("ArticleIndexCache evicts the least recently used entry past its limit", () => {
  const cache = new ArticleIndexCache(2);
  const article = (no: string) => [{ article_no: no, display: `제${no}조`, title: null, text: "t" }];

  cache.set("A", article("1"));
  cache.set("B", article("2"));
  cache.get("A"); // A 를 최근 사용으로 올린다 → 다음 축출 대상은 B
  cache.set("C", article("3"));

  assert.equal(cache.size, 2);
  assert.equal(cache.has("A"), true);
  assert.equal(cache.has("B"), false, "가장 오래 안 쓴 항목이 축출된다");
  assert.equal(cache.has("C"), true);
});

test("ArticleIndexCache returns undefined on miss and refreshes on overwrite", () => {
  const cache = new ArticleIndexCache(2);
  assert.equal(cache.get("없음"), undefined);

  cache.set("A", [{ article_no: "1", display: "제1조", title: null, text: "old" }]);
  cache.set("A", [{ article_no: "1", display: "제1조", title: null, text: "new" }]);

  assert.equal(cache.size, 1);
  assert.equal(cache.get("A")?.[0].text, "new");
});
