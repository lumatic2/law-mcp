/**
 * 골드 4파일 → 단일 코퍼스 마이그레이션 (TF1 step-2).
 *
 * **왜 합치나**: 세트가 형식별로 갈려 있어서 `golden-v2`·`golden-tax` 는 `query`(라벨 문자열)만,
 * `golden-tax-agentic` 은 `context`(자연어 맥락)만 갖는다. 그래서 에이전트 하네스가 124건 중
 * 34건밖에 못 썼다. 케이스를 **형식 중립**으로 보관하면 형식이 바뀌어도 데이터를 다시 안 만든다.
 *
 * **레코드는 줄이지 않는다**: 같은 조문을 정답으로 갖는 레코드가 세트 간에 겹치지만(24+7건)
 * 합치지 않고 `topic_id` 로 묶기만 한다. 합쳐 버리면 통합 전 수치를 재현할 수 없게 되고,
 * 그러면 "합치다 뭔가 깨졌나"를 판정할 수단이 사라진다(TF1 DoD).
 *
 * `golden.json`(v1)은 `golden-v2` 가 재라벨로 **대체**한 판이라 코퍼스에 넣지 않는다.
 *
 * 사용: npx tsx bench/migrate-corpus.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";

type Source = { file: string; prefix: string; domainDefault?: string };

const SOURCES: Source[] = [
  { file: "golden-v2.json", prefix: "v2" },
  { file: "golden-tax.json", prefix: "tax" },
  { file: "golden-tax-agentic.json", prefix: "ag", domainDefault: "세법" },
];

/** v1 은 v2 가 대체했다 — 이력만 남기고 코퍼스에는 넣지 않는다. */
const SUPERSEDED = { file: "golden.json", by: "golden-v2.json" };

export type CorpusCase = {
  case_id: string;
  provenance: string;
  /** 같은 정답 조문을 가리키는 레코드끼리 묶는 키. 형식만 다른 같은 문제를 잇는다. */
  topic_id: string;
  split: "dev" | "holdout";
  domain: string;
  type: string | null;
  tax_year: number | null;
  /** 라벨 문자열 질의. agentic 출신은 없다(TF2 에서 채운다). */
  query: string | null;
  /** 자연어 맥락. v2·tax 출신은 없다(TF2 에서 채운다). */
  context: string | null;
  expected_laws: string[] | null;
  expected_article: string | null;
  expect_abstain: boolean;
  abstain_reason: string | null;
  /** 라벨 근거 — 추정 라벨 방지 장치(구 check-schema 규약). */
  source: string | null;
};

/** 정답 조문을 topic 키로 정규화한다. 기권 케이스는 조문이 없으므로 사유로 가른다. */
export function topicKey(article: string | null | undefined, fallback: string): string {
  if (!article) return `abstain:${fallback}`;
  return article.replace(/\s+/g, " ").trim();
}

function load(file: string): Record<string, unknown>[] {
  const data = JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8")) as {
    items: Record<string, unknown>[];
  };
  return data.items;
}

export function buildCorpus(): { cases: CorpusCase[]; log: string[] } {
  const log: string[] = [];
  const cases: CorpusCase[] = [];

  for (const src of SOURCES) {
    const items = load(src.file);
    items.forEach((item, i) => {
      const seq = String(i + 1).padStart(2, "0");
      const rawId = typeof item.case_id === "string" ? item.case_id : seq;
      const article = (item.expected_article as string | undefined) ?? null;
      const abstain = Boolean(item.expect_abstain) || !article;
      cases.push({
        case_id: `${src.prefix}-${rawId}`,
        provenance: src.file,
        topic_id: topicKey(article, `${src.prefix}-${rawId}`),
        split: item.split === "holdout" ? "holdout" : "dev",
        domain: (item.domain as string | undefined) ?? src.domainDefault ?? "미분류",
        type: (item.type as string | undefined) ?? null,
        tax_year: (item.tax_year as number | undefined) ?? null,
        query: (item.query as string | undefined) ?? null,
        context: (item.context as string | undefined) ?? null,
        expected_laws: (item.expected_laws as string[] | undefined) ?? null,
        expected_article: article,
        expect_abstain: abstain,
        abstain_reason: (item.abstain_reason as string | undefined) ?? null,
        source: (item.source as string | undefined) ?? null,
      });
    });
    log.push(`${src.file}: ${items.length}건 → prefix '${src.prefix}'`);
  }

  const superseded = load(SUPERSEDED.file).length;
  log.push(`${SUPERSEDED.file}: ${superseded}건 — ${SUPERSEDED.by} 가 재라벨로 대체, 코퍼스 제외`);

  return { cases, log };
}

function main(): void {
  const { cases, log } = buildCorpus();

  const topics = new Map<string, CorpusCase[]>();
  for (const c of cases) {
    const list = topics.get(c.topic_id) ?? [];
    list.push(c);
    topics.set(c.topic_id, list);
  }
  const paired = [...topics.values()].filter((g) => g.length > 1);
  const fillable = paired.filter(
    (g) => g.some((c) => c.query) && g.some((c) => c.context),
  );

  console.log("=== 마이그레이션 로그 ===");
  log.forEach((l) => console.log(`  ${l}`));
  console.log(`\n총 레코드 ${cases.length}건 · distinct topic ${topics.size}개`);
  console.log(`  형식이 다른 짝이 있는 topic: ${paired.length}개`);
  console.log(`  그중 query·context 를 서로 채워줄 수 있는 topic: ${fillable.length}개`);
  console.log(`  query 보유 ${cases.filter((c) => c.query).length}건 · context 보유 ${cases.filter((c) => c.context).length}건`);

  if (process.argv.includes("--write")) {
    const out = {
      version: 1,
      created: "2026-07-23",
      milestone: "TF1",
      note:
        "형식 중립 단일 코퍼스. query(라벨 문자열)와 context(자연어 맥락)를 같은 레코드가 함께 갖는다. "
        + "topic_id 는 같은 정답 조문을 가리키는 레코드를 묶는다. 통합 전 4파일은 archive/bench/ 에 있다.",
      items: cases,
    };
    writeFileSync(new URL("./corpus.json", import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
    console.log("\nbench/corpus.json 기록 완료");
  } else {
    console.log("\n(--write 없이 실행 — 파일을 쓰지 않았다)");
  }
}

main();
