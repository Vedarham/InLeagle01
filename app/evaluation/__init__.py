"""
InLEAGLE Evaluation & Benchmark Suite.
"""

from .benchmark_loader import load_benchmark, get_benchmark_stats, get_categories
from .retrieval_eval import evaluate_retrieval
from .citation_eval import evaluate_answer_citations, evaluate_benchmark_citations
from .ragas_deepeval import evaluate_ragas_dataset
from .document_eval import run_all_document_evaluations, calculate_emi
from .human_review import generate_review_sheet, compile_human_reviews
from .runner import run_evaluation_pipeline

__all__ = [
    "load_benchmark",
    "get_benchmark_stats",
    "get_categories",
    "evaluate_retrieval",
    "evaluate_answer_citations",
    "evaluate_benchmark_citations",
    "evaluate_ragas_dataset",
    "run_all_document_evaluations",
    "calculate_emi",
    "generate_review_sheet",
    "compile_human_reviews",
    "run_evaluation_pipeline",
]

