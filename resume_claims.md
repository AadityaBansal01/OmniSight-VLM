# OmniSight Resume Claims

When discussing OmniSight in an interview or putting it on a resume, you want to focus on the **engineering challenges**, **architectural decisions**, and **quantifiable metrics**. OmniSight is not just an AI wrapper; it's a fully functional data pipeline and retrieval engine.

Here are suggested bullet points tailored for different types of engineering roles.

### General Full-Stack / Software Engineering
- **Architected an end-to-end multimodal search engine** for surveillance footage, enabling natural language querying over video streams by integrating a FastAPI backend with a React/Vite single-page application.
- **Engineered a robust RTSP stream ingestion service** using Python and OpenCV, implementing multi-threaded capture, exponential backoff for fault tolerance, and automated chunking for 24/7 continuous processing.
- **Optimized data processing pipeline**, developing a computer-vision-based motion pruning algorithm that reduced ML inference overhead by 98% by dropping static frames before captioning and embedding.
- **Designed a hybrid retrieval system** leveraging ChromaDB and Reciprocal Rank Fusion (RRF), combining dense vector similarity with semantic metadata to deliver highly accurate video search results.

### Machine Learning / AI Engineering
- **Built a multimodal video retrieval pipeline** integrating Microsoft's Florence-2 for semantic frame captioning and bounding-box detection, enabling zero-shot natural language search on unannotated video.
- **Implemented local vector search** using all-MiniLM-L6-v2 embeddings and ChromaDB, mapping text queries to video events in a shared latent space with sub-second retrieval latency.
- **Developed a localized coordinate normalization system** mapping resolution-dependent bounding boxes to a `[0.0, 1.0]` scale, ensuring consistent spatial reasoning across varying camera resolutions and frontend viewports.
- **Designed a custom search scoring heuristic** applying Reciprocal Rank Fusion (RRF) to normalize and combine match scores, adding exact-term and domain-vocabulary matching without reducing measured recall in the current benchmark.

### Data Engineering / Backend
- **Designed an asynchronous video processing pipeline** handling continuous ingestion, chunking, and metadata extraction of RTSP streams using multi-threading and SQLAlchemy for state management.
- **Implemented automated data lifecycle policies**, creating a background retention worker to prune stale video chunks and embeddings, preventing unbounded storage growth in long-running deployments.
- **Hardened system reliability**, introducing thread-safe locks for stream management, environment-based configuration, and graceful shutdown handlers to prevent orphaned data corruption.

## Key Talking Points for Interviews

1. **"Why didn't you just use an off-the-shelf VMS (Video Management System)?"**
   *Answer:* Traditional VMS systems rely on metadata tags (time, camera ID) or basic motion alerts. OmniSight solves the semantic gap by translating pixel data into a searchable latent space, allowing queries like "person in a red shirt" without manual tagging.

2. **"How did you handle the performance bottleneck of running LLMs on video?"**
   *Answer:* Video has massive temporal redundancy. Running a vision model like Florence-2 on every frame is impossible. I built `motion_pruner.py` using structural similarity and contour detection to isolate only keyframes with significant state changes, achieving a 98% reduction in inference calls while preserving all meaningful events.

3. **"How does the search actually work?"**
   *Answer:* 
   - **Ingestion**: Motion frames are passed to Florence-2 to generate a dense semantic caption and bounding box.
   - **Embedding**: The caption is embedded locally with all-MiniLM-L6-v2 and stored in ChromaDB.
   - **Retrieval**: User queries are embedded using the same model. We perform a cosine similarity search in ChromaDB, apply a threshold (`min_score`), and map the results back to the original video timestamp and spatial coordinates.

4. **"What were the hardest bugs to fix?"**
   *Answer:* 
   - **Coordinate Systems**: Initially, bounding boxes were tied to the original video resolution. When displayed on the frontend, they were misaligned. I had to normalize all coordinates to a relative `0.0-1.0` scale in the backend, allowing the React frontend to scale them dynamically based on the CSS container size.
   - **Thread Management**: The RTSP streams would hang indefinitely if a camera disconnected because `cv2.VideoCapture.read()` blocked. I had to introduce FFMPEG timeout environment variables and implement thread joining with timeouts during shutdown to ensure the app closed cleanly and finalized its MP4 chunks.
