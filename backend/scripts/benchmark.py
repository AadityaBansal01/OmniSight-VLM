"""
Real benchmark script — run this locally (not in a sandboxed CI env) and
paste the output into results.md. Do not hand-write these numbers.

Usage: python scripts/benchmark.py
Requires: the app's normal requirements installed, and at least one
indexed video in the DB (run the pipeline on real_pedestrians.mp4 first).
"""
import time
import json
import statistics
import sys
sys.path.insert(0, ".")

from app.ai.motion_pruner import extract_motion_keyframes
from app.ai.vector_store import VectorStore


def bench_motion_pruning(video_path: str) -> dict:
    t0 = time.time()
    keyframes, meta = extract_motion_keyframes(video_path)
    elapsed = time.time() - t0
    prune_pct = 100.0 - (len(keyframes) / meta["total_frames"] * 100.0) if meta["total_frames"] else 0
    return {
        "video": video_path,
        "total_frames": meta["total_frames"],
        "duration_sec": meta["duration"],
        "keyframes_extracted": len(keyframes),
        "prune_pct": round(prune_pct, 2),
        "processing_time_sec": round(elapsed, 3),
    }


def bench_search_latency(queries: list, n_runs: int = 20) -> dict:
    store = VectorStore()
    store._ensure_initialized()
    if store.get_collection_count() == 0:
        return {"error": "No indexed events — run the pipeline first."}

    # Discard the first run per query (embedding-fn cold start), keep the rest.
    all_latencies = []
    for q in queries:
        store.search(query=q, n_results=10)  # warmup
        for _ in range(n_runs):
            t0 = time.time()
            store.search(query=q, n_results=10)
            all_latencies.append((time.time() - t0) * 1000)

    all_latencies.sort()
    n = len(all_latencies)
    return {
        "queries_tested": queries,
        "runs_per_query": n_runs,
        "p50_ms": round(all_latencies[n // 2], 1),
        "p95_ms": round(all_latencies[int(n * 0.95)], 1),
        "p99_ms": round(all_latencies[int(n * 0.99)], 1),
        "mean_ms": round(statistics.mean(all_latencies), 1),
    }


if __name__ == "__main__":
    results = {
        "motion_pruning": bench_motion_pruning("../real_pedestrians.mp4"),
        "search_latency": bench_search_latency([
            "black suv", "pedestrians with backpacks", "supermarket aisle",
            "person running", "empty garage",
        ]),
    }
    print(json.dumps(results, indent=2))
    print("\n--> Paste this JSON into backend/scripts/results.md with the date and hardware you ran it on.")
