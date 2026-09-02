"""
Video management API routes.
Handles: upload, list, details, delete, byte-range streaming, and thumbnails.
"""
import os
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Request, Query, Form
from fastapi.responses import StreamingResponse, FileResponse, Response
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid

from app.database import get_db
from app.models import Video, Event, Camera
from app.schemas import VideoOut
from app.config import VIDEO_DIR, THUMBNAIL_DIR, ALLOWED_VIDEO_EXTENSIONS
from app.services.pipeline_service import run_indexing_pipeline


router = APIRouter(prefix="/api/v1/videos", tags=["Videos"])


def _video_to_out(video: Video, db: Session) -> dict:
    """Convert a single ORM Video to a response dict. Fine for one-off lookups
    (get_video, upload response) — for lists, use _videos_to_out_batch instead
    to avoid 2 extra queries per row."""
    event_count = db.query(Event).filter(Event.video_id == video.id).count()
    camera_name = None
    if video.camera_id:
        cam = db.query(Camera).filter(Camera.id == video.camera_id).first()
        camera_name = cam.name if cam else None
    return {
        "id": video.id,
        "camera_id": video.camera_id,
        "camera_name": camera_name,
        "filename": video.filename,
        "duration": video.duration,
        "fps": video.fps,
        "resolution": video.resolution,
        "file_size": video.file_size,
        "status": video.status,
        "error_msg": video.error_msg,
        "event_count": event_count,
        "created_at": video.created_at,
        "indexed_at": video.indexed_at,
    }


def _videos_to_out_batch(videos: List[Video], db: Session) -> List[dict]:
    """Same output as _video_to_out but for a whole list — 3 fixed queries
    total (event counts grouped, cameras, then in-memory joins) instead of
    2 queries per video."""
    if not videos:
        return []

    from sqlalchemy import func

    vid_ids = [v.id for v in videos]

    counts = dict(
        db.query(Event.video_id, func.count(Event.id))
        .filter(Event.video_id.in_(vid_ids))
        .group_by(Event.video_id)
        .all()
    )

    camera_ids = {v.camera_id for v in videos if v.camera_id}
    cameras_by_id = {
        c.id: c for c in db.query(Camera).filter(Camera.id.in_(camera_ids)).all()
    } if camera_ids else {}

    out = []
    for video in videos:
        camera_name = None
        if video.camera_id:
            cam = cameras_by_id.get(video.camera_id)
            camera_name = cam.name if cam else None
        out.append({
            "id": video.id,
            "camera_id": video.camera_id,
            "camera_name": camera_name,
            "filename": video.filename,
            "duration": video.duration,
            "fps": video.fps,
            "resolution": video.resolution,
            "file_size": video.file_size,
            "status": video.status,
            "error_msg": video.error_msg,
            "event_count": counts.get(video.id, 0),
            "created_at": video.created_at,
            "indexed_at": video.indexed_at,
        })
    return out


@router.get("", response_model=List[VideoOut])
def list_videos(
    camera_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all videos, optionally filtered by camera or status."""
    query = db.query(Video)
    if camera_id:
        query = query.filter(Video.camera_id == camera_id)
    if status:
        query = query.filter(Video.status == status)
    videos = query.order_by(Video.created_at.desc()).all()
    return _videos_to_out_batch(videos, db)


@router.get("/{video_id}", response_model=VideoOut)
def get_video(video_id: str, db: Session = Depends(get_db)):
    """Get details for a single video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return _video_to_out(video, db)


@router.post("/upload", response_model=VideoOut)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a video file and auto-trigger indexing."""
    # Enforce 500 MB upload limit
    from app.config import MAX_UPLOAD_SIZE_MB
    MAX_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Validate camera_id if provided BEFORE saving file
    if camera_id:
        cam = db.query(Camera).filter(Camera.id == camera_id).first()
        if not cam:
            raise HTTPException(status_code=400, detail=f"Camera '{camera_id}' not found")

    # Validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format '{ext}'. Supported: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}",
        )

    # Sanitize and unique filename
    clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename)
    unique_filename = f"{uuid.uuid4().hex[:8]}_{clean_name}"
    target_path = VIDEO_DIR / unique_filename

    # Save uploaded file in 1MB chunks
    file_size = 0
    with open(target_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            if file_size > MAX_SIZE_BYTES:
                target_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_SIZE_MB}MB")
            f.write(chunk)

    # Create DB record
    video = Video(
        camera_id=camera_id,
        filename=unique_filename,
        filepath=unique_filename,
        file_size=file_size,
        status="uploaded",
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    # Trigger background indexing
    background_tasks.add_task(run_indexing_pipeline, video.id)

    return _video_to_out(video, db)


@router.delete("/{video_id}")
def delete_video(video_id: str, db: Session = Depends(get_db)):
    """Delete a video and all its associated data."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Delete video file
    video_path = VIDEO_DIR / Path(video.filepath).name
    if video_path.exists():
        video_path.unlink(missing_ok=True)

    # Delete thumbnails
    thumb_dir = THUMBNAIL_DIR / video_id
    if thumb_dir.exists():
        import shutil
        shutil.rmtree(thumb_dir)

    # Delete from ChromaDB
    from app.ai.vector_store import VectorStore
    VectorStore().delete_video_events(video_id)

    # Delete from DB (cascades to events)
    db.delete(video)
    db.commit()

    return {"status": "deleted", "video_id": video_id}


@router.head("/{video_id}/stream", operation_id="stream_video_head")
def stream_video_head(video_id: str, db: Session = Depends(get_db)):
    """Return stream headers for HEAD probe requests (Accept-Ranges and Content-Length)."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = VIDEO_DIR / Path(video.filepath).name
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file missing from disk")

    file_size = video_path.stat().st_size
    ext = Path(video_path).suffix.lower()
    content_type = {
        ".mp4": "video/mp4",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
    }.get(ext, "video/mp4")

    return Response(
        status_code=200,
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )


@router.get("/{video_id}/stream", operation_id="stream_video_get")
def stream_video(request: Request, video_id: str, db: Session = Depends(get_db)):
    """
    HTTP 206 Byte-Range video streaming.
    Enables instant seek in HTML5 video players without downloading the full file.
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = VIDEO_DIR / Path(video.filepath).name
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file missing from disk")

    file_size = video_path.stat().st_size
    range_header = request.headers.get("Range")

    # Determine content type from extension
    ext = Path(video_path).suffix.lower()
    content_type = {
        ".mp4": "video/mp4",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
    }.get(ext, "video/mp4")

    if not range_header:
        def iterfile():
            with open(video_path, "rb") as f:
                yield from f
        return StreamingResponse(
            iterfile(),
            media_type=content_type,
            headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
        )

    # Parse byte range
    try:
        byte_range = range_header.replace("bytes=", "")
        if "-" not in byte_range:
            raise ValueError()
        start_str, end_str = byte_range.split("-", 1)
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
    except ValueError:
        start = 0
        end = file_size - 1

    start = max(0, start)
    end = min(end, file_size - 1)
    
    if start >= file_size or start > end:
        raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

    chunk_size = (end - start) + 1

    def send_range():
        with open(video_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                read_size = min(remaining, 1024 * 1024)
                data = f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    return StreamingResponse(
        send_range(),
        status_code=206,
        media_type=content_type,
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
        },
    )


@router.get("/{video_id}/thumbnail")
def get_video_thumbnail(
    video_id: str,
    t: Optional[float] = Query(None, description="Timestamp in seconds"),
    db: Session = Depends(get_db)
):
    """Get the poster/thumbnail image for a video, or the closest keyframe thumbnail to timestamp t."""
    thumb_dir = THUMBNAIL_DIR / video_id
    if not thumb_dir.exists():
        raise HTTPException(status_code=404, detail="Thumbnail directory not found")

    # If t is provided, find the closest keyframe thumbnail
    if t is not None:
        exact_candidate = thumb_dir / f"{t:.2f}s.jpg"
        if exact_candidate.exists():
            return FileResponse(str(exact_candidate), media_type="image/jpeg")

        # Find nearest existing .jpg file in thumb_dir
        jpg_files = [p for p in thumb_dir.glob("*.jpg") if p.name != "poster.jpg"]
        if jpg_files:
            def extract_diff(p):
                stem = p.stem.replace("s", "")
                try:
                    return abs(float(stem) - t)
                except ValueError:
                    return 999999.0
            best = min(jpg_files, key=extract_diff)
            return FileResponse(str(best), media_type="image/jpeg")

    # Fallback to poster or any available jpg
    poster_path = thumb_dir / "poster.jpg"
    if poster_path.exists():
        return FileResponse(str(poster_path), media_type="image/jpeg")

    jpg_files = list(thumb_dir.glob("*.jpg"))
    if jpg_files:
        return FileResponse(str(jpg_files[0]), media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Thumbnail not available")
