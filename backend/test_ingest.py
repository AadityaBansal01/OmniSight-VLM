import os
import sys
from pathlib import Path

# Ensure backend dir is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import time

from app.database import SessionLocal
from app.models import Video, Camera
from app.config import VIDEO_DIR
from app.services.pipeline_service import run_indexing_pipeline, get_pipeline_status


def _wait_for_pipeline_idle(poll_sec: float = 1.0, timeout_sec: float = 1800.0):
    """See seed.py for why this is needed: run_indexing_pipeline() only
    enqueues to a background daemon thread and returns immediately, so
    without this the script exits (killing the daemon thread) before any
    indexing actually happens."""
    start = time.time()
    time.sleep(poll_sec)
    while True:
        status = get_pipeline_status()
        if not status.is_running:
            return
        if time.time() - start > timeout_sec:
            print(f"  [test_ingest] Warning: pipeline still running after {timeout_sec:.0f}s — giving up waiting.")
            return
        time.sleep(poll_sec)

def ingest():
    db = SessionLocal()
    try:
        # Get the camera we just created
        camera = db.query(Camera).filter(Camera.name == "High Res Street").first()
        if not camera:
            print("Camera not found")
            return
            
        filename = "15715546_1080_1920_60fps.mp4"
        video_path = VIDEO_DIR / filename
        
        if not video_path.exists():
            print(f"Video {video_path} not found")
            return
            
        existing = db.query(Video).filter(Video.filename == filename).first()
        if existing:
            print("Video already ingested")
            return
            
        print(f"Ingesting {filename}...")
        video = Video(
            camera_id=camera.id,
            filename=filename,
            filepath=str(video_path),
            file_size=video_path.stat().st_size,
            status="uploaded"
        )
        db.add(video)
        db.commit()
        db.refresh(video)
        
        print(f"Running indexing pipeline for {filename}...")
        run_indexing_pipeline(video.id)
        _wait_for_pipeline_idle()
        print(f"Finished indexing {filename}.\n")
    finally:
        db.close()

if __name__ == "__main__":
    ingest()
