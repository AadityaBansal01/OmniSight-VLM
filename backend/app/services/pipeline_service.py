"""
Full AI pipeline orchestrator.
Coordinates: Motion Pruning → Florence-2 Captioning → Thumbnail Generation → ChromaDB Indexing.
Updates the SQLite database and broadcasts progress via WebSocket.

Pipeline runs are serialized through a single background worker thread and a
FIFO queue. This matters because:
  1. `pipeline_status` is one shared object — two runs updating it at once
     would produce garbled/interleaved progress for WebSocket clients.
  2. Florence-2 inference is heavy (GPU/MPS memory) — running two VLM jobs
     concurrently on one machine competes for the same device and can crash
     or badly slow both down.
Callers (upload endpoint, manual trigger endpoint) just call
`run_indexing_pipeline(video_id)` as before — it now enqueues instead of
running inline, so concurrent uploads queue up and process one at a time
instead of racing.
"""
import os
import queue
import threading
import traceback
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Video, Event
from app.schemas import PipelineStatus
from app.ai.motion_pruner import extract_motion_keyframes
from app.ai.captioner import KeyframeCaptioner
from app.ai.vector_store import VectorStore
from app.ai.thumbnail import save_keyframe_thumbnail, generate_video_poster
from app.config import VIDEO_DIR
from app.websocket import ws_manager


# Global pipeline status — only ever mutated from the single worker thread below.
pipeline_status = PipelineStatus()

_job_queue: "queue.Queue[str]" = queue.Queue()
_queued_video_ids: set = set()
_queue_lock = threading.Lock()
_worker_started = False
_worker_lock = threading.Lock()


def _worker_loop():
    """Pulls video_ids off the queue and indexes them strictly one at a time."""
    while True:
        video_id = _job_queue.get()
        try:
            with _queue_lock:
                _queued_video_ids.discard(video_id)
            _run_indexing_pipeline_impl(video_id)
        except Exception:
            traceback.print_exc()
        finally:
            _job_queue.task_done()


def _ensure_worker_started():
    global _worker_started
    with _worker_lock:
        if not _worker_started:
            t = threading.Thread(target=_worker_loop, daemon=True, name="pipeline-worker")
            t.start()
            _worker_started = True


def run_indexing_pipeline(video_id: str):
    """
    Public entry point. Enqueues the video for indexing — the dedicated
    worker thread processes the queue one video at a time, so this is safe
    to call from multiple concurrent requests (e.g. several quick uploads).
    """
    _ensure_worker_started()
    with _queue_lock:
        if video_id in _queued_video_ids:
            return  # already queued, avoid duplicate entries
        _queued_video_ids.add(video_id)
    _job_queue.put(video_id)


def _update_status(stage: str, progress: float, message: str, events_found: int = 0):
    """Update global status and broadcast via WebSocket."""
    pipeline_status.stage = stage
    pipeline_status.progress = progress
    pipeline_status.message = message
    if events_found > 0:
        pipeline_status.events_found = events_found
    ws_manager.broadcast_sync(pipeline_status.model_dump())


def _run_indexing_pipeline_impl(video_id: str):
    """
    Full indexing pipeline for a single video.
    Runs in a background thread — updates DB and broadcasts progress.
    """
    db: Session = SessionLocal()

    try:
        # Fetch video record
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            print(f"[Pipeline] Video {video_id} not found in database.")
            return

        video_path = video.filepath
        # Resolve relative paths (DB stores just the filename)
        if not os.path.isabs(video_path):
            video_path = str(VIDEO_DIR / video_path)
        if not os.path.exists(video_path):
            video.status = "error"
            video.error_msg = f"Video file not found: {video_path}"
            db.commit()
            return

        # Update status
        pipeline_status.is_running = True
        pipeline_status.video_id = video_id
        pipeline_status.video_filename = video.filename
        pipeline_status.events_found = 0

        video.status = "indexing"
        db.commit()

        print(f"\n{'='*60}")
        print(f"  CCTV Indexing Pipeline: {video.filename}")
        print(f"{'='*60}")

        # ── Stage 1: Motion Pruning ──
        _update_status("motion_pruning", 0.0, "Starting motion analysis...")

        def motion_progress(progress, msg):
            _update_status("motion_pruning", progress * 0.3, msg)  # 0-30% of total

        keyframes, video_meta = extract_motion_keyframes(
            video_path, progress_callback=motion_progress
        )

        # Update video metadata from OpenCV
        video.duration = video_meta["duration"]
        video.fps = video_meta["fps"]
        video.resolution = video_meta["resolution"]
        db.commit()

        if not keyframes:
            video.status = "indexed"
            video.indexed_at = datetime.now(timezone.utc)
            video.error_msg = "No motion detected"
            db.commit()
            _update_status("complete", 1.0, "No significant motion detected in video.", 0)
            return

        _update_status("motion_pruning", 0.3, f"Found {len(keyframes)} motion keyframes.")

        # ── Stage 2: Florence-2 Captioning ──
        _update_status("captioning", 0.3, "Loading Florence-2 VLM...")

        captioner = KeyframeCaptioner()

        def caption_progress(progress, msg):
            _update_status("captioning", 0.3 + progress * 0.4, msg)  # 30-70% of total

        events = captioner.caption_keyframes(keyframes, progress_callback=caption_progress)

        _update_status("indexing", 0.7, f"Captioned {len(events)} events. Generating thumbnails & embeddings...")

        # ── Stage 3: Thumbnail Generation + Vector Indexing ──
        vector_store = VectorStore()

        # Delete old events for this video (re-indexing)
        vector_store.delete_video_events(video_id)
        db.query(Event).filter(Event.video_id == video_id).delete()
        db.commit()

        # Generate poster for the video
        generate_video_poster(video_path, video_id)

        # Save thumbnails and create DB events
        db_events = []
        for idx, ev in enumerate(events):
            # Save thumbnail
            thumb_path = save_keyframe_thumbnail(
                keyframes[idx][1], video_id, ev["timestamp"]
            )

            # Create DB event record
            import json
            bbox_str = json.dumps(ev["bbox"]) if ev.get("bbox") else None
            db_event = Event(
                video_id=video_id,
                timestamp=ev["timestamp"],
                caption=ev["caption"],
                thumbnail_path=thumb_path,
                vector_id=f"{video_id}_{idx:04d}_{ev['timestamp']:.2f}",
                track_id=ev.get("track_id"),
                bbox=bbox_str,
            )
            db_events.append(db_event)

            progress = 0.7 + (idx + 1) / len(events) * 0.25  # 70-95%
            _update_status("indexing", progress, f"Indexing event {idx + 1}/{len(events)}", idx + 1)

        # Batch insert events into DB
        db.add_all(db_events)
        db.commit()

        # Index into ChromaDB
        camera_id = video.camera_id
        vector_ids = vector_store.index_events(
            video_id=video_id, events=events, camera_id=camera_id
        )

        # Update video status
        video.status = "indexed"
        video.indexed_at = datetime.now(timezone.utc)
        video.error_msg = None
        db.commit()

        _update_status("complete", 1.0, f"Indexed {len(events)} events successfully!", len(events))
        print(f"\n✅ Pipeline complete: {len(events)} events indexed for '{video.filename}'")

    except Exception as e:
        traceback.print_exc()
        try:
            video = db.query(Video).filter(Video.id == video_id).first()
            if video:
                video.status = "error"
                video.error_msg = str(e)[:500]
                db.commit()
        except Exception:
            pass
        _update_status("error", 0.0, f"Pipeline failed: {str(e)[:200]}")

    finally:
        pipeline_status.is_running = False
        db.close()


def get_pipeline_status() -> PipelineStatus:
    """Returns current pipeline status."""
    return pipeline_status
