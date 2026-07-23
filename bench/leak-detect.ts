/**
 * 유출 탐지기 (AR2 step-1).
 *
 * 맥락 문단은 **법률 비전문가가 할 법한 말**이어야 한다. 문단에 정답 법령명이나 조문번호가
 * 들어가면 에이전트는 찾은 게 아니라 **받아 적은** 것이고, 그 벤치는 낙관적으로 왜곡된다.
 * (리서치 실측: 유출 완화 전후 매치율 24.2% → 45.3% — 완화 안 하면 절반이 거품이다.)
 *
 * 그래서 **기계가 검열한다.** 사람 검토는 탐지기를 통과한 문단에 대해서만 한다 —
 * 사람이 먼저 보면 "이 정도는 괜찮겠지"가 쌓인다.
 *
 * ⚠ 반대 방향의 왜곡도 있다: 맥락이 지나치게 빈약하면 실제 사용자보다 무능한 질의자가 되어
 * 이번엔 비관적으로 왜곡된다. 그건 기계로 못 잡으니 작성 기준으로 막는다 —
 * **"실제 세무 대화에서 사람이 할 법한 말"**, 애매하면 채택하지 않고 버린다.
 */

/** 공백·중점·괄호를 지운 비교용 문자열. 표기 흔들림으로 검열을 빠져나가지 못하게 한다. */
function bare(value: string): string {
  return value.replace(/[\s·ㆍ()（）]/g, "");
}

export type LeakCase = {
  case_id: string;
  context: string | null;
  expected_laws?: string[] | null;
  expected_article?: string | null;
};

export type LeakFinding = {
  case_id: string;
  kind: "법령명" | "조문번호" | "법령어간";
  matched: string;
};

/**
 * 법령명에서 검열할 어간들을 뽑는다.
 *
 * 전체 이름만 막으면 "국세기본법" 을 "국세기본" 으로 적어 빠져나간다. 그래서 이름 자체와
 * 접미(`법`·`시행령`·`시행규칙`)를 뗀 어간을 함께 막는다.
 * 단 2글자 미만 어간은 보지 않는다 — 일상어와 우연히 겹쳐 오탐만 만든다.
 */
export function lawStems(lawName: string): string[] {
  const full = bare(lawName);
  const stems = new Set<string>([full]);
  const trimmed = full
    .replace(/시행규칙$/, "")
    .replace(/시행령$/, "")
    .replace(/법률$/, "")
    .replace(/법$/, "");
  if (trimmed.length >= 2) stems.add(trimmed);
  return [...stems].filter((s) => s.length >= 2);
}

/**
 * 조문번호에서 검열할 표기들을 뽑는다.
 * `법인세법 시행령 제44조` → `제44조`·`44조`·`제44조의N` 형태 모두를 막는다.
 */
export function articleForms(articleRef: string): string[] {
  const m = bare(articleRef).match(/제?(\d+)조(?:의(\d+))?/);
  if (!m) return [];
  const [, no, sub] = m;
  const forms = new Set<string>([`제${no}조`, `${no}조`]);
  if (sub) {
    forms.add(`제${no}조의${sub}`);
    forms.add(`${no}조의${sub}`);
  }
  return [...forms];
}

/** 문단 한 건을 검열한다. 유출이 없으면 빈 배열. */
export function detectLeak(item: LeakCase): LeakFinding[] {
  // 코퍼스(TF1)에는 아직 맥락이 없는 레코드가 섞여 있다 — 없는 문단은 유출도 없다.
  // 여기서 던지면 세트 전체 검열이 중단돼 오히려 유출을 못 잡는다.
  if (typeof item.context !== "string" || !item.context.trim()) return [];
  const haystack = bare(item.context);
  const findings: LeakFinding[] = [];

  for (const law of item.expected_laws ?? []) {
    for (const stem of lawStems(law)) {
      if (haystack.includes(stem)) {
        findings.push({
          case_id: item.case_id,
          kind: stem === bare(law) ? "법령명" : "법령어간",
          matched: stem,
        });
      }
    }
  }

  if (item.expected_article) {
    for (const form of articleForms(item.expected_article)) {
      if (haystack.includes(form)) {
        findings.push({ case_id: item.case_id, kind: "조문번호", matched: form });
      }
    }
  }

  return findings;
}

export function detectLeaks(items: LeakCase[]): LeakFinding[] {
  return items.flatMap(detectLeak);
}

// ─────────────────────────────────────────────────────────────────────────────

/** CLI: 세트 파일을 검열한다. 유출이 하나라도 있으면 exit 1 — 통과를 눈으로 판단하지 않는다. */
async function main(): Promise<void> {
  const path = process.argv[2] ?? "bench/corpus.json";
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    items: Array<LeakCase & { split?: string }>;
  };

  const findings = detectLeaks(data.items);
  for (const f of findings) {
    console.log(`LEAK  ${f.case_id}  [${f.kind}] "${f.matched}"`);
  }

  console.log(
    findings.length === 0
      ? `PASS — ${data.items.length}건 전부 유출 없음`
      : `\nFAIL — ${findings.length}건 유출 (${new Set(findings.map((f) => f.case_id)).size} 케이스)`,
  );
  if (findings.length > 0) process.exit(1);
}

function selftest(): void {
  // 탐지기가 실제로 무는지 증명한다 — 통과만 보고 "작동한다"고 하면 안 된다.
  const probes: Array<[string, boolean, string]> = [];

  const leaked = detectLeak({
    case_id: "p1",
    context: "국세기본법에서 기한 지나고 신고하면 어떻게 되나요?",
    expected_laws: ["국세기본법"],
    expected_article: "국세기본법 제45조의3",
  });
  probes.push(["① 법령명을 넣으면 거부", leaked.some((f) => f.kind === "법령명"), JSON.stringify(leaked[0] ?? {})]);

  const stem = detectLeak({
    case_id: "p2",
    context: "국세기본 쪽 규정이 궁금해요",
    expected_laws: ["국세기본법"],
  });
  probes.push(["② '법' 을 떼도 거부(어간)", stem.length > 0, stem[0]?.matched ?? ""]);

  const art = detectLeak({
    case_id: "p3",
    context: "45조의3 이 맞나요?",
    expected_laws: [],
    expected_article: "국세기본법 제45조의3",
  });
  probes.push(["③ 조문번호를 넣으면 거부", art.some((f) => f.kind === "조문번호"), art[0]?.matched ?? ""]);

  const spaced = detectLeak({
    case_id: "p4",
    context: "상속세 및 증여세 법 에서요",
    expected_laws: ["상속세 및 증여세법"],
  });
  probes.push(["④ 공백을 끼워도 거부", spaced.length > 0, spaced[0]?.matched ?? ""]);

  const clean = detectLeak({
    case_id: "p5",
    context: "작년 소득 신고를 깜빡했는데 지금이라도 낼 수 있는지 알고 싶어요.",
    expected_laws: ["국세기본법"],
    expected_article: "국세기본법 제45조의3",
  });
  probes.push(["⑤ 깨끗한 문단은 통과", clean.length === 0, `findings=${clean.length}`]);

  let failed = 0;
  for (const [name, ok, detail] of probes) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  — ${detail}`);
  }
  console.log(failed === 0 ? `\nPASS — 탐지기 ${probes.length}종 통과` : `\nFAIL — ${failed}건`);
  if (failed > 0) process.exit(1);
}

if (process.argv.includes("--selftest")) selftest();
else if (process.argv[1]?.includes("leak-detect")) {
  main().catch((e) => {
    process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
