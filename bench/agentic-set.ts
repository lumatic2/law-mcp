/**
 * 에이전트형 평가 세트 로더 (AR2 step-2).
 *
 * **홀드아웃 봉인이 이 파일의 존재 이유다.** 세트를 직접 `readFileSync` 하면 봉인을 우회하게
 * 되므로, 읽는 경로를 여기 하나로 모은다. 봉인은 `bench/run.ts` 의 `assertHoldoutSeal` 을
 * **재사용**한다 — 봉인 구현이 둘이면 하나만 고쳐지고 다른 하나로 새는 날이 온다.
 *
 * ⚠ 홀드아웃 개봉은 **되돌릴 수 없다.** 열고 나면 그 수치를 보고 튜닝할 수 없다.
 */
import { readFileSync } from "node:fs";
import { assertHoldoutSeal } from "./run.js";

export type AgenticCase = {
  case_id: string;
  split: "dev" | "holdout";
  type: string;
  context: string;
  expected_laws: string[] | null;
  expected_article: string | null;
  /** 현행법에 답이 없는 케이스 — 에이전트는 기권을 선언해야 한다. */
  expect_abstain?: boolean;
  /** 왜 답이 없는지. 라벨을 나중에 검증할 수 있게 남긴다. */
  abstain_reason?: string;
};

/** TF1 이후 정본은 단일 코퍼스다. 구 `golden-tax-agentic.json` 은 `archive/bench/` 로 갔다. */
export const AGENTIC_SET_PATH = new URL("./corpus.json", import.meta.url);

/**
 * split 하나를 읽는다. `holdout` 은 `sealBroken` 없이는 **던진다**.
 *
 * 기본값을 `false` 로 둔 것이 요점이다 — 실수로 부르면 열리지 않는다.
 *
 * 코퍼스는 형식 중립이라 맥락(`context`)이 없는 레코드가 섞여 있다 — 에이전트 루프는 맥락을
 * 던지는 쪽이라 맥락 없는 레코드는 **걸러낸다**(TF2 가 전건을 채우면 자연히 전부 들어온다).
 * `provenance` 를 주면 특정 옛 세트로 좁혀 **과거 측정을 그대로 재현**할 수 있다.
 */
export function loadAgenticSet(
  split: "dev" | "holdout",
  sealBroken = false,
  opts: { provenance?: string } = {},
): AgenticCase[] {
  assertHoldoutSeal(split, sealBroken);
  const data = JSON.parse(readFileSync(AGENTIC_SET_PATH, "utf8")) as {
    items: (AgenticCase & { context: string | null; provenance?: string })[];
  };
  return data.items.filter(
    (item) =>
      item.split === split
      && typeof item.context === "string"
      && item.context.trim().length > 0
      && (!opts.provenance || item.provenance === opts.provenance),
  );
}

/** 채점기가 쓰는 모양으로 바꾼다 — 기권 케이스는 `expected` 가 `null` 이다. */
export function toExpected(item: AgenticCase): {
  expected: { law_name: string; article_no: string } | null;
  expect_abstain: boolean;
} {
  if (item.expect_abstain || !item.expected_laws?.length || !item.expected_article) {
    return { expected: null, expect_abstain: true };
  }
  // "법인세법 시행령 제44조" → 법령명과 조문번호를 가른다.
  const match = item.expected_article.match(/^(.*?)\s*(제\d+조(?:의\d+)?)$/);
  return {
    expected: {
      law_name: match ? match[1].trim() : item.expected_laws[0],
      article_no: match ? match[2] : item.expected_article,
    },
    expect_abstain: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function selftest(): void {
  const probes: Array<[string, boolean, string]> = [];

  const dev = loadAgenticSet("dev");
  probes.push(["① dev 는 그냥 열린다", dev.length > 0, `${dev.length}건`]);

  // 봉인 — 플래그 없이 부르면 던져야 한다.
  let sealed = false;
  let msg = "";
  try {
    loadAgenticSet("holdout");
  } catch (e) {
    sealed = true;
    msg = (e as Error).message.split("\n")[0];
  }
  probes.push(["② holdout 은 플래그 없이 거부", sealed, msg]);

  // 양방향 확인 — 봉인이 상시 열려 있는 상태를 배제한다.
  const opened = loadAgenticSet("holdout", true);
  probes.push(["③ 플래그가 있으면 열린다", opened.length > 0, `${opened.length}건`]);

  const abstain = dev.filter((c) => c.expect_abstain);
  probes.push([
    "④ 기권 케이스가 섞여 있다",
    abstain.length > 0 && abstain.every((c) => Boolean(c.abstain_reason)),
    `${abstain.length}건, 전부 사유 있음`,
  ]);

  const mapped = toExpected(dev.find((c) => c.case_id === "ag-d02")!);
  probes.push([
    "⑤ 법령명·조문번호 분리",
    mapped.expected?.law_name === "법인세법 시행령" && mapped.expected?.article_no === "제44조",
    JSON.stringify(mapped.expected),
  ]);

  const ab = toExpected(abstain[0]);
  probes.push(["⑥ 기권 케이스는 expected=null", ab.expected === null && ab.expect_abstain, ""]);

  let failed = 0;
  for (const [name, ok, detail] of probes) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  — ${detail}`);
  }
  console.log(failed === 0 ? `\nPASS — 세트 로더 ${probes.length}종 통과` : `\nFAIL — ${failed}건`);
  if (failed > 0) process.exit(1);
}

if (process.argv.includes("--selftest")) selftest();
