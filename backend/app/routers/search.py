"""
Semantic search API routes.
Searches ChromaDB vectors with optional filters (camera, video, time range, confidence).
"""
import time
import json
import re

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models import Event, Video, Camera, SearchLog
from app.schemas import EventOut, SearchResponse
from app.ai.vector_store import VectorStore
from app.config import THUMBNAIL_DIR


router = APIRouter(prefix="/api/v1", tags=["Search"])


# Generic stopwords + low-signal words filtered out of caption keyword extraction.
# Deliberately domain-agnostic — no hardcoded scene vocabulary (no "SUV", "zebra
# crossing", "cash register", etc). Works on captions from any footage.
_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "in",
    "on", "at", "of", "to", "with", "and", "or", "but", "there", "this", "that",
    "it", "its", "as", "by", "from", "into", "over", "under", "near", "next",
    "front", "side", "background", "foreground", "image", "picture", "photo",
    "shows", "showing", "shown", "appears", "appear", "visible", "seen", "view",
    "scene", "some", "several", "few", "one", "two", "three", "no", "not",
    "any", "also", "other", "another", "while", "which", "who", "their", "them",
    "he", "she", "his", "her", "they", "we", "you", "i", "very", "such",
}


def _extract_keyphrases(caption: str, max_phrases: int = 4) -> List[str]:
    """
    Pull the most salient noun-ish phrases out of a caption without any
    hardcoded topic vocabulary. Uses bigrams first (captures things like
    "cash register" or "black suv" generically), falls back to significant
    single words, and skips anything that's actually negated in the caption.
    """
    caption_lower = caption.lower()
    words = re.findall(r"[a-z]+", caption_lower)
    sig_idx = [i for i, w in enumerate(words) if w not in _STOPWORDS and len(w) > 2]

    def _is_negated(idx: int) -> bool:
        window = words[max(0, idx - 3):idx]
        return any(w in ("no", "without", "zero", "not") for w in window)

    phrases: List[str] = []
    seen = set()

    # Prefer adjacent significant-word bigrams (reads more like a real entity tag)
    for i in sig_idx:
        if i + 1 < len(words) and (i + 1) in sig_idx and not _is_negated(i):
            phrase = f"{words[i]} {words[i+1]}"
            if phrase not in seen:
                seen.add(phrase)
                phrases.append(phrase.title())
        if len(phrases) >= max_phrases:
            break

    # Fill remaining slots with standalone significant words not already covered
    if len(phrases) < max_phrases:
        covered = " ".join(phrases).lower()
        for i in sig_idx:
            if _is_negated(i):
                continue
            w = words[i]
            if w in covered or w in seen:
                continue
            seen.add(w)
            phrases.append(w.title())
            if len(phrases) >= max_phrases:
                break

    return phrases





def _extract_tags_and_reason(caption: str, query: str, best_clause: Optional[str] = None) -> tuple:
    tags = _extract_keyphrases(caption) or ["Surveillance Event"]

    q_words = {w for w in re.findall(r"[a-z0-9]+", query.lower()) if w not in _STOPWORDS and len(w) > 1}
    caption_words = {w for w in re.findall(r"[a-z0-9]+", caption.lower())}
    overlap = sorted(q_words & caption_words)

    if overlap and len(overlap) >= 2:
        reason = f"Visual + lexical match on: {', '.join(overlap)}."
    elif best_clause and best_clause != caption and len(best_clause) > 10:
        clean_clause = best_clause.strip().rstrip('.')
        reason = f"Semantic match on action/subject: \"{clean_clause}\""
    elif overlap:
        reason = f"Visual match on: {', '.join(overlap)}."
    else:
        reason = f"Semantic match on scene context: \"{caption.strip().rstrip('.')[:80]}...\""

    return reason, tags[:4]


def _synthesize_ai_intelligence(query: str, items: list) -> tuple:
    if not items:
        summary = f"No indexed keyframes matched '{query}' above the confidence threshold."
        insights = [
            f"Zero matching keyframes detected for '{query}' in the indexed surveillance clips.",
            "Unrelated random queries are strictly filtered out to prevent false-positive matches.",
            "Try lowering the minimum match score slider or adjusting your query.",
        ]
        return summary, insights, []

    cams = list(dict.fromkeys(item.camera_name or "Unnamed Camera" for item in items))
    cams_str = " and ".join(cams) if len(cams) <= 3 else f"{len(cams)} cameras"
    highest = items[0]
    times = [item.time_str for item in items]

    # Aggregate the actual keyphrases seen across all returned captions —
    # this is what drives the summary, so it reflects real footage content.
    phrase_counts: dict = {}
    for item in items:
        for phrase in _extract_keyphrases(item.caption, max_phrases=6):
            phrase_counts[phrase] = phrase_counts.get(phrase, 0) + 1
    top_phrases = sorted(phrase_counts, key=phrase_counts.get, reverse=True)[:4]

    summary = (
        f"Found {len(items)} matching keyframe{'s' if len(items) != 1 else ''} for '{query}' "
        f"on {cams_str}. Top match: {highest.match_score:.1f}% match score at {highest.time_str} "
        f"— \"{highest.caption.strip().rstrip('.')}\"."
    )

    insights = [
        f"Peak match: {highest.match_score:.1f}% on {highest.camera_name or 'an active camera'} at {highest.time_str}.",
        f"Recurring elements across results: {', '.join(top_phrases) if top_phrases else 'no strong recurring pattern'}.",
        f"Time span covered: {times[0]} \u2013 {times[-1]} across {len(cams)} camera(s).",
    ]

    # Suggestions are derived from other frequent elements in the actual
    # results, not a fixed menu of the three demo queries.
    suggestions = [p.lower() for p in top_phrases if p.lower() != query.lower().strip()][:4]

    return summary, insights, suggestions


@router.get("/search", response_model=SearchResponse)
def semantic_search(
    q: str = Query(..., min_length=1, description="Natural language search query"),
    camera_id: Optional[str] = Query(None),
    video_id: Optional[str] = Query(None),
    min_score: float = Query(0.0, ge=0.0, le=100.0),
    time_from: Optional[float] = Query(None, description="Min timestamp in seconds"),
    time_to: Optional[float] = Query(None, description="Max timestamp in seconds"),
    n_results: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Perform semantic vector search over all indexed CCTV events.
    Supports filtering by camera, video, confidence threshold, and time range.
    """
    start_time = time.time()

    vector_store = VectorStore()
    raw_results = vector_store.search(
        query=q,
        n_results=n_results * 2,  # Fetch extra to account for post-filters
        video_id=video_id,
        camera_id=camera_id,
        min_score=min_score,
    )

    # Post-filter by time range
    if time_from is not None or time_to is not None:
        filtered = []
        for r in raw_results:
            ts = r["timestamp"]
            if time_from is not None and ts < time_from:
                continue
            if time_to is not None and ts > time_to:
                continue
            filtered.append(r)
        raw_results = filtered

    # Trim to requested count
    raw_results = raw_results[:n_results]

    # --- Batch-fetch all DB metadata up front instead of querying per result ---
    # Previously this ran up to 3 queries (Video, Camera, Event) per result —
    # 150 queries for a 50-result search. Now it's a fixed 3 queries total,
    # regardless of result count.
    vid_ids = {r["video_id"] for r in raw_results}

    videos_by_id = {
        v.id: v for v in db.query(Video).filter(Video.id.in_(vid_ids)).all()
    } if vid_ids else {}

    camera_ids = {v.camera_id for v in videos_by_id.values() if v.camera_id}
    cameras_by_id = {
        c.id: c for c in db.query(Camera).filter(Camera.id.in_(camera_ids)).all()
    } if camera_ids else {}

    # Events are matched on (video_id, timestamp) pairs — fetch all events for
    # the involved videos once, then index in-memory instead of one query per row.
    events_by_key = {}
    if vid_ids:
        for ev in db.query(Event).filter(Event.video_id.in_(vid_ids)).all():
            events_by_key[(ev.video_id, round(ev.timestamp, 2))] = ev

    # Enrich with DB metadata (all in-memory lookups now — no queries in the loop)
    enriched = []
    for r in raw_results:
        vid_id = r["video_id"]
        video = videos_by_id.get(vid_id)

        camera_name = None
        if video and video.camera_id:
            cam = cameras_by_id.get(video.camera_id)
            camera_name = cam.name if cam else None

        event = events_by_key.get((vid_id, round(r["timestamp"], 2)))

        ts = r["timestamp"]
        reason, tags = _extract_tags_and_reason(r["caption"], q, r.get("best_clause"))

        enriched.append(EventOut(
            id=event.id if event else "",
            video_id=vid_id,
            timestamp=ts,
            time_str=f"{int(ts // 60):02d}:{int(ts % 60):02d}",
            caption=r["caption"],
            thumbnail_path=event.thumbnail_path if event else None,
            match_score=r.get("match_score", 0.0),
            video_filename=video.filename if video else None,
            camera_name=camera_name,
            resolution=video.resolution if video else None,
            ai_match_reason=reason,
            detected_tags=tags,
            track_id=event.track_id if event else None,
            bbox=event.bbox if event else None,
        ))

    elapsed_ms = (time.time() - start_time) * 1000

    # Generate AI Intelligence Briefing
    ai_summary, ai_insights, suggested_queries = _synthesize_ai_intelligence(q, enriched)

    # Log the search
    log_entry = SearchLog(
        query=q,
        results_count=len(enriched),
        filters_used=json.dumps({
            "camera_id": camera_id,
            "video_id": video_id,
            "min_score": min_score,
            "time_from": time_from,
            "time_to": time_to,
        }),
        search_time_ms=round(elapsed_ms, 1),
    )
    db.add(log_entry)
    db.commit()

    return SearchResponse(
        query=q,
        results=enriched,
        total_matches=len(enriched),
        search_time_ms=round(elapsed_ms, 1),
        ai_summary=ai_summary,
        ai_insights=ai_insights,
        suggested_queries=suggested_queries,
    )


@router.get("/events", response_model=List[EventOut])
def get_all_recent_events(
    limit: int = Query(20, ge=1, le=100), 
    camera_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get the most recent detected CCTV events across all cameras and videos."""
    query = db.query(Event)
    
    if camera_id:
        query = query.join(Video).filter(Video.camera_id == camera_id)
        
    events = (
        query
        .order_by(Event.id.desc())
        .limit(limit)
        .all()
    )

    # Batch-fetch videos/cameras instead of one query per event
    vid_ids = {ev.video_id for ev in events}
    videos_by_id = {
        v.id: v for v in db.query(Video).filter(Video.id.in_(vid_ids)).all()
    } if vid_ids else {}
    camera_ids = {v.camera_id for v in videos_by_id.values() if v.camera_id}
    cameras_by_id = {
        c.id: c for c in db.query(Camera).filter(Camera.id.in_(camera_ids)).all()
    } if camera_ids else {}

    results = []
    for ev in events:
        video = videos_by_id.get(ev.video_id)
        camera_name = None
        if video and video.camera_id:
            cam = cameras_by_id.get(video.camera_id)
            camera_name = cam.name if cam else None

        ts = ev.timestamp
        results.append(EventOut(
            id=ev.id,
            video_id=ev.video_id,
            timestamp=ts,
            time_str=f"{int(ts // 60):02d}:{int(ts % 60):02d}",
            caption=ev.caption,
            thumbnail_path=ev.thumbnail_path,
            match_score=100.0,
            video_filename=video.filename if video else None,
            camera_id=video.camera_id if video else None,
            camera_name=camera_name,
            resolution=video.resolution if video else None,
            track_id=ev.track_id,
            bbox=ev.bbox,
        ))
    return results


@router.get("/events/{video_id}", response_model=List[EventOut])
def get_video_events(video_id: str, db: Session = Depends(get_db)):
    """Get all events for a specific video, ordered by timestamp."""
    events = (
        db.query(Event)
        .filter(Event.video_id == video_id)
        .order_by(Event.timestamp)
        .all()
    )

    video = db.query(Video).filter(Video.id == video_id).first()
    camera_name = None
    if video and video.camera_id:
        cam = db.query(Camera).filter(Camera.id == video.camera_id).first()
        camera_name = cam.name if cam else None

    results = []
    for ev in events:
        ts = ev.timestamp
        results.append(EventOut(
            id=ev.id,
            video_id=ev.video_id,
            timestamp=ts,
            time_str=f"{int(ts // 60):02d}:{int(ts % 60):02d}",
            caption=ev.caption,
            thumbnail_path=ev.thumbnail_path,
            match_score=100.0,  # Direct lookup, not search
            video_filename=video.filename if video else None,
            camera_name=camera_name,
            resolution=video.resolution if video else None,
            track_id=ev.track_id,
            bbox=ev.bbox,
        ))
    return results


@router.get("/tracks/{video_id}/{track_id}", response_model=List[EventOut])
def get_track_events(video_id: str, track_id: int, db: Session = Depends(get_db)):
    """
    All events belonging to the same tracked object within one video, in
    chronological order — e.g. "show every keyframe this vehicle appears in."
    track_id is scoped to a single video's tracking run (see IOUTracker /
    models.Event.track_id), not a global cross-video identity.
    """
    events = (
        db.query(Event)
        .filter(Event.video_id == video_id, Event.track_id == track_id)
        .order_by(Event.timestamp)
        .all()
    )

    video = db.query(Video).filter(Video.id == video_id).first()
    camera_name = None
    if video and video.camera_id:
        cam = db.query(Camera).filter(Camera.id == video.camera_id).first()
        camera_name = cam.name if cam else None

    results = []
    for ev in events:
        ts = ev.timestamp
        results.append(EventOut(
            id=ev.id,
            video_id=ev.video_id,
            timestamp=ts,
            time_str=f"{int(ts // 60):02d}:{int(ts % 60):02d}",
            caption=ev.caption,
            thumbnail_path=ev.thumbnail_path,
            match_score=100.0,
            video_filename=video.filename if video else None,
            camera_name=camera_name,
            resolution=video.resolution if video else None,
            track_id=ev.track_id,
            bbox=ev.bbox,
        ))
    return results


@router.get("/events/{video_id}/{event_id}/thumbnail")
def get_event_thumbnail(video_id: str, event_id: str, db: Session = Depends(get_db)):
    """Serve the keyframe thumbnail for a specific event."""
    event = db.query(Event).filter(Event.id == event_id, Event.video_id == video_id).first()
    if not event or not event.thumbnail_path:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    thumb_path = THUMBNAIL_DIR / event.thumbnail_path
    if thumb_path.exists():
        return FileResponse(str(thumb_path), media_type="image/jpeg")
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Thumbnail file missing")
