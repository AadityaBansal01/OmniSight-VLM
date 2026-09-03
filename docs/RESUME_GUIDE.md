# 📄 OmniSight VLM — Tailored Resume Bullet Points

Choose the bullet set that aligns best with the specific job role you are applying to.

---

### Option 1: AI / Computer Vision / ML Engineering Role
```latex
\resumeSubheading
  {OmniSight — Edge-Optimized Video-RAG Intelligence Platform}{Sep 2026}
  {Core Technologies: PyTorch, Microsoft Florence-2, ChromaDB, OpenCV, FastAPI, Python}{}
  \resumeItemListStart
    \resumeItem{Engineered an edge-optimized Video-RAG pipeline using OpenCV MOG2 background subtraction, pruning \textbf{98.2\% of frames} at \textbf{445.8 FPS} on an Apple Silicon Mac.}
    \resumeItem{Integrated \textbf{Microsoft Florence-2 VLM} and \textbf{all-MiniLM-L6-v2} to synthesize dense contextual scene captions into 384-dimensional vector representations stored in ChromaDB.}
    \resumeItem{Formulated a hybrid retrieval engine combining dense vector cosine similarity with domain-specific lexical expansion and \textbf{Reciprocal Rank Fusion (RRF)}, achieving \textbf{63.8ms p50 query latency}.}
    \resumeItem{Designed automated retrieval evaluation benchmarking precision@5 and recall@5 against a 10-query labeled CCTV evaluation set.}
  \resumeItemListEnd
```

---

### Option 2: Backend / Distributed Systems / Software Engineering Role
```latex
\resumeSubheading
  {OmniSight — High-Throughput Semantic CCTV Search Engine}{Sep 2026}
  {Core Technologies: Python, FastAPI, SQLAlchemy, SQLite, ChromaDB, Docker, GitHub Actions}{}
  \resumeItemListStart
    \resumeItem{Architected an asynchronous surveillance ingestion backend in \textbf{FastAPI}, processing video streams with single-worker serialized concurrency to prevent GPU memory saturation.}
    \resumeItem{Implemented \textbf{HTTP 206 Partial Content byte-range streaming} with kernel file seeking, reducing video scrubbing latency to \textbf{< 15ms} without full-file buffering.}
    \resumeItem{Built an end-to-end automated CI/CD pipeline using \textbf{GitHub Actions} and \textbf{Pytest}, with automated Pytest coverage for motion pruning, search, API, and streaming modules.}
    \resumeItem{Designed a scale-out architecture for multi-camera RTSP ingestion using queue-based GPU workers and Kafka/Ray as future distributed components.}
  \resumeItemListEnd
```

---

### Option 3: Full Stack Engineering Role
```latex
\resumeSubheading
  {OmniSight — Full-Stack Forensic Video Intelligence Workstation}{Sep 2026}
  {Core Technologies: React 18, Vite, FastAPI, PyTorch, ChromaDB, WebSockets, Vanilla CSS}{}
  \resumeItemListStart
    \resumeItem{Built a real-time forensic investigation workstation in \textbf{React 18} and \textbf{Vite}, featuring live telemetry WebSockets, timestamp deep-linking, and keyboard forensic scrubbing.}
    \resumeItem{Coupled frontend timeline controls to a high-performance \textbf{FastAPI} backend serving \textbf{HTTP 206 byte-range streams} for instant timeline navigation.}
    \resumeItem{Developed natural language search with interactive match-score indicators, domain synonym highlighting, and JSON forensic evidence export capabilities.}
    \resumeItem{Packaged complete full-stack application using \textbf{Docker Compose} for multi-container automated orchestration.}
  \resumeItemListEnd
```
