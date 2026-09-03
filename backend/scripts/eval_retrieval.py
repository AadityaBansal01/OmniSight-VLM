"""
Retrieval quality eval: precision@k / recall@k for vector-only search vs.
the hybrid RRF search, on the same labeled query set.

Relevance is a keyword-substring proxy (see labeled_queries.json's "_note")
because captions aren't known until Florence-2 has run on real footage.
This is enough to answer "does hybrid actually beat vector-only on THIS
index", which is the claim worth defending in an interview. It is NOT
enough to claim an absolute quality number without a manual spot-check.

Usage: python scripts/eval_retrieval.py
Requires: at least one video already indexed (run the pipeline first).
"""
import json
import re
import sys
sys.path.insert(0, ".")

from app.ai.vector_store import VectorStore


def _is_relevant(caption: str, keywords: list) -> bool:
    caption_lower = caption.lower()
    return any(re.search(rf"\b{re.escape(kw)}s?\b", caption_lower) for kw in keywords)


def eval_one(store: VectorStore, query: str, keywords: list, k: int = 5):
    # Hybrid (RRF) — the shipped search path
    hybrid_results = store.search(query=query, n_results=k)

    # Vector-only baseline: same collection, skip the lexical ranker entirely
    # by querying Chroma directly and bypassing search()'s RRF fusion.
    store._ensure_initialized()
    raw = store._collection.query(query_texts=[query], n_results=k)
    docs = raw["documents"][0] if raw["documents"] else []

    # Ground truth: scan the whole collection for the keyword proxy
    all_docs = store._collection.get()["documents"]
    total_relevant = sum(1 for d in all_docs if _is_relevant(d, keywords))

    hybrid_hits = sum(1 for r in hybrid_results if _is_relevant(r["caption"], keywords))
    vector_hits = sum(1 for d in docs if _is_relevant(d, keywords))

    return {
        "query": query,
        "total_relevant_in_index": total_relevant,
        "hybrid_precision_at_k": round(hybrid_hits / k, 2),
        "hybrid_recall_at_k": round(hybrid_hits / total_relevant, 2) if total_relevant else None,
        "vector_only_precision_at_k": round(vector_hits / k, 2),
        "vector_only_recall_at_k": round(vector_hits / total_relevant, 2) if total_relevant else None,
    }


if __name__ == "__main__":
    with open("scripts/labeled_queries.json") as f:
        data = json.load(f)

    store = VectorStore()
    store._ensure_initialized()
    if store.get_collection_count() == 0:
        print("No indexed events. Run the pipeline on a video first.")
        sys.exit(1)

    results = [eval_one(store, q["query"], q["relevant_keywords"]) for q in data["queries"]]

    n = len(results)
    avg_hybrid_p = sum(r["hybrid_precision_at_k"] for r in results) / n
    avg_vector_p = sum(r["vector_only_precision_at_k"] for r in results) / n

    print(json.dumps(results, indent=2))
    print(f"\nMean precision@5 — hybrid RRF: {avg_hybrid_p:.2f} | vector-only: {avg_vector_p:.2f}")
    print("Paste this into scripts/results.md. If hybrid isn't clearly beating")
    print("vector-only on your real indexed data, say so — don't round up.")
