"""
Top-level entry point to run InLEAGLE Latency Benchmarks.
Usage:
    python measure_latency.py --limit 10
    python measure_latency.py --limit 20 --skip-llm
"""
import sys
import argparse
from pathlib import Path

# Ensure app root is on sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.evaluation.measure_latency import run_latency_benchmark

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="InLEAGLE Latency Benchmark")
    parser.add_argument("--limit", type=int, default=10, help="Number of benchmark queries to test")
    parser.add_argument("--top-k", type=int, default=5, help="Number of chunks to retrieve per query")
    parser.add_argument("--skip-llm", action="store_true", help="Benchmark retrieval only (skips Groq token consumption)")
    args = parser.parse_args()

    run_latency_benchmark(sample_limit=args.limit, top_k=args.top_k, skip_llm=args.skip_llm)
