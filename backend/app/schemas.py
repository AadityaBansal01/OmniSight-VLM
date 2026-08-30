"""
Pydantic v2 schemas for request/response serialization.
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ─── Camera Schemas ──────────────────────────────────────────
class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location: Optional[str] = None
    zone_tag: Optional[str] = None
    rtsp_url: Optional[str] = None


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = None
    zone_tag: Optional[str] = None
    rtsp_url: Optional[str] = None


class CameraOut(BaseModel):
    id: str
    name: str
    location: Optional[str]
    zone_tag: Optional[str]
    rtsp_url: Optional[str]
    created_at: datetime
    video_count: int = 0
    total_size_bytes: int = 0
    resolution: Optional[str] = None
    fps: Optional[float] = None
    status: str = "ONLINE"

    model_config = {"from_attributes": True}


# ─── Video Schemas ───────────────────────────────────────────
class VideoOut(BaseModel):
    id: str
    camera_id: Optional[str]
    camera_name: Optional[str] = None
    resolution: Optional[str] = None
    filename: str
    duration: Optional[float]
    fps: Optional[float]
    resolution: Optional[str]
    file_size: Optional[int]
    status: str
    error_msg: Optional[str]
    event_count: int = 0
    created_at: datetime
    indexed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ─── Event Schemas ───────────────────────────────────────────
class EventOut(BaseModel):
    id: str
    video_id: str
    timestamp: float
    time_str: str = ""
    caption: str
    thumbnail_path: Optional[str]
    match_score: float = 0.0
    video_filename: Optional[str] = None
    camera_id: Optional[str] = None
    camera_name: Optional[str] = None
    resolution: Optional[str] = None
    ai_match_reason: Optional[str] = None
    detected_tags: List[str] = []
    track_id: Optional[int] = None
    bbox: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Search Schemas ──────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    n_results: int = Field(10, ge=1, le=50)
    video_id: Optional[str] = None
    camera_id: Optional[str] = None
    min_score: float = Field(0.0, ge=0.0, le=100.0)
    time_from: Optional[float] = None  # seconds
    time_to: Optional[float] = None    # seconds


class SearchResponse(BaseModel):
    query: str
    results: List[EventOut]
    total_matches: int
    search_time_ms: float = 0.0
    ai_summary: Optional[str] = None
    ai_insights: List[str] = []
    suggested_queries: List[str] = []


# ─── Pipeline Schemas ────────────────────────────────────────
class PipelineStatus(BaseModel):
    is_running: bool = False
    video_id: Optional[str] = None
    video_filename: Optional[str] = None
    stage: str = "idle"          # idle | motion_pruning | captioning | indexing | complete | error
    progress: float = 0.0       # 0.0 - 1.0
    message: str = "Idle"
    events_found: int = 0


# ─── Stats Schemas ───────────────────────────────────────────
class SystemStats(BaseModel):
    total_cameras: int = 0
    total_videos: int = 0
    total_events: int = 0
    indexed_videos: int = 0
    total_storage_mb: float = 0.0
    recent_searches: List[dict] = []
    events_by_hour: List[dict] = []
    event_timeline: List[dict] = []
    category_distribution: List[dict] = []
    motion_pruning_rate: float = 0.0
    avg_query_latency_ms: Optional[float] = None
    vlm_confidence_avg: Optional[float] = None
