"""
Benchmark Dataset Loader for InLEAGLE Evaluation Suite.
Loads and validates the 150-question ground truth dataset.
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any

DATA_PATH = Path(__file__).parent / "data" / "benchmark_150.json"


def load_benchmark(
    category: Optional[str] = None,
    query_mode: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Load benchmark questions, optionally filtered by category or mode.
    """
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Benchmark file not found at {DATA_PATH}")

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if category:
        cat_lower = category.strip().lower()
        data = [d for d in data if d.get("category", "").lower() == cat_lower]

    if query_mode:
        mode_lower = query_mode.strip().lower()
        data = [d for d in data if d.get("query_mode", "").lower() == mode_lower]

    if limit and limit > 0:
        data = data[:limit]

    return data


def get_categories() -> List[str]:
    """Returns all unique categories in the benchmark dataset."""
    data = load_benchmark()
    cats = sorted(list({d.get("category", "") for d in data if d.get("category")}))
    return cats


def get_benchmark_stats() -> Dict[str, Any]:
    """Returns dataset summary statistics."""
    data = load_benchmark()
    categories: Dict[str, int] = {}
    modes: Dict[str, int] = {}
    total_statutes = 0
    total_precedents = 0
    numeric_count = 0

    for item in data:
        cat = item.get("category", "UNKNOWN")
        categories[cat] = categories.get(cat, 0) + 1

        mode = item.get("query_mode", "UNKNOWN")
        modes[mode] = modes.get(mode, 0) + 1

        total_statutes += len(item.get("expected_statutes", []))
        total_precedents += len(item.get("expected_precedents", []))

        if item.get("financial_figures"):
            numeric_count += 1

    return {
        "total_questions": len(data),
        "category_distribution": categories,
        "mode_distribution": modes,
        "total_ground_truth_statutes": total_statutes,
        "total_ground_truth_precedents": total_precedents,
        "questions_with_financial_figures": numeric_count,
    }


if __name__ == "__main__":
    stats = get_benchmark_stats()
    print("Benchmark Statistics:")
    print(json.dumps(stats, indent=2))

