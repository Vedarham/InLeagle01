"""
Human Legal Review Module for InLEAGLE.
Provides standardized evaluation rubrics for advocates, legal researchers,
and banking officers. Generates evaluation sheets and compiles human review scores.
"""

import json
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional

RUBRIC_CRITERIA = {
    "legal_soundness": {
        "label": "Legal Soundness & Statutory Correctness",
        "weight": 0.30,
        "description": "Are the cited acts, sections, and legal doctrines correct and strictly in accordance with Indian law?",
        "scale": "1 (Completely incorrect) to 5 (Flawless legal analysis)"
    },
    "precedent_fidelity": {
        "label": "Precedent Fidelity & Ratio Interpretation",
        "weight": 0.20,
        "description": "Are court decisions cited in appropriate context and their current legal status accurately represented?",
        "scale": "1 (Hallucinated/reversed precedent) to 5 (Accurately cited ratio decidendi)"
    },
    "temporal_and_jurisdiction": {
        "label": "Temporal Validity & Forum Accuracy",
        "weight": 0.15,
        "description": "Does the response cite current, amended law and identify the correct tribunal/court having jurisdiction?",
        "scale": "1 (Cites repealed law / wrong forum) to 5 (Up to date with current amendments and exact forum)"
    },
    "clarity_and_actionability": {
        "label": "Clarity & Actionability for User",
        "weight": 0.20,
        "description": "Does the answer provide clear, actionable steps without confusing the user?",
        "scale": "1 (Unclear / circular advice) to 5 (Crisp, practical step-by-step guidance)"
    },
    "empathy_and_tone": {
        "label": "Tone Appropriate to Query Mode",
        "weight": 0.15,
        "description": "In Layman mode: empathetic and accessible. In Legal mode: professional, formal, and authoritative.",
        "scale": "1 (Inappropriate register) to 5 (Exemplary tone matching mode)"
    }
}


def generate_review_sheet(
    qa_samples: List[Dict[str, Any]],
    output_path: Optional[Path] = None
) -> List[Dict[str, Any]]:
    """
    Generates structured review sheets for legal experts.
    """
    sheets = []
    for item in qa_samples:
        sheet = {
            "question_id": item.get("id", ""),
            "category": item.get("category", ""),
            "query_mode": item.get("query_mode", "auto"),
            "question": item.get("question", ""),
            "generated_answer": item.get("answer", ""),
            "citations_cited": item.get("citations", []),
            "scores": {
                "legal_soundness": None,
                "precedent_fidelity": None,
                "temporal_and_jurisdiction": None,
                "clarity_and_actionability": None,
                "empathy_and_tone": None
            },
            "reviewer_notes": "",
            "verified_by_advocate": False
        }
        sheets.append(sheet)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(sheets, f, indent=2, ensure_ascii=False)

    return sheets


def compile_human_reviews(completed_reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compiles completed expert review sheets and calculates weighted aggregate scores.
    """
    if not completed_reviews:
        return {"error": "No reviews provided"}

    criteria_totals = {c: 0.0 for c in RUBRIC_CRITERIA}
    criteria_counts = {c: 0 for c in RUBRIC_CRITERIA}
    total_reviews = 0

    for r in completed_reviews:
        scores = r.get("scores", {})
        if not scores:
            continue
        total_reviews += 1
        for criterion in RUBRIC_CRITERIA:
            score = scores.get(criterion)
            if score is not None:
                criteria_totals[criterion] += float(score)
                criteria_counts[criterion] += 1

    averages = {}
    weighted_composite = 0.0
    for c, total in criteria_totals.items():
        cnt = max(1, criteria_counts[c])
        avg = total / float(cnt)
        averages[c] = round(avg, 2)
        weighted_composite += avg * RUBRIC_CRITERIA[c]["weight"]

    return {
        "total_reviews_compiled": total_reviews,
        "criteria_average_scores_out_of_5": averages,
        "weighted_human_legal_score_out_of_5": round(weighted_composite, 2),
        "percentage_score": round((weighted_composite / 5.0) * 100, 1),
        "rubric_weights": {c: RUBRIC_CRITERIA[c]["weight"] for c in RUBRIC_CRITERIA}
    }


if __name__ == "__main__":
    from app.evaluation.benchmark_loader import load_benchmark
    sample_data = load_benchmark(limit=5)
    sheet = generate_review_sheet(sample_data)
    print(f"Generated sample review sheet with {len(sheet)} entries.")

