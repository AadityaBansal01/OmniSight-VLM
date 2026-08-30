"""
Application configuration.
All paths are relative to the backend/ directory.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


# Root of the backend/ directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directories
DATA_DIR = BASE_DIR / "data"
VIDEO_DIR = DATA_DIR / "videos"
THUMBNAIL_DIR = DATA_DIR / "thumbnails"
CHROMA_DIR = Path(os.environ.get("CHROMA_DIR", str(DATA_DIR / "chroma_db")))
SQLITE_PATH = DATA_DIR / "cctv_search.db"

# Ensure all data directories exist at import time
for d in [VIDEO_DIR, THUMBNAIL_DIR, CHROMA_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{SQLITE_PATH}")

# AI Model settings
FLORENCE_MODEL_ID = "microsoft/Florence-2-base"
CAPTION_PROMPT = "<MORE_DETAILED_CAPTION>"
MAX_NEW_TOKENS = 512

# Motion pruner defaults
MOTION_MIN_CONTOUR_AREA = 1000
MOTION_COOLDOWN_SEC = 2.0
MOTION_MOG2_HISTORY = 500
MOTION_MOG2_VAR_THRESHOLD = 40
MOTION_WARMUP_SEC = 1.0

# Video constraints
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}
MAX_UPLOAD_SIZE_MB = 500

# ChromaDB
CHROMA_COLLECTION_NAME = "cctv_events"
RETENTION_DAYS = int(os.environ.get("CCTV_RETENTION_DAYS", "7"))

# ─── Security ─────────────────────────────────────────────────
# CORS: comma-separated list of allowed origins, e.g.
#   CORS_ORIGINS="http://localhost:5173,https://cctv.mycompany.com"
# Defaults to the Vite dev server only — NOT "*" — since this API can create
# cameras, upload footage, and stream video files.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", _default_origins).split(",") if o.strip()
]

# API key: if set, every /api/v1/* request must include header `X-API-Key`
# matching this value. Unset by default so local dev works out of the box —
# set this before exposing the server beyond localhost.
#   export CCTV_API_KEY="some-long-random-value"
API_KEY = os.environ.get("CCTV_API_KEY", "").strip() or None
