import os
from pathlib import Path
import sys

# Ensure backend dir is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import time

from app.database import init_db, SessionLocal
from app.models import Video, Camera
from app.config import VIDEO_DIR
from app.services.pipeline_service import run_indexing_pipeline, get_pipeline_status


def _wait_for_pipeline_idle(poll_sec: float = 1.0, timeout_sec: float = 1800.0):
    """
    Block until the background pipeline worker has finished the job we just
    enqueued (or errored out).

    run_indexing_pipeline() only enqueues work onto a background daemon
    thread and returns immediately — it does NOT run synchronously. This
    script's main thread would otherwise finish and exit right after
    enqueueing, which kills the daemon worker before it ever finishes
    indexing (daemon threads die with the process). Every call site below
    must wait on this before moving to the next video or exiting.
    """
    start = time.time()
    # Give the worker a moment to pick the job up and flip is_running=True
    time.sleep(poll_sec)
    while True:
        status = get_pipeline_status()
        if not status.is_running:
            return
        if time.time() - start > timeout_sec:
            print(f"  [seed] Warning: pipeline still running after {timeout_sec:.0f}s — giving up waiting.")
            return
        time.sleep(poll_sec)

def seed():
    print("Initializing Database...")
    init_db()
    
    db = SessionLocal()
    try:
        # Create default cameras if not exist
        cam1 = db.query(Camera).filter(Camera.name == "CAM-01 (Garage B1)").first()
        if not cam1:
            cam1 = Camera(name="CAM-01 (Garage B1)", location="Underground Parking B1", zone_tag="Vehicle Lane")
            db.add(cam1)
            
        cam2 = db.query(Camera).filter(Camera.name == "CAM-02 (Gate A)").first()
        if not cam2:
            cam2 = Camera(name="CAM-02 (Gate A)", location="North Pedestrian Crosswalk", zone_tag="Pedestrian Zone")
            db.add(cam2)
            
        cam3 = db.query(Camera).filter(Camera.name == "CAM-03 (Retail Floor)").first()
        if not cam3:
            cam3 = Camera(name="CAM-03 (Retail Floor)", location="Main Store Checkout & Aisles", zone_tag="Indoor Retail")
            db.add(cam3)
            
        db.commit()
        db.refresh(cam1)
        db.refresh(cam2)
        db.refresh(cam3)
        print("Cameras ready.")

        # Repair existing absolute paths in DB (relative filename storage)
        print("Repairing existing video paths in DB...")
        all_videos = db.query(Video).all()
        for v in all_videos:
            if os.path.isabs(v.filepath):
                v.filepath = Path(v.filepath).name
        db.commit()

        # Bundled sample footage. Add additional local files here when available.
        videos_to_seed = [
            {"filename": "sample_cctv.mp4", "camera": cam1},
            {"filename": "real_pedestrians.mp4", "camera": cam2},
        ]

        repo_root = Path(__file__).resolve().parent
        for item in videos_to_seed:
            source = repo_root / item["filename"]
            target = VIDEO_DIR / item["filename"]
            if source.exists() and not target.exists():
                target.write_bytes(source.read_bytes())
        for v_info in videos_to_seed:
            filename = v_info["filename"]
            camera = v_info["camera"]
            video_path = VIDEO_DIR / filename
            
            if not video_path.exists() or video_path.stat().st_size == 0:
                print(f"Skipping {filename}: Not found or empty.")
                continue
                
            # Check if already in DB
            existing = db.query(Video).filter(Video.filename == filename).first()
            if existing:
                print(f"Video {filename} already in DB. Skipping.")
                continue
                
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
            # run_indexing_pipeline() only enqueues to the background worker
            # thread — it returns immediately. Block here until that job
            # actually finishes, or this script exits and kills the worker
            # (a daemon thread) before any real indexing happens.
            run_indexing_pipeline(video.id)
            _wait_for_pipeline_idle()
            print(f"Finished indexing {filename}.\n")
            
    finally:
        db.close()

if __name__ == "__main__":
    seed()
