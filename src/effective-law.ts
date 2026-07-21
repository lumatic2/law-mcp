/**
 * 시점 법령 조회 (TV3 step-1) — "그때 무엇이었나"에 답한다.
 *
 * 세법은 "몇 년 귀속이냐"가 곧 답이다. 같은 조문 번호라도 귀속연도가 다르면 요건이 다르고
 * (이월과세 5년→10년 등), 조세심판원조차 귀속년도를 사건 식별 1급 메타데이터로 쓴다.
 * 지금까지 우리는 **항상 현행만** 줬다 — 2023년 사건에 2026년 조문을 주면 그냥 틀린 답이다.
 *
 * ⚠ **무경고 함정**: `lawService.do?target=law&LM=소득세법&efYd=20230101` 은 `efYd` 를
 * **조용히 무시하고 현행을 반환**한다(2026-07-21 실측: 시행일 20260101, 조문 393개).
 * 시점 조회는 반드시 `target=eflaw` 로 가야 한다(같은 조건에서 시행일 20230101, 조문 338개).
 * 이 파일은 `law` 타깃으로 시점 조회하는 경로를 **가드로 막는다** — 막지 않으면 아무 경고 없이
 * 틀린 연도의 조문이 나간다.
 *
 * ⚠ **연혁 접근 경로는 `eflaw` 하나뿐이다.** `lsHistory` 는 HTML, `lsHstInf` 는 0건,
 * `eflawJo` 는 빈 응답이다(전부 실측 확인).
 */

/** 시점 조회에 쓸 수 있는 유일한 타깃. `law` 는 `efYd` 를 조용히 무시한다. */
export const EFFECTIVE_LAW_TARGET = "eflaw";

/**
 * `efYd` 를 붙여 부르면 안 되는 타깃. 부르면 인자가 무시되고 **현행이 조용히** 온다.
 * 목록에 있는 이름으로 시점 조회를 시도하면 즉시 실패시킨다 — 조용한 오답보다 시끄러운 실패가 낫다.
 */
const TARGETS_THAT_IGNORE_EF_YD = new Set(["law", "elaw", "lsDelegated"]);

export class EffectiveDateTargetError extends Error {
  constructor(target: string) {
    super(
      `시점 지정 조회에 '${target}' 타깃을 쓸 수 없다. `
      + `'${target}' 은(는) efYd 를 조용히 무시하고 현행 법령을 반환한다(2026-07-21 실측). `
      + `시점 조회는 '${EFFECTIVE_LAW_TARGET}' 로만 한다.`,
    );
    this.name = "EffectiveDateTargetError";
  }
}

/** 시점 조회 타깃을 고른다. 무시하는 타깃이면 던진다(조용한 현행 반환 차단). */
export function assertEffectiveDateTarget(target: string): void {
  if (TARGETS_THAT_IGNORE_EF_YD.has(target)) throw new EffectiveDateTargetError(target);
}

/**
 * 사용자가 주는 것은 보통 *귀속연도*("2023년 귀속")지 시행일자가 아니다.
 * 귀속연도 → 조회 시행일자 매핑 규칙: **해당 과세기간 종료일 시점에 시행 중이던 법령**.
 *
 * ⚠ 이 규칙은 **역년 과세**(소득세·부가세 등 12/31 종료)에만 안전하다. 법인세는 사업연도가
 * 정관으로 정해져 12/31 이 아닐 수 있다 — 그런 경우는 사용자가 날짜를 직접 줘야 하고,
 * 우리가 추정하면 안 된다. 그래서 이 함수는 **연도만** 받아 12/31 로 바꾸고, 그 사실을
 * 호출자가 응답에 명시하도록 규칙 문자열을 함께 낸다.
 */
export type AsOfResolution = {
  /**
   * 기준일 YYYYMMDD. ⚠ **이 값을 그대로 `efYd` 에 넣으면 안 된다.**
   *
   * 2026-07-21 실측: `eflaw&efYd=20231231` 은 **0 조문**을 반환한다. `efYd` 는 "이 날짜 시점"이
   * 아니라 **"시행일자가 정확히 이 날인 판"** 을 뜻한다. 앞선 프로브에서 `efYd=20230101` 이
   * 통했던 것은 그 날이 우연히 실제 시행일자였기 때문이다.
   *
   * 그래서 시점 조회는 두 단계다: ① `eflaw` 검색으로 그 법의 시행일자 목록을 받고
   * ② `pickVersionAsOf` 로 **기준일 이하의 가장 최근 판**을 고른 뒤 그 시행일자로 조회한다.
   */
  asOfDate: string;
  /** 응답에 실을 해석 규칙 — 사용자가 우리 추정을 검증할 수 있어야 한다 */
  rule: string;
};

/** `eflaw` 검색이 주는 한 판(version). */
export type LawVersion = {
  /** YYYYMMDD */
  시행일자: string;
  /** 시행예정 / 현행 / 연혁 */
  현행연혁코드?: string | null;
  공포일자?: string | null;
  법령일련번호?: string | null;
};

/**
 * 기준일 이하의 가장 최근 시행판을 고른다. 없으면 null — **가장 오래된 판으로 대체하지 않는다.**
 * (요청 시점에 그 법이 아직 없었다는 뜻이고, 그건 "모른다"가 정직한 답이다.)
 */
export function pickVersionAsOf<T extends LawVersion>(versions: T[], asOfDate: string): T | null {
  const eligible = versions
    .filter((v) => /^\d{8}$/.test(String(v.시행일자 ?? "")) && String(v.시행일자) <= asOfDate)
    .sort((a, b) => String(b.시행일자).localeCompare(String(a.시행일자)));
  return eligible[0] ?? null;
}

const YEAR_ONLY = /^(\d{4})년?$/;
const FULL_DATE = /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$/;

/**
 * 시점 인자를 `efYd` 로 해석한다. 해석할 수 없으면 null — **추정하지 않는다.**
 * 못 맞추면 현행으로 대체하지 않고 호출자가 명시 거절해야 한다(F20 원칙).
 */
export function resolveAsOf(asOf: string): AsOfResolution | null {
  const raw = asOf.trim();

  const full = FULL_DATE.exec(raw);
  if (full) {
    const [, y, m, d] = full;
    const year = Number(y);
    // 법제처 연혁이 닿지 않는 범위는 거절한다. 조용히 현행을 주는 것보다 낫다.
    if (year < 1948 || year > 2100) return null;
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    return { asOfDate: `${y}${m}${d}`, rule: `${y}-${m}-${d} 시점에 시행 중이던 법령` };
  }

  const yearOnly = YEAR_ONLY.exec(raw);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year < 1948 || year > 2100) return null;
    return {
      asOfDate: `${year}1231`,
      rule:
        `${year}년 귀속으로 보고 그 해 12월 31일 시점에 시행 중이던 법령을 조회했다. `
        + `역년 과세(소득세·부가가치세 등) 기준이며, 사업연도가 역년과 다른 법인세 등은 `
        + `정확한 시행일을 직접 지정해야 한다.`,
    };
  }

  return null;
}
