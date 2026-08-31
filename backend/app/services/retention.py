import os
import time
import threading
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Video, Event
from app.config import RETENTION_DAYS, VIDEO_DIR, THUMBNAIL_DIR
from app.ai.vector_store import VectorStore

_retention_thread = None
_stop_event = threading.Event()

def _retention_worker():
    """
    Background worker that runs daily to delete videos and their physical
    files/events that are older than RETENTION_DAYS.
    """
    print(f"🧹 Started retention policy worker. Retention is set to {RETENTION_DAYS} days.")
    
    # Run every 24 hours, but first run is right away
    while not _stop_event.is_set():
        try:
            db = SessionLocal()
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
            
            # Find old videos
            old_videos = db.query(Video).filter(Video.created_at < cutoff_date).all()
            
            if old_videos:
                print(f"🧹 Found {len(old_videos)} videos older than {RETENTION_DAYS} days. Deleting...")
                for v in old_videos:
                    # 1. Delete physical file. Uploads may store either a bare
                    # filename or an absolute RTSP chunk path.
                    if v.filepath:
                        file_path = Path(v.filepath) if os.path.isabs(v.filepath) else (VIDEO_DIR / Path(v.filepath).name)
                        if file_path.exists():
                            file_path.unlink()

                    # 2. Delete thumbnails.
                    thumb_dir = THUMBNAIL_DIR / v.id
                    if thumb_dir.exists():
                        import shutil
                        shutil.rmtree(thumb_dir, ignore_errors=True)

                    # 3. Delete from ChromaDB vector store
                    VectorStore().delete_video_events(v.id)
                    
                    # 3. Delete from SQL Database
                    db.delete(v)
                
                db.commit()
                print("🧹 Cleanup complete.")
            else:
                print("🧹 No old videos found to delete.")
                
        except Exception as e:
            print(f"🧹 Error running retention cleanup: {e}")
        finally:
            db.close()
            
        # Sleep for 24 hours (check frequently if stop event is set)
        for _ in range(24 * 60 * 60):
            if _stop_event.is_set():
                break
            time.sleep(1)
            
    print("🧹 Retention policy worker stopped.")

def start_retention_worker():
    global _retention_thread
    if not _retention_thread or not _retention_thread.is_alive():
        _stop_event.clear()
        _retention_thread = threading.Thread(target=_retention_worker, daemon=True)
        _retention_thread.start()

def stop_retention_worker():
    _stop_event.set()
    if _retention_thread and _retention_thread.is_alive():
        _retention_thread.join(timeout=5)
