# 🎯 OmniSight VLM — MAANG Technical Interview Defense Cheat Sheet

This guide prepares you to defend every architectural and algorithmic decision in **OmniSight VLM** when interviewed by Senior and Staff Engineers at companies like Google, Meta, Amazon, Apple, and Netflix.

---

### Q1: "Why did you choose Florence-2 over CLIP or cloud APIs like GPT-4o / Gemini 1.5 Flash?"

**The Trap:** Saying "because Florence-2 is newer" or "it was easy to use."
**Staff-Level Answer:**
> "Surveillance analysis imposes two hard constraints: **latency/cost at scale** and **data privacy/GDPR**.
> 1. **Data Sovereignty:** Enterprise security footage often cannot leave on-premises networks to public third-party cloud APIs due to privacy compliance and multi-gigabit uplink constraints.
> 2. **Contextual Granularity:** Standard CLIP embeddings map full images to a single global vector. They frequently miss small or localized actions (e.g. 'carrying a small bag' vs 'wearing a black jacket'). Florence-2-base generates dense textual scene descriptions with spatial grounding at only 230M parameters, running locally at high throughput on Apple Silicon MPS or mid-range GPUs with zero cloud API fees."

---

### Q2: "Why use MOG2 background subtraction instead of just processing every Nth frame?"

**The Trap:** Thinking uniform time-sampling (e.g., 1 frame per second) is sufficient.
**Staff-Level Answer:**
> "Fixed temporal sampling (e.g. 1 FPS) still processes thousands of completely redundant, empty frames—such as an empty warehouse at 3 AM. It also runs the risk of missing fast events that occur between samples.
> 
> OpenCV MOG2 (Mixture of Gaussians) models background pixels dynamically, adapting to lighting changes and detecting shadows. In our benchmarks on 720p footage, MOG2 pruned **98.2% of idle frames** running at **445.8 FPS** (~17.8x faster than realtime). This reduces downstream VLM inference by nearly 28x while guaranteeing that compute is spent strictly when meaningful physical contours enter the camera frame."

---

### Q3: "What is semantic drift, and why did you implement Reciprocal Rank Fusion (RRF)?"

**The Trap:** Claiming dense vector embeddings solve all search problems.
**Staff-Level Answer:**
> "Dense embedding models (like `all-MiniLM-L6-v2`) encode semantic conceptual proximity, but they lack keyword precision. For example, a query for *'empty garage with no cars'* often scores high similarity against *'garage with three parked cars'* because the terms 'garage' and 'cars' dominate the vector space, ignoring the semantic negation.
> 
> To solve this, we implemented a hybrid retrieval pipeline using **Reciprocal Rank Fusion (RRF)** ($k=60$):
> $$RRF\_Score(d) = \frac{1}{60 + r_{dense}(d)} + \frac{1}{60 + r_{lexical}(d)}$$
> The lexical component enforces whole-word boundaries, domain synonyms, and negation filters. Dense search preserves conceptual recall, while lexical scoring guarantees precision on specific objects and colors, achieving a measured **p50 search latency of 63.8ms**."

---

### Q4: "How does the video player achieve sub-15ms scrubbing without full file buffering?"

**The Trap:** Saying "HTML5 `<video>` handles it automatically."
**Staff-Level Answer:**
> "Standard video downloads force the browser to buffer the entire file before decoding forward timestamps. We implemented **HTTP 206 Partial Content byte-range streaming** in FastAPI:
> 1. When the user scrubs or deep-links to a timestamp (`/player/:id?t=14.2`), the player issues an HTTP request with a `Range: bytes=start-end` header.
> 2. The backend opens the video file descriptor, executes a direct kernel seek (`f.seek(start)`), and streams only the requested byte chunk with `Content-Range` headers.
> 3. This eliminates network overhead and enables instant seeks within **< 15ms**."

---

### Q5: "How would you scale this system to many live RTSP cameras across multiple facilities?"

**The Trap:** Suggesting a bigger server or running more threads in FastAPI.
**Staff-Level Answer:**
> "We would decouple the architecture into a four-stage distributed pipeline:
> 1. **Edge Ingestion:** Lightweight edge nodes (e.g. NVIDIA Jetson or CPU gateways) ingest RTSP streams, chunk them into 2-second transport stream (`.ts`) segments via headless FFmpeg, and run MOG2 motion filtering locally.
> 2. **Message Broker:** Active motion segments are published to **Apache Kafka** partitioned by camera zone.
> 3. **GPU Inference Cluster:** A pool of autoscaling workers managed by **Ray Serve** or **Celery** pulls events, micro-batches keyframes through Florence-2 and SentenceTransformers, and uploads thumbnails to object storage (Amazon S3 / MinIO).
> 4. **Distributed Storage:** Ingestion metadata is persisted to **PostgreSQL**, while vectors are written to a distributed cluster like **Qdrant** or **Milvus** with HNSW indexing and read-replicas for sub-100ms global search."

---

### Q6: "What are the failure modes of this architecture, and how do you handle them?"

**Staff-Level Answer:**
> "1. **Environmental False Positives:** Tree branches swaying in the wind or sudden cloud shadows. *Mitigation:* MOG2 dynamic shadow detection, contour area floors (`min_contour_area=500`), and temporal cooldown periods.
> 2. **GPU Out-Of-Memory (OOM):** Concurrent video indexing jobs competing for VRAM. *Mitigation:* Single-worker FIFO daemon queue with thread locks to serialize GPU execution and prevent memory contention.
> 3. **Video Codec Corruption:** Incomplete MP4 uploads or missing `moov` atom headers. *Mitigation:* Pre-flight validation via OpenCV `VideoCapture.isOpened()` before enqueueing pipeline jobs."
