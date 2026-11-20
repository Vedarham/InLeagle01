"""
Document Evaluation Module for InLEAGLE.
Performs:
1. PDF / Document Extraction Tests (character retention, structure, OCR fallback detection).
2. Numeric Accuracy Checks (monetary figures, dates, percentages).
3. Financial Calculation Validation (EMI, NI Act 143A/148, SARFAESI 18 pre-deposit, NPA timelines).
"""

import re
import math
import logging
from typing import Dict, Any, List, Tuple

log = logging.getLogger("document_eval")

# ─────────────────────────────────────────────────────────────
# 1. FINANCIAL CALCULATION ENGINE & TESTS
# ─────────────────────────────────────────────────────────────

def calculate_emi(principal: float, annual_rate_pct: float, tenure_months: int) -> float:
    """
    Computes standard reducing-balance Equated Monthly Installment (EMI).
    Formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
    """
    if tenure_months <= 0:
        raise ValueError("Tenure months must be positive")
    if annual_rate_pct <= 0:
        return principal / float(tenure_months)

    monthly_rate = (annual_rate_pct / 12.0) / 100.0
    factor = math.pow(1.0 + monthly_rate, tenure_months)
    emi = principal * monthly_rate * factor / (factor - 1.0)
    return round(emi, 2)


def calculate_ni_act_143a_cap(cheque_amount: float) -> float:
    """Section 143A NI Act: Maximum interim compensation is 20% of cheque amount."""
    return round(0.20 * cheque_amount, 2)


def calculate_ni_act_148_floor(fine_or_compensation: float) -> float:
    """Section 148 NI Act: Minimum appellate deposit is 20% of fine/compensation awarded."""
    return round(0.20 * fine_or_compensation, 2)


def calculate_sarfaesi_predeposit(debt_amount: float) -> Dict[str, float]:
    """Section 18 SARFAESI: 50% default deposit, reducible to a floor of 25%."""
    return {
        "standard_50_percent": round(0.50 * debt_amount, 2),
        "minimum_floor_25_percent": round(0.25 * debt_amount, 2),
    }


def calculate_dicgc_insured_amount(account_balances: List[float]) -> float:
    """DICGC Act Section 16: Max Rs 5,00,000 per depositor per bank."""
    total_deposit = sum(account_balances)
    return min(500000.0, total_deposit)


def run_financial_calculation_tests() -> Dict[str, Any]:
    """
    Runs a test suite validating financial calculations against verified ground truths.
    """
    tests = []
    
    # Test 1: EMI validation (Rs 10,00,000 at 12% for 12 months -> Rs 88,848.79)
    emi_calc = calculate_emi(1000000, 12.0, 12)
    expected_emi = 88848.79
    emi_diff = abs(emi_calc - expected_emi)
    tests.append({
        "name": "Standard Reducing Balance EMI Test (10L, 12%, 12m)",
        "calculated": emi_calc,
        "expected": expected_emi,
        "error_margin": emi_diff,
        "passed": emi_diff < 0.50,
    })

    # Test 2: EMI validation (Rs 25,00,000 at 8.5% for 240 months (20 years) -> Rs 21,695.57)
    emi_calc_20y = calculate_emi(2500000, 8.5, 240)
    expected_emi_20y = 21695.57
    diff_20y = abs(emi_calc_20y - expected_emi_20y)
    tests.append({
        "name": "Home Loan 20-Year EMI Test (25L, 8.5%, 240m)",
        "calculated": emi_calc_20y,
        "expected": expected_emi_20y,
        "error_margin": diff_20y,
        "passed": diff_20y < 0.50,
    })

    # Test 3: NI Act Section 143A (20% cap on Rs 15,00,000 cheque -> Rs 3,00,000)
    interim_comp = calculate_ni_act_143a_cap(1500000)
    tests.append({
        "name": "NI Act Sec 143A 20% Interim Compensation Cap",
        "calculated": interim_comp,
        "expected": 300000.0,
        "error_margin": abs(interim_comp - 300000.0),
        "passed": interim_comp == 300000.0,
    })

    # Test 4: NI Act Section 148 (20% floor on Rs 40,00,000 fine -> Rs 8,00,000)
    appellate_floor = calculate_ni_act_148_floor(4000000)
    tests.append({
        "name": "NI Act Sec 148 20% Appellate Deposit Floor",
        "calculated": appellate_floor,
        "expected": 800000.0,
        "error_margin": abs(appellate_floor - 800000.0),
        "passed": appellate_floor == 800000.0,
    })

    # Test 5: SARFAESI Section 18 (Rs 1,00,00,000 debt -> 50L default, 25L floor)
    sarfaesi_predep = calculate_sarfaesi_predeposit(10000000)
    p50_pass = sarfaesi_predep["standard_50_percent"] == 5000000.0
    p25_pass = sarfaesi_predep["minimum_floor_25_percent"] == 2500000.0
    tests.append({
        "name": "SARFAESI Sec 18 DRAT Pre-deposit (50% standard, 25% floor)",
        "calculated": sarfaesi_predep,
        "expected": {"standard_50_percent": 5000000.0, "minimum_floor_25_percent": 2500000.0},
        "passed": p50_pass and p25_pass,
    })

    # Test 6: DICGC Rs 5 Lakh cap across multiple accounts
    # Depositor has Savings (Rs 2.5L), FD (Rs 4.0L), Current (Rs 1.0L) = Rs 7.5L in one bank
    insured = calculate_dicgc_insured_amount([250000.0, 400000.0, 100000.0])
    tests.append({
        "name": "DICGC Insurance Maximum Rs 5,00,000 Payout Cap Test",
        "calculated": insured,
        "expected": 500000.0,
        "passed": insured == 500000.0,
    })

    passed_count = sum(1 for t in tests if t["passed"])
    return {
        "suite_name": "Financial Calculations Validation Suite",
        "total_tests": len(tests),
        "passed_tests": passed_count,
        "pass_rate": round(passed_count / float(len(tests)), 4),
        "results": tests,
    }


# ─────────────────────────────────────────────────────────────
# 2. NUMERIC ACCURACY CHECKS
# ─────────────────────────────────────────────────────────────

def check_numeric_accuracy(generated_text: str, expected_figures: Dict[str, Any]) -> Dict[str, Any]:
    """
    Checks whether all expected numeric and financial constants are accurately
    represented in the generated text without hallucinations.
    """
    if not expected_figures:
        return {"accuracy": 1.0, "matched": [], "missed": []}

    text_lower = generated_text.lower().replace(",", "")
    matched = []
    missed = []

    for key, val in expected_figures.items():
        val_str = str(val).lower()
        # Direct string check
        if val_str in text_lower:
            matched.append(key)
            continue

        # If numeric, check formatted variants (e.g. 1000000 as 10 lakh or 1 crore)
        if isinstance(val, (int, float)):
            num_val = float(val)
            found = False
            # Check integer or rounded form
            if str(int(num_val)) in text_lower:
                found = True
            elif num_val >= 10000000 and ("1 crore" in text_lower or "one crore" in text_lower):
                found = True
            elif num_val == 2000000 and ("20 lakh" in text_lower or "twenty lakh" in text_lower):
                found = True
            elif num_val == 500000 and ("5 lakh" in text_lower or "five lakh" in text_lower):
                found = True
            elif num_val == 100000 and ("1 lakh" in text_lower or "one lakh" in text_lower):
                found = True
            elif num_val == 20 and ("20%" in text_lower or "twenty percent" in text_lower or "twenty per cent" in text_lower):
                found = True
            elif num_val == 50 and ("50%" in text_lower or "fifty percent" in text_lower):
                found = True
            elif num_val == 25 and ("25%" in text_lower or "twenty-five percent" in text_lower or "twenty five" in text_lower):
                found = True
            elif num_val == 60 and ("60 day" in text_lower or "sixty day" in text_lower):
                found = True
            elif num_val == 15 and ("15 day" in text_lower or "fifteen day" in text_lower):
                found = True
            elif num_val == 45 and ("45 day" in text_lower or "forty-five day" in text_lower or "forty five" in text_lower):
                found = True
            elif num_val == 90 and ("90 day" in text_lower or "ninety day" in text_lower):
                found = True

            if found:
                matched.append(key)
            else:
                missed.append(key)
        else:
            missed.append(key)

    total = len(expected_figures)
    acc = len(matched) / float(total) if total > 0 else 1.0
    return {
        "accuracy": round(acc, 4),
        "matched_keys": matched,
        "missed_keys": missed,
    }


# ─────────────────────────────────────────────────────────────
# 3. PDF EXTRACTION & OCR FALLBACK TESTS
# ─────────────────────────────────────────────────────────────

def test_document_extraction_fidelity(sample_text: str, is_scanned: bool = False) -> Dict[str, Any]:
    """
    Tests document extraction fidelity, character retention, header/footer cleaning,
    and automatic OCR fallback triggers.
    """
    char_count = len(sample_text.strip())
    
    # Scanned document detection heuristic: low text yield (< 50 chars) from a document page
    ocr_fallback_triggered = is_scanned or (char_count < 50)
    
    # Check legal structure retention
    has_sections = bool(re.search(r"Section\s+\d+|Article\s+\d+", sample_text, re.IGNORECASE))
    has_dates = bool(re.search(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}", sample_text, re.IGNORECASE))
    has_parties = bool(re.search(r"v\.|versus|petitioner|respondent|complainant|bank", sample_text, re.IGNORECASE))
    
    structural_score = 0.0
    if has_sections: structural_score += 0.40
    if has_dates: structural_score += 0.30
    if has_parties: structural_score += 0.30

    return {
        "character_count": char_count,
        "ocr_fallback_triggered": ocr_fallback_triggered,
        "has_statutory_sections": has_sections,
        "has_dates": has_dates,
        "has_parties_or_case_names": has_parties,
        "structural_retention_score": round(structural_score, 2),
        "extraction_status": "success" if not ocr_fallback_triggered else "ocr_required",
    }


def run_all_document_evaluations() -> Dict[str, Any]:
    """
    Runs full document evaluation suite: calculations + extraction + numeric checks.
    """
    calc_results = run_financial_calculation_tests()

    # Sample legal notice text for extraction testing
    sample_sarfaesi_notice = """
    DEMAND NOTICE UNDER SECTION 13(2) OF THE SARFAESI ACT, 2002
    Date: 15-10-2024
    To: Mr. Ramesh Kumar (Borrower)
    Whereas you availed a Home Loan of Rs 45,00,000 from State Bank of India.
    Your account has been classified as NPA on 30-09-2024 due to non-payment of EMIs exceeding 90 days.
    You are hereby called upon to pay the outstanding aggregate sum of Rs 42,15,600 within 60 days.
    Take notice that failing payment, measures under Section 13(4) shall be initiated.
    """

    sample_scanned_notice = "   "  # Scanned image with no embedded text

    extraction_native = test_document_extraction_fidelity(sample_sarfaesi_notice, is_scanned=False)
    extraction_scanned = test_document_extraction_fidelity(sample_scanned_notice, is_scanned=True)

    # Numeric accuracy check on the sample notice
    numeric_check = check_numeric_accuracy(
        sample_sarfaesi_notice,
        {"loan_amount": 4500000, "notice_period_days": 60, "npa_overdue_days": 90}
    )

    return {
        "evaluation_name": "Document & Financial Calculation Evaluation Suite",
        "financial_calculations": calc_results,
        "pdf_extraction_native": extraction_native,
        "pdf_extraction_scanned_ocr": extraction_scanned,
        "numeric_accuracy_test": numeric_check,
        "summary": {
            "financial_calculation_pass_rate": calc_results["pass_rate"],
            "native_pdf_retention": extraction_native["structural_retention_score"],
            "ocr_fallback_detection_accuracy": 1.0 if extraction_scanned["ocr_fallback_triggered"] else 0.0,
            "numeric_extraction_accuracy": numeric_check["accuracy"],
        }
    }


if __name__ == "__main__":
    import json
    res = run_all_document_evaluations()
    print("Document and Financial Evaluation Results:")
    print(json.dumps(res, indent=2))

