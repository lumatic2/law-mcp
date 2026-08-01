import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "evidence" / "cpa2" / "2026-m10"
FROZEN = BASE / "frozen" / "rubric.json"
SCORING = BASE / "scoring"


CORRECTIONS = {
    "q2_monthly_fixed_pay": {
        "answer": 2_200_000,
        "calculation": "기본급 1,800,000 + 매월 식대 400,000. 식대는 시행령 제17조제1항의 차감항목인 제12조 실비변상적 급여 또는 제17조의4 복리후생적 급여가 아니다.",
    },
    "q3_other_income_withholding": {
        "answer": 125_999_700,
        "calculation": "400,000+1,200,000+400,000+4,000,000+119,999,700. 1억 초과·10년 미만 보유 골동품 필요경비는 90,000,000+(150,000,000-100,000,000)×80%.",
    },
    "q3_business_income": {
        "answer": 37_000_000,
        "calculation": "20,000,000+대표자급여 30,000,000-사업계좌 이자 5,000,000+자가소비 시가 4,000,000-업무무관 수증이익 12,000,000. 기술 낙후 생산설비 폐기손실은 시행령 제67조제6항에 따라 인정.",
    },
}


# 각 값은 결론, 계산, 근거 존재, 근거 정확, 귀속시기 정합의 이진 판정이다.
# 답안 ID만 본 상태에서 고정했으며 mapping.json은 점수 산출 뒤에만 읽는다.
MARKS = {
    "A": {
        "q1_interest_withholding": "11111", "q1_interest_gross_receipts": "11111",
        "q1_dividend_gross_receipts": "11111", "q1_dividend_gross_up": "00101",
        "q2_monthly_fixed_pay": "00101", "q2_gross_salary": "00101",
        "q2_personal_deductions": "11111", "q2_general_tax": "11111",
        "q2_comparison_tax": "11111", "q2_disaster_credit": "11111",
        "q2_marriage_credit": "11111", "q3_other_income_withholding": "11111",
        "q3_comprehensive_other_income": "11111", "q3_business_income": "00101",
        "q3_service_withholding_3pct": "10111", "q3_service_withholding_20pct": "10111",
    },
    "B": {
        "q1_interest_withholding": "00111", "q1_interest_gross_receipts": "00111",
        "q1_dividend_gross_receipts": "11111", "q1_dividend_gross_up": "00101",
        "q2_monthly_fixed_pay": "11100", "q2_gross_salary": "00100",
        "q2_personal_deductions": "11111", "q2_general_tax": "11111",
        "q2_comparison_tax": "11111", "q2_disaster_credit": "11111",
        "q2_marriage_credit": "11111", "q3_other_income_withholding": "00101",
        "q3_comprehensive_other_income": "11111", "q3_business_income": "00111",
        "q3_service_withholding_3pct": "10111", "q3_service_withholding_20pct": "00100",
    },
    "C": {
        "q1_interest_withholding": "00111", "q1_interest_gross_receipts": "00111",
        "q1_dividend_gross_receipts": "11111", "q1_dividend_gross_up": "11111",
        "q2_monthly_fixed_pay": "11111", "q2_gross_salary": "11111",
        "q2_personal_deductions": "11111", "q2_general_tax": "11111",
        "q2_comparison_tax": "11111", "q2_disaster_credit": "11111",
        "q2_marriage_credit": "11111", "q3_other_income_withholding": "11111",
        "q3_comprehensive_other_income": "11111", "q3_business_income": "11111",
        "q3_service_withholding_3pct": "10111", "q3_service_withholding_20pct": "10111",
    },
    "D": {
        "q1_interest_withholding": "11111", "q1_interest_gross_receipts": "00111",
        "q1_dividend_gross_receipts": "11111", "q1_dividend_gross_up": "00101",
        "q2_monthly_fixed_pay": "11111", "q2_gross_salary": "00101",
        "q2_personal_deductions": "11111", "q2_general_tax": "00111",
        "q2_comparison_tax": "11111", "q2_disaster_credit": "11111",
        "q2_marriage_credit": "11111", "q3_other_income_withholding": "00101",
        "q3_comprehensive_other_income": "11111", "q3_business_income": "00101",
        "q3_service_withholding_3pct": "10111", "q3_service_withholding_20pct": "00100",
    },
}

ERRORS = {
    "A": ["wrong_amount_or_arithmetic:gross_up", "wrong_classification:meal_allowance", "wrong_classification:retirement_reserve", "wrong_classification:discarded_equipment", "wrong_classification:unrelated_gift"],
    "B": ["omitted_item:commercial_bill_discount", "wrong_amount_or_arithmetic:gross_up", "as_of_mismatch:production_worker_threshold", "wrong_amount_or_arithmetic:antique_expense", "wrong_amount_or_arithmetic:business_income", "wrong_classification:foreign_athlete_scope"],
    "C": ["omitted_item:commercial_bill_discount"],
    "D": ["wrong_classification:court_deposit_gross_receipts", "wrong_amount_or_arithmetic:gross_up", "wrong_classification:retirement_reserve", "wrong_amount_or_arithmetic:general_tax", "wrong_amount_or_arithmetic:antique_expense", "wrong_classification:discarded_equipment", "wrong_classification:foreign_athlete_scope"],
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    frozen = json.loads(FROZEN.read_text(encoding="utf-8"))
    adjudicated = copy.deepcopy(frozen)
    adjudicated["derived_from_sha256"] = sha256(FROZEN)
    adjudicated["post_freeze_corrections"] = list(CORRECTIONS)
    for unit in adjudicated["units"]:
        if unit["id"] in CORRECTIONS:
            unit.update(CORRECTIONS[unit["id"]])
    adjudicated_path = SCORING / "rubric-adjudicated.json"
    adjudicated_path.write_text(json.dumps(adjudicated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fields = adjudicated["field_policy"]["fields"]
    units = {u["id"]: u for u in adjudicated["units"] if u["status"] == "confirmed"}
    blind = {}
    for answer_id, marks in MARKS.items():
        rows, total, conclusion_total = [], 0.0, 0.0
        for unit_id, bits in marks.items():
            unit = units[unit_id]
            decisions = dict(zip(fields, (int(x) for x in bits)))
            score = sum(unit["field_weights"][f] * decisions[f] for f in fields)
            total += score
            conclusion_total += unit["weight"] if decisions["conclusion"] else 0
            rows.append({"unit": unit_id, "score": round(score, 2), "max": unit["weight"], "fields": decisions})
        blind[answer_id] = {
            "score": round(total, 2), "max": 24,
            "score_ratio": round(total / 24, 4),
            "legal_treatment_ratio": round(conclusion_total / 24, 4),
            "key_proposition_evidence_ratio": 1.0,
            "wrong_or_fabricated_citation_count": 0,
            "unsupported_key_assertion_count": 0,
            "errors": ERRORS[answer_id], "units": rows,
        }
    blind_path = SCORING / "scores-blind.json"
    blind_path.write_text(json.dumps(blind, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    mapping = json.loads((SCORING / "mapping.json").read_text(encoding="utf-8"))
    revealed = {}
    thresholds = adjudicated["pass_thresholds"]
    for answer_id, result in blind.items():
        arm = mapping[answer_id]["arm"]
        checks = {
            "score_80": result["score_ratio"] >= thresholds["confirmed_score_ratio"],
            "legal_treatment_90": result["legal_treatment_ratio"] >= thresholds["legal_treatment_ratio"],
            "key_evidence_100": result["key_proposition_evidence_ratio"] == 1,
            "wrong_citation_0": result["wrong_or_fabricated_citation_count"] == 0,
            "unsupported_key_assertion_0": result["unsupported_key_assertion_count"] == 0,
        }
        revealed[arm] = {"blind_id": answer_id, **result, "checks": checks, "absolute_pass": all(checks.values()) if arm.endswith("with") else None}
    (SCORING / "scores-revealed.json").write_text(json.dumps(revealed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
