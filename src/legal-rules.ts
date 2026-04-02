export type LegalRuleProfile = "legal" | "tax";

export interface LegalReplacementRule {
  bad: string;
  good: string;
  reason: string;
}

export interface LegalRuleIssue {
  term: string;
  suggested: string;
  reason: string;
  profile: LegalRuleProfile | "custom";
}

const PROFILE_RULES: Record<LegalRuleProfile, LegalReplacementRule[]> = {
  legal: [
    { bad: "갑", good: "당사자 A", reason: "계약 설명 문서에서는 당사자 표기를 풀어 쓰는 편이 가독성이 높습니다." },
    { bad: "을", good: "당사자 B", reason: "계약 설명 문서에서는 당사자 표기를 풀어 쓰는 편이 가독성이 높습니다." },
  ],
  tax: [
    { bad: "절세팁", good: "절세 방법", reason: "실무 문서에서는 구어체 표현보다 명시적 표현을 권장합니다." },
    { bad: "공제율", good: "공제 비율", reason: "복합 명사는 띄어쓴 표기를 우선 권장합니다." },
    { bad: "세금폭탄", good: "세부담 증가", reason: "자극적 표현보다 중립적 표현을 권장합니다." },
  ],
};

export function getProfileRules(profile: LegalRuleProfile): LegalReplacementRule[] {
  return PROFILE_RULES[profile];
}

export function evaluateLegalRuleIssues(
  terms: string[],
  profile: LegalRuleProfile,
  customRules: LegalReplacementRule[] = [],
): LegalRuleIssue[] {
  const uniqueTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  const issues: LegalRuleIssue[] = [];
  const profileRules = PROFILE_RULES[profile];

  for (const term of uniqueTerms) {
    for (const rule of profileRules) {
      if (term === rule.bad) {
        issues.push({
          term,
          suggested: rule.good,
          reason: rule.reason,
          profile,
        });
      }
    }

    for (const rule of customRules) {
      if (term === rule.bad) {
        issues.push({
          term,
          suggested: rule.good,
          reason: rule.reason,
          profile: "custom",
        });
      }
    }
  }

  return issues;
}
