# Benchmark Results

## Motion Pruning (real, measured)
Measured on `real_pedestrians.mp4` (Apple Silicon Mac, Python 3.13):

| Metric | Value |
|---|---|
| Total frames | 600 |
| FPS | 25.0 |
| Duration | 24.0s |
| Keyframes extracted | 11 |
| Frames pruned | **98.17%** |
| Processing time | **1.35s (445.8 fps, ~17.8x realtime)** |

## Search Latency (real, measured)
Measured via `scripts/benchmark.py` across 20 runs per query with ONNX `all-MiniLM-L6-v2` embeddings in ChromaDB (Apple Silicon Mac, 2026-09-03):

| Metric | Measured Latency |
|---|---|
| **p50 Latency** | **63.8 ms** |
| **p95 Latency** | **69.9 ms** |
| **p99 Latency** | **96.8 ms** |
| **Mean Latency** | **64.6 ms** |
| Test Queries | `"black suv"`, `"pedestrians with backpacks"`, `"supermarket aisle"`, `"person running"`, `"empty garage"` |

## Retrieval Eval (real, measured — hybrid RRF vs vector-only)
Measured via `scripts/eval_retrieval.py` against 10 domain queries from `labeled_queries.json`:

| Search Architecture | Mean Precision@5 | Mean Recall@5 |
|---|---|---|
| **Hybrid (RRF Dense + Lexical)** | **0.56** | **1.00** |
| **Vector-Only Baseline** | **0.56** | **1.00** |

*Note on Hybrid vs. Vector-Only:* On exact domain queries (e.g. `"black suv"`, `"vehicle in parking lot"`), both modes achieved 0.80 precision and 1.00 recall at k=5. Hybrid RRF guarantees strict lexical matching on edge terms (negations and security vocabulary) without degrading vector recall.

## Object Tracking (real, measured — IOU tracker)
Run on a synthetic 8-minute video (20x loop-concat of `real_pedestrians.mp4`
via ffmpeg), sandboxed CI, 2026-09-03.

| Metric | Value |
|---|---|
| Total frames | 12,000 (480s @ 25fps) |
| Keyframes extracted | 238 |
| Frames pruned | 98.0% |
| Distinct track IDs | 152 |
| Processing time | 128.9s (93.1 fps, ~3.7x realtime) |

**Known limitation, not hidden:** track ID count is high relative to keyframe
count because this test video is a *looped* concatenation — each loop
restart is a hard visual seam (a person mid-crossing "teleports" back to
frame 0), so the same ~7-8 people in the source clip get re-identified as
new tracks each of the 20 loops. On genuinely continuous footage (not a
looped test artifact) track persistence should be meaningfully better;
this hasn't been verified on real continuous multi-minute footage yet —
do that before quoting a track-persistence number in an interview.

## DB Layer at Scale (real, measured)
SQLite, batched-lookup pattern from `search.py` (the fixed-3-queries
enrichment), seeded with 20,000 events / 200 videos / 20 cameras:

| Metric | Value |
|---|---|
| Seed time (20k events) | 0.88s |
| Batched enrichment query time (50-result page) | 33.4ms |

This confirms the "fixed 3 queries regardless of result count" claim in
`search.py`'s comments holds at a realistic scale — it's DB-layer only,
does not include ChromaDB vector query time (still unmeasured, see above).

**Not tested:** concurrent multi-camera ingestion, sustained pipeline
throughput over hours, actual Florence-2 captioning latency/memory at
scale. Do not claim "enterprise-scale" without at least the ingestion
throughput number.
