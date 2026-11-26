"""
Retrieval Evaluation Module for InLEAGLE.
Measures the current InLegal-Sbert + Qdrant implementation baseline.
Computes Precision@K, Recall@K, MRR, HitRate@K, and Latency percentiles (P50, P90, P99).
"""

import time
import math
import logging
from typing import List, Dict, Any, Optional, Tuple

try:
    from app.retrieval.vectorstore import search
except ImportError:
    try:
        from retrieval.vectorstore import search
    except ImportError:
        search = None

from app.evaluation.benchmark_loader import load_benchmark

log = logging.getLogger("retrieval_eval")


def _is_chunk_relevant(chunk: Dict[str, Any], ground_truth_statutes: List[str], ground_truth_precedents: List[str]) -> bool:
    """
    Determines if a retrieved chunk matches any expected statute or precedent.
    Checks document_name, text, court, and year against expected keywords.
    """
    doc_name = (chunk.get("document_name") or "").lower()
    text = (chunk.get("text") or "").lower()

    # Normalize targets
    targets = []
    for s in ground_truth_statutes:
        targets.append(s.lower())
    for p in ground_truth_precedents:
        targets.append(p.lower())

    for target in targets:
        # Check act name or landmark case tokens
        # Extract main keywords from target
        tokens = [t.strip(",.()") for t in target.split() if len(t.strip(",.()")) > 3]
        if any(token in doc_name for token in tokens):
            return True
        # Check text if key sections match (e.g. "13(2)", "138", "section 95")
        if any(token in text for token in tokens if ("section" in token or "13(" in token or "138" in token)):
            return True

    return False


def _count_covered_targets(chunks: List[Dict[str, Any]], expected_statutes: List[str], expected_precedents: List[str]) -> Tuple[int, int]:
    """
    Counts how many unique expected ground-truth targets (statutes + precedents)
    are represented in the retrieved chunks. Bounded strictly in [0, total_targets].
    """
    targets = expected_statutes + expected_precedents
    if not targets:
        return 1, 1

    covered_count = 0
    for target in targets:
        t_lower = target.lower()
        tokens = [tok.strip(",.()") for tok in t_lower.split() if len(tok.strip(",.()")) > 3 and tok.lower() not in ["act", "section", "the", "code", "under"]]
        matched = False
        for c in chunks:
            doc_name = (c.get("document_name") or "").lower()
            text = (c.get("text") or "").lower()
            if any(tok in doc_name for tok in tokens) or (len(tokens) >= 2 and sum(1 for tok in tokens if tok in text) >= 2):
                matched = True
                break
        if matched:
            covered_count += 1

    return covered_count, len(targets)


def evaluate_retrieval(
    benchmark_data: Optional[List[Dict[str, Any]]] = None,
    top_k_list: List[int] = [1, 3, 5],
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Runs retrieval benchmark across the questions and returns structured metrics.
    Uses strictly real retrieval — zero mock or synthetic fallback chunks.
    """
    if benchmark_data is None:
        benchmark_data = load_benchmark(limit=limit)
    elif limit and limit > 0:
        benchmark_data = benchmark_data[:limit]

    total_queries = len(benchmark_data)
    if total_queries == 0:
        return {"error": "Empty benchmark dataset"}

    max_k = max(top_k_list)
    latencies_ms: List[float] = []

    # Accumulators per K
    hits_at_k: Dict[int, int] = {k: 0 for k in top_k_list}
    precision_sums: Dict[int, float] = {k: 0.0 for k in top_k_list}
    recall_sums: Dict[int, float] = {k: 0.0 for k in top_k_list}
    reciprocal_ranks: List[float] = []

    query_details: List[Dict[str, Any]] = []

    for item in benchmark_data:
        qid = item.get("id", "")
        question = item.get("question", "")
        expected_statutes = item.get("expected_statutes", [])
        expected_precedents = item.get("expected_precedents", [])

        start_time = time.perf_counter()

        retrieved_chunks: List[Dict[str, Any]] = []
        if search is not None:
            try:
                retrieved_chunks = search(question, top_k=max_k)
            except Exception as e:
                log.warning(f"Live retrieval failed for {qid}: {e}.")
                retrieved_chunks = []

        duration_ms = (time.perf_counter() - start_time) * 1000
        latencies_ms.append(duration_ms)

        # Evaluate relevance flags for retrieved chunks
        relevance_flags = [
            _is_chunk_relevant(c, expected_statutes, expected_precedents)
            for c in retrieved_chunks
        ]

        # First relevant rank (1-indexed)
        first_rel_rank = 0
        for rank, is_rel in enumerate(relevance_flags, 1):
            if is_rel:
                first_rel_rank = rank
                break

        rr = 1.0 / first_rel_rank if first_rel_rank > 0 else 0.0
        reciprocal_ranks.append(rr)

        # Metrics at each K with mathematically bounded Recall@K in [0.0, 1.0]
        per_k_metrics = {}
        for k in top_k_list:
            top_k_chunks = retrieved_chunks[:k]
            top_k_rel = relevance_flags[:k]
            rel_count = sum(1 for r in top_k_rel if r)
            p_k = min(1.0, rel_count / float(k))

            covered, total_tgt = _count_covered_targets(top_k_chunks, expected_statutes, expected_precedents)
            r_k = min(1.0, covered / float(max(1, total_tgt)))
            hit_k = 1 if rel_count > 0 else 0

            precision_sums[k] += p_k
            recall_sums[k] += r_k
            hits_at_k[k] += hit_k

            per_k_metrics[f"P@{k}"] = round(p_k, 3)
            per_k_metrics[f"R@{k}"] = round(r_k, 3)

        query_details.append({
            "id": qid,
            "latency_ms": round(duration_ms, 2),
            "mrr": round(rr, 3),
            "chunks_retrieved": len(retrieved_chunks),
            "first_relevant_rank": first_rel_rank,
            "metrics": per_k_metrics,
        })

    latencies_sorted = sorted(latencies_ms)
    n = len(latencies_sorted)

    def percentile(p: float) -> float:
        if n == 0:
            return 0.0
        k = (n - 1) * (p / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return latencies_sorted[int(k)]
        return latencies_sorted[f] * (c - k) + latencies_sorted[c] * (k - f)

    results = {
        "evaluation_name": "InLegal-Sbert + Qdrant Retrieval Baseline",
        "total_queries_evaluated": total_queries,
        "metrics": {
            "MRR": round(sum(reciprocal_ranks) / float(total_queries), 4),
            "Precision": {
                f"P@{k}": round(precision_sums[k] / float(total_queries), 4)
                for k in top_k_list
            },
            "Recall": {
                f"R@{k}": round(recall_sums[k] / float(total_queries), 4)
                for k in top_k_list
            },
            "HitRate": {
                f"HR@{k}": round(hits_at_k[k] / float(total_queries), 4)
                for k in top_k_list
            },
        },
        "latency_ms": {
            "mean": round(sum(latencies_ms) / float(total_queries), 2),
            "p50": round(percentile(50), 2),
            "p90": round(percentile(90), 2),
            "p99": round(percentile(99), 2),
        },
        "sample_queries": query_details[:5],
    }

    return results


if __name__ == "__main__":
    print("Running retrieval baseline evaluation on sample questions...")
    res = evaluate_retrieval(limit=10)
    import json
    print(json.dumps(res, indent=2))

