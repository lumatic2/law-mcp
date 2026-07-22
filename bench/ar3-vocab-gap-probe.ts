/**
 * AR3 기여도 프로브 ② — **어휘 공백 탐지기**의 분리력.
 *
 * 확정된 병목(2026-07-22): 일상어 질의는 정답 **법령 자체가 후보에 안 들어온다**(5건 중 4건
 * `lawRank=-1`). 법률 용어로 바꿔 물으면 0/5 → 3/5 로 복구된다. 즉 고칠 것은 순위가 아니라
 * **"지금 네 질의 어휘가 이 검색에 안 먹힌다"고 소비 에이전트에게 알리는 것**이다.
 *
 * 후보 신호: 질의 토큰이 결과 **어디에도**(법령명·`ai_articles` 제목) 나타나지 않으면
 * 그 검색은 어휘가 빗나간 것이다. 하드코딩 없음 — 법명·도메인·용어 사전이 하나도 없고,
 * 규칙은 "질의 어휘가 결과에 보이나" 뿐이다.
 *
 * 이 프로브는 신호가 **일상어에서 켜지고 법률어에서 꺼지는지**(분리력)만 잰다. `src/` 미변경.
 */
import { LawGoProvider } from "../src/providers/lawgo-provider.js";
import { tokenizeQuery } from "../src/article-match.js";

const bare = (s: string) => s.replace(/\s+/g, "");

/**
 * 질의 토큰 중 결과(법령명 + `ai_articles` 제목)에 실제로 나타난 비율.
 *
 * ⚠ **양방향으로 본다.** 한쪽만 보면 `기한후과세표준신고서`(질의)와 `기한 후 신고`(조문제목)가
 * 안 겹친 것으로 세어, 성공한 검색에까지 신호가 켜진다(2026-07-23 실측 오탐 3건 중 2건의 원인).
 * 법률 복합어는 조문제목보다 길다 — 토큰이 제목을 **포함**하는 쪽도 적중이다.
 */
function vocabCoverage(query: string, items: any[]): { covered: number; total: number } {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return { covered: 0, total: 0 };
  const pieces = items
    .flatMap((it) => [it.law_name ?? "", ...(it.ai_articles ?? []).map((a: any) => a.title ?? "")])
    .map(bare)
    .filter((s) => s.length >= 2);
  const haystack = pieces.join(" ");
  const covered = tokens.filter((raw) => {
    const t = bare(raw);
    return haystack.includes(t) || pieces.some((p) => t.includes(p));
  }).length;
  return { covered, total: tokens.length };
}

/**
 * ⚠ 라벨은 **"일상어냐"가 아니라 "실제로 정답에 도달했느냐"**다.
 *
 * 첫 판(2026-07-23)에서 일상어/법률어로 라벨을 달았다가 오탐 3/7 로 읽혔는데,
 * 그중 2건은 **검색이 실제로 실패한 케이스**였다 — 신호는 맞았고 내 라벨이 틀렸다.
 * 신호가 예측해야 할 것은 어투가 아니라 **실패**다.
 */
type Probe = { query: string; law: string; article: string };

const PROBES: Probe[] = [
  // 일상어판
  { query: "신고를 안 하고 기한이 지났는데 지금이라도 신고하는 방법", law: "국세기본법", article: "제45조의3" },
  { query: "세금을 잘못 매겼을 때 다투는 절차", law: "국세기본법", article: "제55조" },
  { query: "회사가 임원한테 준 퇴직금을 비용으로 얼마나 인정받나", law: "법인세법 시행령", article: "제44조" },
  { query: "외국에 낸 세금을 우리나라 세금에서 빼주는 한도", law: "법인세법", article: "제57조" },
  { query: "돈을 준 사람이 누구에게 얼마 줬는지 세무서에 내는 서류", law: "소득세법", article: "제164조" },
  // 법률어판 (같은 쟁점)
  { query: "법정신고기한 경과 후 기한후과세표준신고서 제출", law: "국세기본법", article: "제45조의3" },
  { query: "위법한 처분에 대한 심사청구 심판청구 불복", law: "국세기본법", article: "제55조" },
  { query: "임원 퇴직급여 손금산입 한도", law: "법인세법 시행령", article: "제44조" },
  { query: "외국납부세액공제 한도", law: "법인세법", article: "제57조" },
  { query: "지급명세서 제출의무", law: "소득세법", article: "제164조" },
  // 잘 되는 검색 — 신호가 꺼져야 한다
  { query: "부가가치세 간이과세자 적용 범위", law: "부가가치세법", article: "제61조" },
  { query: "종합소득과세표준 확정신고", law: "소득세법", article: "제70조" },
];

/** 문턱: 질의 토큰의 절반도 결과에 안 보이면 어휘가 빗나간 것으로 본다. */
const THRESHOLD = 0.5;

async function main(): Promise<void> {
  const provider = new LawGoProvider();
  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (const p of PROBES) {
    const res = await provider.searchLaw(p.query, { limit: 5 });
    const items = res.items ?? [];
    const { covered, total } = vocabCoverage(p.query, items);
    const ratio = total === 0 ? 1 : covered / total;
    const triggered = ratio < THRESHOLD;

    // 실제 결과: 정답 법령 + 정답 조문에 도달했나 (튜플 대조 — 조문번호 단독 비교 금지)
    const reached = items.some(
      (it: any) =>
        bare(it.law_name ?? "") === bare(p.law)
        && (it.ai_articles ?? []).some((a: any) => bare(a.article) === bare(p.article)),
    );
    const shouldTrigger = !reached;

    if (triggered && shouldTrigger) tp += 1;
    else if (triggered && !shouldTrigger) fp += 1;
    else if (!triggered && !shouldTrigger) tn += 1;
    else fn += 1;

    const mark = triggered === shouldTrigger ? "✅" : "❌";
    console.log(
      `${mark} ${reached ? "도달O" : "도달X"}  어휘적중 ${covered}/${total} (${Math.round(ratio * 100)}%) `
      + `${triggered ? "→ 신호 ON " : "→ 신호 off"}  "${p.query.slice(0, 28)}"`,
    );
  }

  const failures = tp + fn;
  const successes = fp + tn;
  console.log(`\n실패 케이스 ${failures}건 · 성공 케이스 ${successes}건`);
  console.log(`재현율(실패를 잡아냄):   ${tp}/${failures}`);
  console.log(`오탐(성공을 방해함):     ${fp}/${successes}  ← 낮아야 잘 되는 검색을 안 건드린다`);
  const prec = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 10 : null;
  console.log(`정밀도(신호 ON 중 실제 실패): ${prec ?? "—"}%`);
  console.log(`TP ${tp} · FP ${fp} · TN ${tn} · FN ${fn}`);
}

main().catch((e) => {
  process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
