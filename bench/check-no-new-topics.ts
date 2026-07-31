/**
 * 주제 무개입 증명 (TF2 step-2).
 *
 * **왜 있나**: 직전 horizon 의 홀드아웃이 변별력을 잃은 직접 원인은 에이전트가 문제의 *주제까지*
 * 골랐기 때문이다(10건 중 6건). 유출 탐지기는 문단의 **문자열**만 보므로 이 "구성에 의한 오염"을
 * 못 잡는다. 그래서 다른 축으로 잡는다 — **코퍼스의 모든 정답 조문이 통합 전 세트에 이미
 * 존재했는가.** 하나라도 새로 생겼으면 누군가 주제를 고른 것이다.
 *
 * 예외 ①: 라벨 규약(ADR 0001) 적용으로 본법→시행령이 바뀐 레코드. 이건 주제를 새로 만든 게
 * 아니라 **같은 질문의 정답을 규약대로 고친 것**이라 `label_rule` 필드로 표시하고 여기서 사유와
 * 함께 출력한다.
 *
 * 예외 ②(ADR 0004, 2026-08-01): **사용자가 승인한 결정적 규칙**이 산출한 주제 목록
 * (`bench/expansion/topics-*.json`). 사람이 주제 하나하나를 고르는 대신 선정 규칙을 골랐다.
 * 다만 인정 조건은 파일의 *유무*가 아니라 **digest 일치**다 — 목록에 손으로 한 줄 추가하면
 * `list_digest` 가, 규칙을 몰래 바꾸면 `rules_digest` 가 어긋나 차단된다. 그게 없으면 예외 경로가
 * "무조건 통과"로 변질돼 가드가 죽는다.
 *
 * 표시도 승인 목록도 없는 신규 주제는 실패다.
 *
 * 사용: npx tsx bench/check-no-new-topics.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const LEGACY_SETS = [
  "golden.json",
  "golden-v2.json",
  "golden-tax.json",
  "golden-tax-agentic.json",
];

type Case = {
  case_id: string;
  expected_article: string | null;
  expect_abstain?: boolean;
  label_rule?: string;
};

function normalize(article: string): string {
  return article.replace(/[\s·ㆍ]/g, "");
}

const EXPANSION_DIR = new URL("./expansion/", import.meta.url);
const RULES_FILE = new URL("./expansion/rules.approved.json", import.meta.url);

export type ApprovedTopics = {
  /** 승인 목록이 인정된 조문 표제 집합(정규화됨). digest 불일치면 빈 집합이다. */
  articles: Set<string>;
  /** 사람이 읽을 판정 근거 — 통과/차단 사유를 그대로 출력한다. */
  notes: string[];
  rejected: boolean;
};

/**
 * 승인 목록을 digest 로 검증해 인정 조문 집합을 만든다.
 *
 * `list_digest` 는 추출기가 `JSON.stringify({topics}, null, 2)` 로 계산했으므로 같은 방식으로
 * 재계산한다. 목록 파일의 다른 필드(생성일·법별 통계)는 digest 대상이 아니다 — 조문 목록 자체가
 * 손대지지 않았는지만 본다.
 */
export function loadApprovedTopics(dir: URL = EXPANSION_DIR, rulesFile: URL = RULES_FILE): ApprovedTopics {
  const notes: string[] = [];
  const articles = new Set<string>();
  let dirEntries: string[];
  try {
    dirEntries = readdirSync(dir).filter((f) => /^topics-.*\.json$/.test(f));
  } catch {
    return { articles, notes: ["승인 목록 디렉터리 없음 — 예외 경로 미적용"], rejected: false };
  }
  if (dirEntries.length === 0) {
    return { articles, notes: ["승인 목록 파일 없음 — 예외 경로 미적용"], rejected: false };
  }
  if (!existsSync(rulesFile)) {
    return {
      articles,
      notes: ["승인 목록은 있는데 규칙 파일(rules.approved.json)이 없다 — 예외 거절"],
      rejected: true,
    };
  }
  const rulesDigest = createHash("sha256").update(readFileSync(rulesFile, "utf8")).digest("hex").slice(0, 16);

  let rejected = false;
  for (const file of dirEntries.sort()) {
    const raw = readFileSync(new URL(file, dir), "utf8");
    const doc = JSON.parse(raw) as {
      rules_digest?: string;
      list_digest?: string;
      topics?: Array<{ topic_id: string; law: string; article_id: string }>;
    };
    const topics = doc.topics ?? [];
    const recomputed = createHash("sha256")
      .update(JSON.stringify({ topics }, null, 2))
      .digest("hex")
      .slice(0, 16);
    if (doc.rules_digest !== rulesDigest) {
      notes.push(
        `${file}: rules_digest 불일치 — 목록 \`${doc.rules_digest}\` vs 현재 규칙 \`${rulesDigest}\`. 예외 거절`,
      );
      rejected = true;
      continue;
    }
    if (doc.list_digest !== recomputed) {
      notes.push(
        `${file}: list_digest 불일치 — 기록 \`${doc.list_digest}\` vs 재계산 \`${recomputed}\`. 목록이 손대졌다. 예외 거절`,
      );
      rejected = true;
      continue;
    }
    for (const t of topics) articles.add(normalize(t.topic_id));
    notes.push(`${file}: digest 일치 — 승인 주제 ${topics.length}종 인정`);
  }
  return { articles, notes, rejected };
}

function main(): void {
  const legacy = new Set<string>();
  for (const file of LEGACY_SETS) {
    const data = JSON.parse(
      readFileSync(new URL(`../archive/bench/${file}`, import.meta.url), "utf8"),
    ) as { items: Case[] };
    for (const item of data.items) {
      if (item.expected_article) legacy.add(normalize(item.expected_article));
    }
  }

  const corpus = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8")) as {
    items: Case[];
  };

  const approved = loadApprovedTopics();

  const novel: Case[] = [];
  const ruled: Case[] = [];
  const byRule: Case[] = [];
  for (const item of corpus.items) {
    if (!item.expected_article) continue; // 기권 케이스는 정답 조문이 없다
    if (legacy.has(normalize(item.expected_article))) continue;
    if (item.label_rule) {
      ruled.push(item);
      continue;
    }
    // 예외 ② — 승인 목록(digest 검증 통과)에 있는 주제
    if (approved.articles.has(normalize(item.expected_article))) {
      byRule.push(item);
      continue;
    }
    novel.push(item);
  }

  console.log(`통합 전 세트의 정답 조문: ${legacy.size}종 (${LEGACY_SETS.length}파일)`);
  console.log(`코퍼스 레코드: ${corpus.items.length}건`);
  for (const note of approved.notes) console.log(`승인 목록 — ${note}`);
  if (byRule.length > 0) {
    console.log(`\n승인된 규칙이 정한 주제 ${byRule.length}건 (ADR 0004 예외 ②):`);
    for (const item of byRule.slice(0, 5)) console.log(`  ${item.case_id}  → ${item.expected_article}`);
    if (byRule.length > 5) console.log(`  … 외 ${byRule.length - 5}건`);
  }

  if (ruled.length > 0) {
    console.log(`\n규약 적용으로 바뀐 라벨 ${ruled.length}건 (주제 신설 아님):`);
    for (const item of ruled) {
      console.log(`  ${item.case_id}  → ${item.expected_article}  [${item.label_rule}]`);
    }
  }

  if (approved.rejected) {
    // digest 가 어긋난 승인 목록이 하나라도 있으면 통과시키지 않는다 — 목록을 손으로 고쳐
    // 주제를 밀어 넣는 경로를 막는 것이 이 예외의 유일한 안전장치다(ADR 0004 §2).
    console.log(`\nFAIL — 승인 목록 digest 검증 실패. 위 사유를 확인하라.`);
    process.exitCode = 1;
    return;
  }

  if (novel.length === 0) {
    console.log(`\nPASS — 근거 없는 신규 주제 0건. 주제는 통합 전 세트·규약 적용·승인된 규칙에서만 왔다.`);
    return;
  }

  console.log(`\nFAIL — 근거 없는 정답 조문 ${novel.length}건:`);
  for (const item of novel) console.log(`  ${item.case_id}  ${item.expected_article}`);
  console.log("  통합 전 세트에도, 승인 목록에도 없다. 규약 적용이면 label_rule 로 사유를 남겨야 한다.");
  process.exitCode = 1;
}

// 테스트가 이 모듈을 import 해 loadApprovedTopics 만 쓸 수 있게, 직접 실행일 때만 main 을 돈다.
if (process.argv[1] && /check-no-new-topics\.(ts|js)$/.test(process.argv[1])) {
  main();
}
