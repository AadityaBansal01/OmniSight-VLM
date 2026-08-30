"""
SQLAlchemy ORM models for the CCTV Search database.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=True)
    zone_tag = Column(String(50), nullable=True)  # e.g., "entrance", "parking"
    rtsp_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    videos = relationship("Video", back_populates="camera", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=generate_uuid)
    camera_id = Column(String, ForeignKey("cameras.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(Text, nullable=False)
    duration = Column(Float, nullable=True)       # seconds
    fps = Column(Float, nullable=True)
    resolution = Column(String(20), nullable=True)  # "1920x1080"
    file_size = Column(Integer, nullable=True)     # bytes
    status = Column(String(20), default="uploaded")  # uploaded | indexing | indexed | error
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    indexed_at = Column(DateTime, nullable=True)

    # Relationships
    camera = relationship("Camera", back_populates="videos")
    events = relationship("Event", back_populates="video", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=generate_uuid)
    video_id = Column(String, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(Float, nullable=False)      # seconds into video
    caption = Column(Text, nullable=False)
    thumbnail_path = Column(String(500), nullable=True)  # path to keyframe .jpg
    vector_id = Column(String(200), nullable=True)  # ChromaDB document ID
    track_id = Column(Integer, nullable=True)  # links same physical object across events (see IOUTracker); scoped to one video's tracking run, not global
    bbox = Column(String, nullable=True)  # JSON string of [x, y, w, h] of the cropped object
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    video = relationship("Video", back_populates="events")


class SearchLog(Base):
    __tablename__ = "search_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(Text, nullable=False)
    results_count = Column(Integer, default=0)
    filters_used = Column(Text, nullable=True)  # JSON string of filters applied
    search_time_ms = Column(Float, default=0.0)
    searched_at = Column(DateTime, default=utcnow)

