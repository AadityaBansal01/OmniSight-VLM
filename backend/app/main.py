"""
FastAPI application factory.
Mounts all routers, configures CORS, and initializes database on startup.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.database import init_db
from app.config import THUMBNAIL_DIR, CORS_ORIGINS, API_KEY
from app.routers import videos, cameras, search, pipeline, stats


from app.services.rtsp_service import start_rtsp_streams, stop_rtsp_streams
from app.services.retention import start_retention_worker, stop_retention_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle handler."""
    # Startup
    print("\n🚀 Initializing CCTV Semantic Search Engine...")
    init_db()
    if API_KEY:
        print("🔒 API key auth ENABLED — requests need header 'X-API-Key'.")
    else:
        print("⚠️  API key auth DISABLED (no CCTV_API_KEY set) — fine for local dev,"
              " but set one before exposing this server beyond localhost.")
    
    # Start RTSP ingestion
    print("🎥 Starting RTSP background ingestion threads...")
    start_rtsp_streams()
    
    # Start Retention policy worker
    print("🧹 Starting retention policy worker...")
    start_retention_worker()
    
    # Pre-warm VectorStore embedding model to eliminate first-query latency
    try:
        from app.ai.vector_store import VectorStore
        print("🧠 Pre-warming VectorStore and ONNX embedding model...")
        VectorStore()._ensure_initialized()
    except Exception as e:
        print(f"⚠️  VectorStore warmup warning: {e}")

    print("✅ Backend ready.\n")
    yield
    # Shutdown
    print("👋 Shutting down.")
    stop_rtsp_streams()
    stop_retention_worker()


app = FastAPI(
    title="CCTV Semantic Search Engine",
    description="Search hours of surveillance footage using natural language.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — explicit allowlist (see CORS_ORIGINS in config.py / CORS_ORIGINS env var).
# "*" is intentionally not used: this API can create cameras, upload video files,
# and stream footage, so wildcard origins + credentials is not appropriate.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Optional API-key gate. No-op when CCTV_API_KEY isn't set (local dev default).
# Health check and docs stay open so monitoring/exploration still works.
_OPEN_PATHS = {"/api/health", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if API_KEY and request.url.path not in _OPEN_PATHS:
        supplied = request.headers.get("x-api-key")
        if supplied != API_KEY:
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid X-API-Key header"})
    return await call_next(request)


# Mount API routers
app.include_router(videos.router)
app.include_router(cameras.router)
app.include_router(search.router)
app.include_router(pipeline.router)
app.include_router(stats.router)

# Serve thumbnail images as static files
app.mount(
    "/thumbnails",
    StaticFiles(directory=str(THUMBNAIL_DIR)),
    name="thumbnails",
)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}
