/**
 * LB3 step-3 — 법원별 기여도 측정.
 *
 * 목적: 새 법원 5종 중 **실제로 답에 기여하는 것만** 도구로 노출한다(도구 인플레 방지).
 *
 * 기여의 정의(기계적 프록시, 한계를 명시한다):
 *   - 도달  = 그 쿼리로 1건 이상 반환했다.
 *   - 기여  = 상위 3건 중, 제목이 쿼리 토큰의 **과반**을 담은 항목이 하나라도 있다.
 * 이는 "정답인가"가 아니라 "쟁점과 같은 말을 하는 문서를 집었는가"의 근사다. 제목만 보므로
 * 과대평가(제목에 흔한 낱말) 와 과소평가(제목이 사건번호뿐) 가 둘 다 가능하다. 그래서 이 수치는
 * **등록/미등록 게이트로만** 쓰고, 순위 비교에는 쓰지 않는다. 표본은 사람이 눈으로 읽는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenizeQuery } from "../src/article-match.js";
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { SOURCE_DESCRIPTORS } from "../src/providers/source-adapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, "golden.json"), "utf-8")) as {
  items: Array<{ query: string; domain: string; split: string }>;
};

// dev 스플릿만 쓴다 — 홀드아웃은 봉인 유지.
const items = golden.items.filter((item) => item.split === "dev");
const targets = Object.keys(SOURCE_DESCRIPTORS);
const provider = new LawGoProvider();

type Row = { reached: number; contributed: number; samples: string[]; errors: number };
const stats = new Map<string, Row>(
  targets.map((target) => [target, { reached: 0, contributed: 0, samples: [], errors: 0 }]),
);

function titleCoversQuery(title: string | null, query: string): boolean {
  if (!title) return false;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return false;
  const bare = title.replace(/\s+/g, "");
  const hit = tokens.filter((token) => bare.includes(token.replace(/\s+/g, ""))).length;
  return hit * 2 >= tokens.length;
}

for (const [index, item] of items.entries()) {
  for (const target of targets) {
    const row = stats.get(target)!;
    try {
      const result = await provider.searchLegalSource(target, item.query, { limit: 3 });
      if (result.items.length > 0) row.reached += 1;
      const contributor = result.items.find((entry) => titleCoversQuery(entry.title, item.query));
      if (contributor) {
        row.contributed += 1;
        if (row.samples.length < 3) {
          row.samples.push(`"${item.query}" → ${contributor.title}`);
        }
      }
    } catch (error) {
      row.errors += 1;
      console.error(`  ! ${target} "${item.query}": ${(error as Error).message.slice(0, 90)}`);
    }
  }
  console.error(`[${index + 1}/${items.length}] ${item.query}`);
}

const lines: string[] = [];
lines.push(`# LB3 법원별 기여도 리포트 (dev ${items.length}쿼리)`);
lines.push("");
lines.push("| 법원 | target | 도달(≥1건) | 기여(제목 과반 매칭) | 에러 |");
lines.push("|---|---|---|---|---|");
for (const target of targets) {
  const row = stats.get(target)!;
  const pct = (value: number) => `${value}/${items.length} (${((value / items.length) * 100).toFixed(0)}%)`;
  lines.push(
    `| ${SOURCE_DESCRIPTORS[target].label} | \`${target}\` | ${pct(row.reached)} | ${pct(row.contributed)} | ${row.errors} |`,
  );
}
lines.push("");
for (const target of targets) {
  const row = stats.get(target)!;
  lines.push(`### ${SOURCE_DESCRIPTORS[target].label} (\`${target}\`) 표본`);
  lines.push(row.samples.length > 0 ? row.samples.map((s) => `- ${s}`).join("\n") : "- (기여 표본 없음)");
  lines.push("");
}

const out = path.resolve(__dirname, "../evidence/bench/2026-07-21-lb3-contribution-raw.md");
fs.writeFileSync(out, lines.join("\n"), "utf-8");
console.log(lines.join("\n"));
console.log(`\n→ ${out}`);
