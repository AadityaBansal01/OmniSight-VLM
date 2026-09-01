"""Index the bundled sample CCTV clip locally.

Requires backend dependencies and a machine capable of running Florence-2.
Run from the repository root: PYTHONPATH=backend python backend/demo_local.py
"""
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import VIDEO_DIR
from app.database import init_db, SessionLocal
from app.models import Camera, Video
from app.services.pipeline_service import run_indexing_pipeline, get_pipeline_status

SAMPLE = ROOT / "backend" / "sample_cctv.mp4"


def main():
    if not SAMPLE.exists():
        raise SystemExit(f"Missing sample video: {SAMPLE}")
    init_db()
    db = SessionLocal()
    try:
        cam = db.query(Camera).filter(Camera.name == "LOCAL-DEMO").first()
        if not cam:
            cam = Camera(name="LOCAL-DEMO", location="Bundled sample footage", zone_tag="Demo")
            db.add(cam)
            db.commit()
            db.refresh(cam)
        target = VIDEO_DIR / SAMPLE.name
        if not target.exists():
            target.write_bytes(SAMPLE.read_bytes())
        video = Video(camera_id=cam.id, filename=target.name, filepath=str(target), status="uploaded")
        db.add(video)
        db.commit()
        db.refresh(video)
        run_indexing_pipeline(video.id)
        print(f"Queued {target.name}. Open http://localhost:8000 and watch pipeline status.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
