"""
InLEAGLE Comprehensive Latency Benchmark Suite
================================================
Measures overall end-to-end and stage-by-stage latency across:
1. Embedding Generation (InLegal-BERT bi-encoder)
2. Qdrant Cloud Vector Search (HNSW index query)
3. Prompt & Context Construction (Length scrutiny & deduplication)
4. LLM Generation (Groq / Llama 3.3 70B & fallbacks)
5. Post-Processing & Citation Extraction
6. Overall End-to-End (E2E) Pipeline Latency

STRICT RETRIEVAL SAFEGUARD:
If no chunks/data are received from retrieval for a test query, the benchmark
strictly HALTS generation and DOES NOT resume on model answers, recording the
case as halted to prevent hallucinated / ungrounded evaluation.

Usage:
    python -m app.evaluation.measure_latency --limit 10
    python -m app.evaluation.measure_latency --limit 20 --skip-llm
"""

import os
import sys
import time
import math
import json
import logging
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional

# Setup import path
_APP_DIR = Path(__file__).resolve().parent.parent
_ROOT_DIR = _APP_DIR.parent
for p in [str(_APP_DIR), str(_ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.evaluation.benchmark_loader import load_benchmark
from app.retrieval.vectorstore import (
    get_embeddings,
    get_client,
    COLLECTION_NAME,
    TOP_K,
)
from app.generation.prompt_builder import build_prompt
from app.pipeline.rag_pipeline import (
    get_groq_client,
    get_active_groq_models,
    extract_citations,
    GROQ_MODEL,
    MAX_TOKENS,
    MAX_RESPONSE_CHARS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("latency_benchmark")

REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def calculate_percentiles(values: List[float]) -> Dict[str, float]:
    """Calculates min, max, mean, stddev, and percentiles (P50, P90, P95, P99)."""
    if not values:
        return {
            "count": 0, "min": 0.0, "max": 0.0, "mean": 0.0,
            "std_dev": 0.0, "p50": 0.0, "p90": 0.0, "p95": 0.0, "p99": 0.0
        }

    n = len(values)
    sorted_v = sorted(values)
    mean_v = sum(sorted_v) / float(n)
    variance = sum((x - mean_v) ** 2 for x in sorted_v) / float(n)
    std_dev = math.sqrt(variance)

    def p_calc(p: float) -> float:
        if n == 1:
            return sorted_v[0]
        k = (n - 1) * (p / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_v[int(k)]
        return sorted_v[f] * (c - k) + sorted_v[c] * (k - f)

    return {
        "count": n,
        "min": round(sorted_v[0], 2),
        "max": round(sorted_v[-1], 2),
        "mean": round(mean_v, 2),
        "std_dev": round(std_dev, 2),
        "p50": round(p_calc(50), 2),
        "p90": round(p_calc(90), 2),
        "p95": round(p_calc(95), 2),
        "p99": round(p_calc(99), 2),
    }


def measure_single_query(
    question: str,
    qid: str = "",
    top_k: int = 5,
    source_type: Optional[str] = None,
    score_threshold: float = 0.35,
    run_llm: bool = True
) -> Dict[str, Any]:
    """
    Measures timing for each discrete phase of RAG for a single question.
    Strictly halts if 0 chunks are received from retrieval.
    """
    embeddings = get_embeddings()
    qdrant = get_client()

    # ── Phase 1: Embedding Generation ──
    t0 = time.perf_counter()
    query_vector = embeddings.encode(question, normalize_embeddings=True).tolist()
    t_embed_ms = (time.perf_counter() - t0) * 1000.0

    # ── Phase 2: Qdrant Vector Search ──
    t1 = time.perf_counter()
    qdrant_filter = None
    if source_type:
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            qdrant_filter = Filter(must=[FieldCondition(key="source_type", match=MatchValue(value=source_type))])
        except ImportError:
            pass

    try:
        hits = qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=qdrant_filter,
            limit=top_k,
            with_payload=True,
            score_threshold=score_threshold,
        ).points
    except Exception as e:
        err_str = str(e)
        # Qdrant payload index missing → fall back to client-side filtering
        if "Index required but not found" in err_str and qdrant_filter:
            log.warning(f"[{qid}] Qdrant payload index missing for filter — using client-side filter fallback.")
            try:
                all_hits = qdrant.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_vector,
                    query_filter=None,
                    limit=top_k * 4,
                    with_payload=True,
                    score_threshold=score_threshold,
                ).points
                # Filter client-side by source_type if requested
                if source_type:
                    hits = [
                        h for h in all_hits
                        if (h.payload or {}).get("source_type") == source_type
                           or (h.payload or {}).get("metadata", {}).get("source_type") == source_type
                    ][:top_k]
                else:
                    hits = all_hits[:top_k]
            except Exception as e2:
                log.warning(f"[{qid}] Client-side Qdrant fallback also failed: {e2}")
                hits = []
        else:
            log.warning(f"[{qid}] Qdrant query error: {e}")
            hits = []
    t_qdrant_ms = (time.perf_counter() - t1) * 1000.0
    t_retrieval_ms = t_embed_ms + t_qdrant_ms

    # Extract retrieved chunks
    chunks = []
    seen = set()
    for hit in hits:
        payload = hit.payload or {}
        metadata = payload.get("metadata", payload)
        raw_text = str(payload.get("page_content") or metadata.get("text", "")).strip()
        if not raw_text:
            continue
        key = " ".join(raw_text.lower().split()[:15])
        if key in seen:
            continue
        seen.add(key)
        chunks.append({
            "text": raw_text[:850],
            "document_name": payload.get("document_name") or metadata.get("document_name", "Unknown"),
            "source_type": payload.get("source_type") or metadata.get("source_type", "act"),
            "year": payload.get("year") or metadata.get("year", ""),
            "court": payload.get("court") or metadata.get("court", ""),
            "score": hit.score,
        })

    # ── CRITICAL RETRIEVAL SAFEGUARD ──
    if not chunks:
        log.warning(f"[{qid}] ZERO CHUNKS RETRIEVED: Strictly halting generation. Ungrounded model answers prevented.")
        return {
            "id": qid,
            "question": question,
            "data_received": False,
            "halted_no_data": True,
            "chunks_count": 0,
            "embed_ms": round(t_embed_ms, 2),
            "qdrant_ms": round(t_qdrant_ms, 2),
            "retrieval_ms": round(t_retrieval_ms, 2),
            "prompt_ms": 0.0,
            "llm_ms": 0.0,
            "citations_ms": 0.0,
            "total_ms": round(t_retrieval_ms, 2),
            "completion_tokens": 0,
            "tokens_per_second": 0.0,
            "status": "HALTED_NO_DATA",
        }

    # ── Phase 3: Prompt Construction & Token Budgeting ──
    t2 = time.perf_counter()
    system_prompt, user_prompt, mode = build_prompt(query=question, chunks=chunks, mode="auto")
    t_prompt_ms = (time.perf_counter() - t2) * 1000.0

    t_llm_ms = 0.0
    tokens_generated = 0
    tps = 0.0
    answer_text = ""

    # ── Phase 4: LLM Generation (Groq) ──
    if run_llm:
        t3 = time.perf_counter()
        client = get_groq_client()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        models_to_try = get_active_groq_models()
        last_llm_err = None
        for cand in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=cand,
                    messages=messages,
                    max_tokens=MAX_TOKENS,
                    temperature=0.2,
                )
                answer_text = response.choices[0].message.content.strip()
                if hasattr(response, "usage") and response.usage:
                    tokens_generated = response.usage.completion_tokens or len(answer_text.split())
                else:
                    tokens_generated = int(len(answer_text.split()) * 1.3)
                break
            except Exception as e:
                last_llm_err = e
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str:
                    log.warning(f"[{qid}] LLM call to '{cand}' hit 429 Rate Limit. Backing off 1s before trying fallback...")
                    time.sleep(1.0)
                else:
                    log.warning(f"[{qid}] LLM call to '{cand}' failed: {e}. Trying fallback...")

        t_llm_ms = (time.perf_counter() - t3) * 1000.0
        tps = round(tokens_generated / (t_llm_ms / 1000.0), 2) if t_llm_ms > 0 else 0.0

        # Character length scrutiny
        if answer_text and len(answer_text) > MAX_RESPONSE_CHARS:
            last_p = answer_text.rfind(".", 0, MAX_RESPONSE_CHARS)
            if last_p > 800:
                answer_text = answer_text[:last_p + 1]
            else:
                answer_text = answer_text[:MAX_RESPONSE_CHARS].rstrip() + "..."

        # CRITICAL SAFEGUARD: If LLM failed with 429 or returned no answer, DO NOT mark as COMPLETED
        if not answer_text:
            log.error(f"[{qid}] LLM generation failed across all models: {last_llm_err}")
            return {
                "id": qid,
                "question": question[:80],
                "data_received": True,
                "halted_no_data": False,
                "chunks_count": len(chunks),
                "citations_count": 0,
                "embed_ms": round(t_embed_ms, 2),
                "qdrant_ms": round(t_qdrant_ms, 2),
                "retrieval_ms": round(t_retrieval_ms, 2),
                "prompt_ms": round(t_prompt_ms, 2),
                "llm_ms": round(t_llm_ms, 2),
                "citations_ms": 0.0,
                "total_ms": round(t_retrieval_ms + t_prompt_ms + t_llm_ms, 2),
                "completion_tokens": 0,
                "tokens_per_second": 0.0,
                "status": f"FAILED_LLM_429: {last_llm_err}",
                "error": str(last_llm_err),
            }

    # ── Phase 5: Post-Processing & Citation Extraction ──
    t4 = time.perf_counter()
    citations = extract_citations(chunks)
    t_citations_ms = (time.perf_counter() - t4) * 1000.0

    total_e2e_ms = t_retrieval_ms + t_prompt_ms + t_llm_ms + t_citations_ms

    return {
        "id": qid,
        "question": question[:80],
        "data_received": True,
        "halted_no_data": False,
        "chunks_count": len(chunks),
        "citations_count": len(citations),
        "embed_ms": round(t_embed_ms, 2),
        "qdrant_ms": round(t_qdrant_ms, 2),
        "retrieval_ms": round(t_retrieval_ms, 2),
        "prompt_ms": round(t_prompt_ms, 2),
        "llm_ms": round(t_llm_ms, 2),
        "citations_ms": round(t_citations_ms, 2),
        "total_ms": round(total_e2e_ms, 2),
        "completion_tokens": tokens_generated,
        "tokens_per_second": tps,
        "status": "COMPLETED",
    }


def run_latency_benchmark(
    sample_limit: int = 15,
    top_k: int = 5,
    skip_llm: bool = False,
    output_report: bool = True
) -> Dict[str, Any]:
    """Runs the full latency benchmark over sample questions."""
    log.info(f"Starting InLEAGLE Latency Benchmark (samples: {sample_limit}, top_k: {top_k}, LLM: {not skip_llm})...")
    benchmark_data = load_benchmark(limit=sample_limit)
    if not benchmark_data:
        log.error("No benchmark samples loaded.")
        return {"error": "No benchmark data"}

    query_results = []
    halted_count = 0
    completed_count = 0
    failed_count = 0

    start_bench = time.time()
    for idx, item in enumerate(benchmark_data, 1):
        qid = item.get("id", f"Q{idx}")
        question = item.get("question", "")
        log.info(f"[{idx}/{len(benchmark_data)}] Benchmarking {qid}: '{question[:50]}...'")

        res = measure_single_query(
            question=question,
            qid=qid,
            top_k=top_k,
            run_llm=not skip_llm
        )
        query_results.append(res)
        if res.get("halted_no_data"):
            halted_count += 1
        elif res.get("status") != "COMPLETED":
            failed_count += 1
        else:
            completed_count += 1

    total_bench_duration = round(time.time() - start_bench, 2)

    # Accumulate metrics strictly across successfully completed queries
    valid_queries = [r for r in query_results if r.get("status") == "COMPLETED"]

    embed_latencies = [r["embed_ms"] for r in query_results]
    qdrant_latencies = [r["qdrant_ms"] for r in query_results]
    retrieval_latencies = [r["retrieval_ms"] for r in query_results]

    prompt_latencies = [r["prompt_ms"] for r in valid_queries]
    llm_latencies = [r["llm_ms"] for r in valid_queries]
    citations_latencies = [r["citations_ms"] for r in valid_queries]
    total_latencies = [r["total_ms"] for r in valid_queries]
    tps_values = [r["tokens_per_second"] for r in valid_queries if r.get("tokens_per_second", 0) > 0]

    stats_embed = calculate_percentiles(embed_latencies)
    stats_qdrant = calculate_percentiles(qdrant_latencies)
    stats_retrieval = calculate_percentiles(retrieval_latencies)
    stats_prompt = calculate_percentiles(prompt_latencies)
    stats_llm = calculate_percentiles(llm_latencies)
    stats_citations = calculate_percentiles(citations_latencies)
    stats_total = calculate_percentiles(total_latencies)
    stats_tps = calculate_percentiles(tps_values)

    # Calculate component contribution percentage based on Mean
    mean_total = stats_total["mean"] if stats_total["mean"] > 0 else 1.0
    contributions = {
        "embedding_pct": round((stats_embed["mean"] / mean_total) * 100.0, 1),
        "qdrant_search_pct": round((stats_qdrant["mean"] / mean_total) * 100.0, 1),
        "prompt_prep_pct": round((stats_prompt["mean"] / mean_total) * 100.0, 1),
        "llm_generation_pct": round((stats_llm["mean"] / mean_total) * 100.0, 1),
        "postprocess_pct": round((stats_citations["mean"] / mean_total) * 100.0, 1),
    }

    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "benchmark_duration_seconds": total_bench_duration,
        "sample_size": len(benchmark_data),
        "queries_completed": completed_count,
        "queries_halted_no_data": halted_count,
        "queries_failed_llm": failed_count,
        "safeguard_audit": {
            "ungrounded_model_answers_prevented": halted_count,
            "failed_or_rate_limited_queries": failed_count,
            "status": "PASS - Zero ungrounded or failed answers permitted" if failed_count == 0 else f"WARNING - {failed_count} queries failed or hit 429 rate limit",
        },
        "overall_e2e_latency_ms": stats_total,
        "stage_latency_breakdown_ms": {
            "1_embedding_generation": stats_embed,
            "2_qdrant_vector_search": stats_qdrant,
            "retrieval_subtotal": stats_retrieval,
            "3_prompt_context_prep": stats_prompt,
            "4_llm_generation": stats_llm,
            "5_citation_extraction": stats_citations,
        },
        "throughput": {
            "tokens_per_second": stats_tps,
            "queries_per_second": round(len(benchmark_data) / max(0.1, total_bench_duration), 2),
        },
        "component_time_contribution_pct": contributions,
        "per_query_details": query_results,
    }

    # Print executive ASCII report
    _print_latency_dashboard(report)

    if output_report:
        report_file = REPORTS_DIR / "latency_benchmark_report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        log.info(f"Saved latency benchmark report to {report_file}")

    return report


def _print_latency_dashboard(report: Dict[str, Any]):
    """Prints a structured ASCII dashboard of latency metrics."""
    tot = report["overall_e2e_latency_ms"]
    stages = report["stage_latency_breakdown_ms"]
    contrib = report["component_time_contribution_pct"]
    audit = report["safeguard_audit"]
    tps = report["throughput"]["tokens_per_second"]

    print("\n" + "=" * 80)
    print(" INLEAGLE END-TO-END LATENCY BENCHMARK DASHBOARD")
    print("=" * 80)
    print(f" Sample Size: {report['sample_size']} queries  |  Duration: {report['benchmark_duration_seconds']}s")
    print(f" Completed: {report['queries_completed']}  |  Halted (No Data): {report['queries_halted_no_data']}  |  Failed (429/Error): {report.get('queries_failed_llm', 0)}")
    print(f" Safeguard Audit: {audit['status']}")
    print("-" * 80)
    print(f"{'PIPELINE STAGE':<30} | {'MEAN':>9} | {'P50':>9} | {'P90':>9} | {'P99':>9} | {'CONTRIB %':>9}")
    print("-" * 80)

    stage_names = [
        ("1. InLegal-BERT Embedding", stages["1_embedding_generation"], contrib["embedding_pct"]),
        ("2. Qdrant Cloud Search",   stages["2_qdrant_vector_search"], contrib["qdrant_search_pct"]),
        ("   [Retrieval Subtotal]",   stages["retrieval_subtotal"], round(contrib["embedding_pct"] + contrib["qdrant_search_pct"], 1)),
        ("3. Prompt Context Assembly",stages["3_prompt_context_prep"], contrib["prompt_prep_pct"]),
        ("4. Groq LLM Generation",   stages["4_llm_generation"], contrib["llm_generation_pct"]),
        ("5. Citation Extraction",    stages["5_citation_extraction"], contrib["postprocess_pct"]),
    ]

    for label, s, c_pct in stage_names:
        print(f"{label:<30} | {s['mean']:>7.1f}ms | {s['p50']:>7.1f}ms | {s['p90']:>7.1f}ms | {s['p99']:>7.1f}ms | {c_pct:>8.1f}%")

    print("=" * 80)
    print(f"{'OVERALL END-TO-END (E2E)':<30} | {tot['mean']:>7.1f}ms | {tot['p50']:>7.1f}ms | {tot['p90']:>7.1f}ms | {tot['p99']:>7.1f}ms | {'100.0%':>9}")
    print("=" * 80)
    print(f"Throughput: {tps['mean']} TPS (Mean) | {tps['p50']} TPS (P50) | {report['throughput']['queries_per_second']} QPS (System)")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="InLEAGLE Latency Benchmark")
    parser.add_argument("--limit", type=int, default=10, help="Number of benchmark queries to test")
    parser.add_argument("--top-k", type=int, default=5, help="Number of chunks to retrieve per query")
    parser.add_argument("--skip-llm", action="store_true", help="Benchmark retrieval only (skips Groq token consumption)")
    args = parser.parse_args()

    run_latency_benchmark(sample_limit=args.limit, top_k=args.top_k, skip_llm=args.skip_llm)
