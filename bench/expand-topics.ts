/**
 * 코퍼스 세법 확장 — 결정적 주제 추출기 (M5 step-1).
 *
 * ADR 0002 §2 는 "주제는 사람이 정한다"를 요구하고, ADR 0004 개정으로 **사람이 승인한 결정적
 * 규칙**이 동급 출처가 됐다. 그래서 이 스크립트는 **규칙을 갖고 있지 않다** —
 * `bench/expansion/rules.approved.json` 만 읽는다. 키워드·할당량·간격·봉인식을 코드에 심으면
 * 그건 승인된 규칙이 아니라 이 파일을 쓴 에이전트의 취향이다.
 *
 * 실행: npx tsx bench/expand-topics.ts [--out <dir>]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { LAW_API_OC, LAW_SEARCH_BASE_URL, LAW_SERVICE_BASE_URL } from "../src/config.js";

type Rules = {
  version: string;
  laws: Array<{ k: number; name: string }>;
  quota_per_law: number;
  title_keywords: string[];
  name_match: string;
  on_name_mismatch: string;
  selection: { method: string; sort: string };
  underfill_fallback: { method: string };
  duplicate_policy: { against: string; action: string };
  sealed_assignment: {
    method: string;
    largest_count: number;
    expected_total: number;
  };
  provenance_for_new_items: string;
};

type Article = { id: string; no: number; branch: number; title: string };
type Picked = Article & { law: string; k: number; i: number; sealed: boolean; via: "keyword" | "fallback" };

const RULES_PATH = new URL("./expansion/rules.approved.json", import.meta.url);
const rulesRaw = readFileSync(RULES_PATH, "utf8");
const rules = JSON.parse(rulesRaw) as Rules;
const rulesDigest = createHash("sha256").update(rulesRaw).digest("hex").slice(0, 16);

if (!LAW_API_OC) {
  console.error("LAW_API_OC 없음 — 상류 조회 불가. .env 를 확인하라.");
  process.exit(1);
}

const outArg = process.argv.indexOf("--out");
const outDir = outArg >= 0 ? process.argv[outArg + 1] : "bench/expansion";

/** 기존 코퍼스 주제 — 중복 제외 대상(규칙 §6). */
const corpus = JSON.parse(readFileSync("bench/corpus.json", "utf8")) as {
  items: Array<{ topic_id: string }>;
};
const existingTopics = new Set(corpus.items.map((i) => i.topic_id));

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`상류 ${res.status}: ${url.replace(LAW_API_OC, "***")}`);
  return res.json();
}

/** 법령명 완전일치로 MST 를 찾는다. 규칙 §2: 불일치면 폴백 없이 중단. */
async function resolveMst(name: string): Promise<string> {
  const url = `${LAW_SEARCH_BASE_URL}?OC=${LAW_API_OC}&target=law&type=JSON&display=100&query=${encodeURIComponent(name)}`;
  const j = await fetchJson(url);
  let rows = j.LawSearch?.law ?? [];
  if (!Array.isArray(rows)) rows = [rows];
  const exact = rows.filter((r: any) => String(r.법령명한글).trim() === name && String(r.현행연혁코드) === "현행");
  if (exact.length === 0) {
    // 규칙 on_name_mismatch: abort — 부분일치 폴백은 "지방세법"이 지방교부세법으로 바뀌는
    // 조용한 오답을 만든다(2026-08-01 프로브 실측).
    throw new Error(`법령명 완전일치 실패: "${name}" — 폴백 금지(규칙 on_name_mismatch=abort)`);
  }
  return String(exact[0].법령일련번호);
}

/** 현행본 실체 조문 목록. 식별자 = 조문번호[-가지번호] (규칙 §2). */
async function fetchArticles(mst: string): Promise<Article[]> {
  const url = `${LAW_SERVICE_BASE_URL}?OC=${LAW_API_OC}&target=law&type=JSON&MST=${mst}`;
  const j = await fetchJson(url);
  let rows = j.법령?.조문?.조문단위 ?? [];
  if (!Array.isArray(rows)) rows = [rows];
  const out: Article[] = [];
  for (const r of rows) {
    if (String(r.조문여부 ?? "") !== "조문") continue;
    const title = typeof r.조문제목 === "string" ? r.조문제목.trim() : "";
    if (!title) continue;
    const no = Number(r.조문번호);
    const branch = Number(r.조문가지번호 ?? 0) || 0;
    if (!Number.isFinite(no)) continue;
    out.push({ id: branch ? `${no}-${branch}` : String(no), no, branch, title });
  }
  out.sort((a, b) => a.no - b.no || a.branch - b.branch);
  return out;
}

/** 균등 간격 샘플링 — 상위 N 은 총칙 편향을 만들어 쓰지 않는다(규칙 §5). */
function evenInterval<T>(pool: T[], count: number): T[] {
  if (pool.length <= count) return [...pool];
  const picked: T[] = [];
  for (let n = 0; n < count; n += 1) {
    const idx = Math.floor(((n + 0.5) * pool.length) / count);
    picked.push(pool[Math.min(idx, pool.length - 1)]);
  }
  return picked;
}

/** 중복(기존 topic_id)이면 다음 간격 후보로 대체한다(규칙 §6). */
function pickWithDupSkip(
  pool: Article[],
  count: number,
  lawName: string,
  log: string[],
): Article[] {
  const chosen: Article[] = [];
  const used = new Set<string>();
  let widened = 0;
  // 간격 샘플 → 중복이면 풀에서 그 다음 후보로 밀어낸다.
  const ordered = evenInterval(pool, Math.min(count * 3, pool.length));
  for (const cand of ordered) {
    if (chosen.length >= count) break;
    const topicId = `${lawName} 제${cand.id.replace("-", "조의")}조`.replace("조의", "조의");
    const canonical = canonicalTopicId(lawName, cand);
    if (used.has(canonical)) continue;
    if (existingTopics.has(canonical)) {
      log.push(`  - 중복 제외: ${canonical} (기존 코퍼스 보유) → 다음 간격 후보로 대체`);
      widened += 1;
      continue;
    }
    void topicId;
    used.add(canonical);
    chosen.push(cand);
  }
  if (widened) log.push(`  - 중복 대체 ${widened}건`);
  return chosen;
}

function canonicalTopicId(lawName: string, a: Article): string {
  return a.branch ? `${lawName} 제${a.no}조의${a.branch}` : `${lawName} 제${a.no}조`;
}

async function main() {
  const log: string[] = [
    `# 확장 주제 선정 로그`,
    ``,
    `- 규칙 파일: \`bench/expansion/rules.approved.json\` (digest \`${rulesDigest}\`, ${rules.version})`,
    `- 실행: \`npx tsx bench/expand-topics.ts\``,
    `- 결정성 주장 범위: 동일 규칙 파일 + 동일 MST. 상류 개정 시 재현이 깨질 수 있다.`,
    ``,
  ];
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const perLaw: Array<{ law: string; k: number; mst: string; total: number; matched: number; picks: Picked[] }> = [];

  for (const law of rules.laws) {
    const mst = await resolveMst(law.name);
    const articles = await fetchArticles(mst);
    const matched = articles.filter((a) => rules.title_keywords.some((kw) => a.title.includes(kw)));
    log.push(`## ${law.name} (k=${law.k})`);
    log.push(`- MST \`${mst}\` · 조회일 ${fetchedAt} · 실체조문 ${articles.length} · 키워드 매칭 ${matched.length}`);

    let picks = pickWithDupSkip(matched, rules.quota_per_law, law.name, log).map(
      (a) => ({ ...a, via: "keyword" as const }),
    );
    if (picks.length < rules.quota_per_law) {
      // 규칙 §4 폴백 — 장 제목 경로는 폐기됐다(조세범 처벌법에 편·장이 없다).
      const need = rules.quota_per_law - picks.length;
      const taken = new Set(picks.map((p) => p.id));
      const rest = articles.filter((a) => !taken.has(a.id));
      const extra = pickWithDupSkip(rest, need, law.name, log).map((a) => ({ ...a, via: "fallback" as const }));
      log.push(`- 할당량 미달 → 폴백(표제 보유 실체 조문 전체 균등간격) ${extra.length}건 보충`);
      picks = [...picks, ...extra];
    }
    picks.sort((a, b) => a.no - b.no || a.branch - b.branch);

    const withIndex: Picked[] = picks.map((p, idx) => ({
      ...p,
      law: law.name,
      k: law.k,
      i: idx + 1,
      sealed: false,
    }));
    perLaw.push({ law: law.name, k: law.k, mst, total: articles.length, matched: matched.length, picks: withIndex });
  }

  // 봉인 회전 배정 (규칙 §7): i ≡ k (mod 5) 1건 + 조문 총수 상위 8법은 i ≡ k+2 (mod 5) 1건 추가.
  const largest = new Set(
    [...perLaw].sort((a, b) => b.total - a.total).slice(0, rules.sealed_assignment.largest_count).map((x) => x.law),
  );
  const mod5 = (v: number) => ((v % 5) + 5) % 5;
  for (const entry of perLaw) {
    for (const p of entry.picks) {
      if (mod5(p.i) === mod5(entry.k)) p.sealed = true;
      if (largest.has(entry.law) && mod5(p.i) === mod5(entry.k + 2)) p.sealed = true;
    }
  }

  const all = perLaw.flatMap((e) => e.picks);
  const sealedCount = all.filter((p) => p.sealed).length;

  const topics = all.map((p) => ({
    topic_id: canonicalTopicId(p.law, p),
    law: p.law,
    law_index: p.k,
    sample_index: p.i,
    article_id: p.id,
    article_title: p.title,
    split: p.sealed ? "sealed" : "dev",
    selected_via: p.via,
    provenance: rules.provenance_for_new_items,
  }));

  const listBody = JSON.stringify({ topics }, null, 2);
  const listDigest = createHash("sha256").update(listBody).digest("hex").slice(0, 16);
  const doc = {
    version: rules.version,
    generated: fetchedAt,
    rules_digest: rulesDigest,
    list_digest: listDigest,
    laws: perLaw.map((e) => ({ law: e.law, k: e.k, mst: e.mst, total: e.total, matched: e.matched })),
    counts: { total: topics.length, dev: topics.length - sealedCount, sealed: sealedCount },
    topics,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/topics-2026-08-01.json`, JSON.stringify(doc, null, 2) + "\n", "utf8");

  log.push(``, `## 합계`, `- 주제 ${topics.length}건 (dev ${topics.length - sealedCount} / sealed ${sealedCount})`);
  log.push(`- 조문 총수 상위 ${rules.sealed_assignment.largest_count}법(추가 봉인 대상): ${[...largest].join(" · ")}`);
  log.push(`- list_digest \`${listDigest}\``);
  log.push(``, `## 봉인 위치 분포 (회전 규칙 검증 — 특정 위치 편중이 없어야 한다)`);
  for (let i = 1; i <= rules.quota_per_law; i += 1) {
    const n = all.filter((p) => p.sealed && p.i === i).length;
    log.push(`- 샘플 순서 i=${i}: ${n}건`);
  }
  writeFileSync(`${outDir}/selection-log.md`, log.join("\n") + "\n", "utf8");

  console.log(`주제 ${topics.length}건 (dev ${topics.length - sealedCount} / sealed ${sealedCount})`);
  console.log(`rules_digest=${rulesDigest} list_digest=${listDigest}`);
  console.log(`→ ${outDir}/topics-2026-08-01.json · ${outDir}/selection-log.md`);
}

main().catch((e) => {
  console.error(`추출 실패: ${(e as Error).message}`);
  // `process.exit()` 를 쓰지 않는다 — 진행 중인 fetch 핸들이 닫히는 중이면 Windows libuv 가
  // assertion 으로 죽어 종료 코드가 127 로 나온다(2026-08-01 실측). 호출자가 "규칙 위반으로
  // 중단"과 "크래시"를 구분할 수 있게 exitCode 만 세우고 자연 종료를 기다린다.
  process.exitCode = 1;
});
