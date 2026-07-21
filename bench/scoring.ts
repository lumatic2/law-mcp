/**
 * 채점 로직 (LB1 step-2). 러너(run.ts)에서 분리해 단위테스트 가능하게 둔다.
 * 법령명 비교는 공백·문장부호를 제거한 정규화 후 완전일치 — 부분일치를 쓰면
 * "민법"이 "민법 시행령"·"국제사법" 같은 이름에 걸려 점수가 부풀려진다.
 */

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** 정답 법령 중 하나라도 상위 k에 있으면 hit (복수 정답 허용 — bench/README.md 채점 규약). */
export function isHitAtK(returnedLawNames: string[], expectedLaws: string[], k: number): boolean {
  const top = returnedLawNames.slice(0, k).map(normalizeName);
  return expectedLaws.some((expected) => top.includes(normalizeName(expected)));
}

/**
 * "민법 제839조의2" 같은 조문 라벨을 법령명/조문번호로 분해한다.
 * 형식이 아니면 null — 러너는 이 항목을 조문 채점에서 제외한다.
 */
export function parseArticleLabel(label: string): { law: string; article: string } | null {
  const matched = label.trim().match(/^(.+?)\s+(제\d+조(?:의\d+)?)$/);
  if (!matched) return null;
  return { law: matched[1].trim(), article: matched[2] };
}

/** 조문 번호 일치 — "제28조"·"28조"·"28" 표기 차이를 흡수한다. */
export function isSameArticle(left: string, right: string): boolean {
  const canonical = (value: string) => value.replace(/\s+/g, "").replace(/^제/, "").replace(/조$/, "");
  return canonical(left) === canonical(right);
}

export type ItemOutcome = {
  query: string;
  domain: string;
  /** 세법 세트(golden-tax)의 질의 유형. 구 세트에는 없다 — 없으면 유형 분해를 하지 않는다. */
  type?: string;
  split: string;
  hit1: boolean;
  hit3: boolean;
  precHit: boolean;
  articleChecked: boolean;
  articleCorrect: boolean;
  /** assisted 모드: 정답 조문이 상위 3 조문 안에 있었는가 */
  articleCorrectAt3?: boolean;
  returned: string[];
  /** assisted 모드에서 도구가 고른 조문(표시형) */
  predictedArticles?: string[];
  /** blind 모드: 조문 라벨은 있는데 제품 응답에 조문이 실리지 않았다 (UD2 step-3) */
  articleShippingMiss?: boolean;
  /** 측정 대상이 아닌 사유 (조문 라벨 없음 등) — 에러와 구분한다 */
  skipped?: string;
  error?: string;

  /**
   * 시점 정확도 (TV3 이 채운다). TV1 에서는 **자리만** 둔다.
   *
   * 왜 자리를 미리 두나: 세법에서 "몇 년 귀속이냐"는 조문 번호만큼 중요한 축이고, 이 축이
   * 없으면 TV3 완료 후 기준선을 다시 재야 한다. 다만 **켜지지 않은 축을 0% 로 보고하면
   * "시점을 다 틀렸다"는 거짓 주장**이 되므로, 측정하지 않은 상태는 반드시 null(n/a)이다.
   */
  asOfChecked?: boolean;
  asOfCorrect?: boolean;
};

export type Summary = {
  total: number;
  scored: number;
  errors: number;
  recall_at_1: number;
  recall_at_3: number;
  precedent_hit_rate: number;
  article_accuracy: number | null;
  article_checked: number;
  by_domain: Record<string, { total: number; recall_at_3: number }>;
  /**
   * 유형별 분해 (TV1). 세법 세트는 domain 이 전부 "세법"이라 by_domain 이 한 칸으로 뭉개진다 —
   * **어느 유형이 약한지**가 TV2~TV5 의 우선순위 근거이므로 유형 축이 따로 필요하다.
   * 유형 라벨이 없는 구 세트에서는 빈 객체다.
   */
  by_type: Record<string, { total: number; recall_at_3: number; article_accuracy: number | null }>;
  /** 시점 정확도 — TV3 전에는 측정하지 않으므로 null(n/a). 0 으로 내면 거짓 주장이 된다. */
  as_of_accuracy: number | null;
  as_of_checked: number;
};

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : Number((part / whole).toFixed(4));
}

export type AssistedSummary = {
  total: number;
  measured: number;
  skipped: number;
  errors: number;
  accuracy_at_1: number;
  accuracy_at_3: number;
};

/**
 * assisted 모드 요약 — **조문 도달** 지표다. blind 의 recall(법령 찾기)과 성격이 달라
 * 합산하지 않는다(계획 결정: 두 수치를 섞으면 "법령 찾기 성능"으로 오독된다).
 */
export function summarizeAssisted(outcomes: ItemOutcome[]): AssistedSummary {
  const errors = outcomes.filter((o) => o.error).length;
  const skipped = outcomes.filter((o) => !o.error && o.skipped).length;
  const measured = outcomes.filter((o) => !o.error && !o.skipped && o.articleChecked);
  return {
    total: outcomes.length,
    measured: measured.length,
    skipped,
    errors,
    accuracy_at_1: ratio(measured.filter((o) => o.articleCorrect).length, measured.length),
    accuracy_at_3: ratio(measured.filter((o) => o.articleCorrectAt3).length, measured.length),
  };
}

/** 에러 항목은 scored 에서 빼되 total 에는 남긴다 — 실패를 0점으로 숨기지 않기 위함. */
export function summarize(outcomes: ItemOutcome[]): Summary {
  const scored = outcomes.filter((o) => !o.error);
  const byDomain: Record<string, { total: number; recall_at_3: number }> = {};
  for (const outcome of scored) {
    const bucket = (byDomain[outcome.domain] ??= { total: 0, recall_at_3: 0 });
    bucket.total += 1;
    if (outcome.hit3) bucket.recall_at_3 += 1;
  }
  for (const key of Object.keys(byDomain)) {
    byDomain[key].recall_at_3 = ratio(byDomain[key].recall_at_3, byDomain[key].total);
  }

  const articleChecked = scored.filter((o) => o.articleChecked);

  const byType: Summary["by_type"] = {};
  for (const outcome of scored) {
    if (!outcome.type) continue;
    const bucket = (byType[outcome.type] ??= { total: 0, recall_at_3: 0, article_accuracy: null });
    bucket.total += 1;
    if (outcome.hit3) bucket.recall_at_3 += 1;
  }
  for (const key of Object.keys(byType)) {
    const inType = scored.filter((o) => o.type === key);
    const checked = inType.filter((o) => o.articleChecked);
    byType[key].recall_at_3 = ratio(byType[key].recall_at_3, byType[key].total);
    byType[key].article_accuracy = checked.length
      ? ratio(checked.filter((o) => o.articleCorrect).length, checked.length)
      : null;
  }

  const asOfChecked = scored.filter((o) => o.asOfChecked);

  return {
    total: outcomes.length,
    scored: scored.length,
    errors: outcomes.length - scored.length,
    recall_at_1: ratio(scored.filter((o) => o.hit1).length, scored.length),
    recall_at_3: ratio(scored.filter((o) => o.hit3).length, scored.length),
    precedent_hit_rate: ratio(scored.filter((o) => o.precHit).length, scored.length),
    article_accuracy: articleChecked.length
      ? ratio(articleChecked.filter((o) => o.articleCorrect).length, articleChecked.length)
      : null,
    article_checked: articleChecked.length,
    by_domain: byDomain,
    by_type: byType,
    // 측정한 항목이 0 이면 null(n/a). TV3 이 asOfChecked 를 켜기 전까지는 항상 null 이다.
    as_of_accuracy: asOfChecked.length
      ? ratio(asOfChecked.filter((o) => o.asOfCorrect).length, asOfChecked.length)
      : null,
    as_of_checked: asOfChecked.length,
  };
}

/**
 * 반복 측정 집계 (UD1 step-2).
 *
 * 왜 필요한가: 같은 코드로 공식 러너를 두 번 돌려 72.0%/76.0% 가 나왔다(LB5). upstream 이
 * 비결정적이라 1회 측정으로는 4%p 이하 차이를 판정할 수 없다. 표준편차를 붙여야
 * "이득인가 노이즈인가"를 말할 수 있다.
 *
 * 표본표준편차(n-1)를 쓴다 — 우리는 모집단이 아니라 실행 표본을 잰다.
 * n=1 이면 편차를 **0 이 아니라 null** 로 낸다. 0 은 "흔들리지 않았다"는 거짓 주장이 된다.
 */
export type RepeatStats = {
  n: number;
  mean: number;
  sd: number | null;
  min: number;
  max: number;
  /** 채택 문턱 — 이 값을 넘는 차이만 이득으로 인정한다. n=1 이면 판정 불가(null). */
  threshold_2sd: number | null;
  values: number[];
};

export function aggregateRepeats(values: number[]): RepeatStats {
  if (values.length === 0) throw new Error("반복 측정값이 비어 있다");
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd =
    n < 2 ? null : Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1));
  return {
    n,
    mean,
    sd,
    min: Math.min(...values),
    max: Math.max(...values),
    threshold_2sd: sd === null ? null : 2 * sd,
    values,
  };
}
