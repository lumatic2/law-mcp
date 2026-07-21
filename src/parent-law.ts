/**
 * 본법 승격 (UD4 step-1).
 *
 * 관측된 결함: 검색이 **하위법령만 찾고 근거 본법을 안 준다.** dev 실측에서
 * `육아휴직 신청 요건과 기간` → 남녀고용평등법 **시행령**, `매입세액 불공제 대상` →
 * 부가가치세법 **시행령·시행규칙** 만 왔다. 답을 반쯤 찾아 놓고 멈춘 상태다.
 *
 * 한국 법령의 하위법령은 이름이 `<본법명> 시행령` 꼴이라 **본법명을 문자열로 복원할 수 있다.**
 * 다만 이름 규칙만 믿으면 안 된다 — 복원한 이름이 실재하는 법인지 **조회로 확인한 뒤에만**
 * 편입한다. 확인 없이 넣으면 없는 법을 그럴듯하게 반환하는 UD0 급 오답이 된다.
 *
 * ⚠ 과적합 방어(F5): 이 모듈에는 **특정 법명·도메인·쿼리 토큰이 하나도 없다.** dev 2건을 보고
 * 만들었지만 규칙 자체는 이름 형태만 본다. 법명을 하드코딩하는 순간 그건 평가 세트에 맞춘
 * 것이지 검색이 좋아진 게 아니다.
 */

/** 본법 뒤에 붙는 하위법령 접미사. 긴 것부터 — `시행규칙` 이 `규칙` 보다 먼저 걸려야 한다. */
const SUBORDINATE_SUFFIXES = ["시행령", "시행규칙", "시행규정"] as const;

/**
 * 하위법령 이름에서 본법 이름을 복원한다. 하위법령이 아니면 null.
 *
 * `부가가치세법 시행령` → `부가가치세법` · `남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률
 * 시행령` → `남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률`
 *
 * 접미사만 남는 이름(`시행령` 단독)은 복원하지 않는다 — 본법명이 빈 문자열이 된다.
 */
export function parentLawName(lawName: string): string | null {
  const trimmed = lawName.trim();
  for (const suffix of SUBORDINATE_SUFFIXES) {
    if (!trimmed.endsWith(suffix)) continue;
    const parent = trimmed.slice(0, -suffix.length).trim();
    if (!parent) return null;
    // `X 시행령 시행규칙` 같은 것은 없지만, 복원 결과가 또 하위법령이면 한 번 더 벗기지 않는다 —
    // 관측된 적 없는 형태에 규칙을 늘리면 검증 못 한 경로가 생긴다.
    return parent;
  }
  return null;
}

/**
 * 결과 목록에서 **본법이 빠진 하위법령**들의 본법명을 뽑는다.
 *
 * 이미 목록에 있는 본법은 제외한다 — 그건 승격이 아니라 중복이다. 순서는 upstream 순위를
 * 따른다(상위 하위법령의 본법이 더 유력하다).
 */
export function missingParentNames(lawNames: string[]): string[] {
  const present = new Set(lawNames.map((name) => name.trim()));
  const missing: string[] = [];

  for (const name of lawNames) {
    const parent = parentLawName(name);
    if (!parent || present.has(parent) || missing.includes(parent)) continue;
    missing.push(parent);
  }

  return missing;
}
