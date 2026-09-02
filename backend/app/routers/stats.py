import os
import re
from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Camera, Video, Event, SearchLog
from app.schemas import SystemStats
from app.config import VIDEO_DIR


router = APIRouter(prefix="/api/v1/stats", tags=["Statistics"])


@router.get("", response_model=SystemStats)
def get_system_stats(db: Session = Depends(get_db)):
    """Get dynamic, database-driven system statistics and telemetry for Dashboard and Analytics."""
    total_cameras = db.query(Camera).count()
    videos = db.query(Video).all()
    total_videos = len(videos)
    indexed_videos = sum(1 for v in videos if v.status == "indexed")
    events = db.query(Event).all()
    total_events = len(events)

    # Calculate real total video storage
    total_bytes = 0
    if VIDEO_DIR.exists():
        for f in VIDEO_DIR.iterdir():
            if f.is_file():
                total_bytes += f.stat().st_size
    total_storage_mb = round(total_bytes / (1024 * 1024), 2)

    # Recent searches (last 20)
    recent = (
        db.query(SearchLog)
        .order_by(SearchLog.searched_at.desc())
        .limit(20)
        .all()
    )
    recent_searches = [
        {
            "query": s.query,
            "results_count": s.results_count,
            "searched_at": s.searched_at.isoformat() if s.searched_at else None,
        }
        for s in recent
    ]

    # Events by hour (for heatmap)
    hours_data = defaultdict(int)
    for ev in events:
        hour = int(ev.timestamp // 3600) % 24
        hours_data[hour] += 1

    events_by_hour = [
        {"hour": h, "count": c} for h, c in sorted(hours_data.items())
    ]

    # Dynamic 24-Hour Timeline Points
    # Slots: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 23:59
    time_slots = [
        ("00:00", 0, 4),
        ("04:00", 4, 8),
        ("08:00", 8, 12),
        ("12:00", 12, 16),
        ("16:00", 16, 20),
        ("20:00", 20, 23),
        ("23:59", 23, 24),
    ]
    slot_counts = defaultdict(int)
    for ev in events:
        # Map event creation hour or timestamp to 24h cycle
        h = ev.created_at.hour if ev.created_at else int(ev.timestamp) % 24
        for label, start_h, end_h in time_slots:
            if start_h <= h < end_h or (label == "23:59" and h == 23):
                slot_counts[label] += 1
                break

    event_timeline = []
    for label, _, _ in time_slots:
        ev_c = slot_counts[label]
        # motion_c is not measured separately from events in this system right now
        event_timeline.append({
            "time": label,
            "events": ev_c
        })

    # Real Classification Distribution parsed from Event captions
    cat_counts = defaultdict(int)
    for ev in events:
        cap = (ev.caption or "").lower()
        if re.search(r"\b(suv|car|vehicle|automobile|truck|van)\b", cap):
            cat_counts["Vehicles & Transport"] += 1
        if re.search(r"\b(person|people|pedestrian|human|crowd|walking)\b", cap):
            cat_counts["Pedestrians & Walkers"] += 1
        if re.search(r"\b(store|supermarket|aisle|shelf|shelves|register|checkout|merchandise|shop)\b", cap):
            cat_counts["Retail & Checkout"] += 1
        if re.search(r"\b(crosswalk|crossing|zebra|road|street)\b", cap):
            cat_counts["Crosswalks & Lanes"] += 1
        if re.search(r"\b(bag|backpack|luggage|package)\b", cap):
            cat_counts["Bags & Luggage"] += 1

    # Sort categories by count descending
    category_distribution = [
        {"category": cat, "count": count}
        for cat, count in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    if not category_distribution and total_events > 0:
        category_distribution = [{"category": "Surveillance Activity", "count": total_events}]

    # Real Motion Pruning Rate:
    # Compares theoretical full 25fps frames across videos vs indexed keyframe events
    total_raw_frames = sum(int((v.duration or 30.0) * (v.fps or 25.0)) for v in videos)
    if total_raw_frames > 0 and total_events > 0:
        motion_pruning_rate = round(max(0.0, min(99.9, ((total_raw_frames - total_events) / total_raw_frames) * 100.0)), 1)
    else:
        motion_pruning_rate = 0.0

    # Real Average Query Latency from SearchLog table
    avg_latency = db.query(func.avg(SearchLog.search_time_ms)).filter(SearchLog.search_time_ms > 0).scalar()
    if avg_latency is not None and float(avg_latency) > 0:
        avg_query_latency_ms = round(float(avg_latency), 1)
    else:
        avg_query_latency_ms = None

    return SystemStats(
        total_cameras=total_cameras,
        total_videos=total_videos,
        total_events=total_events,
        indexed_videos=indexed_videos,
        total_storage_mb=total_storage_mb,
        recent_searches=recent_searches,
        events_by_hour=events_by_hour,
        event_timeline=event_timeline,
        category_distribution=category_distribution,
        motion_pruning_rate=motion_pruning_rate,
        avg_query_latency_ms=avg_query_latency_ms,
    )
