import cv2
import threading
import time
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Camera, Video
from app.config import VIDEO_DIR
from app.services.pipeline_service import run_indexing_pipeline

# Set FFMPEG timeout options for OpenCV to prevent cap.read() from hanging indefinitely (5 seconds)
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;5000000|stimeout;5000000"

# Dictionary to keep track of active RTSP threads and their stop events
# Format: {camera_id: (thread, stop_event)}
_active_streams = {}
_streams_lock = threading.Lock()

def _rtsp_worker(camera_id: str, rtsp_url: str, stop_event: threading.Event):
    """Capture an RTSP stream into 60-second MP4 chunks with reconnect logic."""
    print(f"[RTSP] Starting stream capture for camera {camera_id}")
    chunk_duration_sec = 60
    reconnect_delay = 2
    max_reconnect_delay = 30
    cap = None
    out = None
    out_filepath = None
    filename = None
    frames_written = 0
    fps = 15.0
    width, height = 1920, 1080
    max_consecutive_read_failures = 5
    read_failures = 0

    def open_capture():
        nonlocal cap, fps, width, height, reconnect_delay, read_failures
        if cap is not None:
            cap.release()
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            cap.release()
            cap = None
            return False
        detected_fps = cap.get(cv2.CAP_PROP_FPS)
        fps = detected_fps if 0 < detected_fps <= 120 else 15.0
        detected_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        detected_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        width = detected_width or 1920
        height = detected_height or 1080
        read_failures = 0
        reconnect_delay = 2
        return True

    def finalize_chunk():
        nonlocal out, out_filepath, filename, frames_written
        if out is None or out_filepath is None or frames_written == 0:
            if out is not None:
                out.release()
            out = None
            out_filepath = None
            filename = None
            frames_written = 0
            return
        out.release()
        out = None
        try:
            db = SessionLocal()
            try:
                file_size = os.path.getsize(out_filepath)
                duration = frames_written / fps if fps > 0 else chunk_duration_sec
                video = Video(
                    camera_id=camera_id,
                    filename=filename,
                    filepath=out_filepath,
                    duration=duration,
                    fps=fps,
                    resolution=f"{width}x{height}",
                    file_size=file_size,
                    status="uploaded",
                )
                db.add(video)
                db.commit()
                db.refresh(video)
                print(f"[RTSP] Finalized {filename}; queueing AI indexing.")
                run_indexing_pipeline(video.id)
            finally:
                db.close()
        except Exception as exc:
            print(f"[RTSP] Error registering chunk {filename}: {exc}")
        out_filepath = None
        filename = None
        frames_written = 0

    try:
        while not stop_event.is_set():
            if cap is None and not open_capture():
                print(f"[RTSP] Camera {camera_id} unavailable; retrying in {reconnect_delay}s...")
                stop_event.wait(reconnect_delay)
                reconnect_delay = min(max_reconnect_delay, reconnect_delay * 2)
                continue

            ret, frame = cap.read()
            if not ret or frame is None:
                read_failures += 1
                print(f"[RTSP] Read failure {read_failures}/{max_consecutive_read_failures} for camera {camera_id}")
                if read_failures >= max_consecutive_read_failures:
                    finalize_chunk()
                    cap.release()
                    cap = None
                    reconnect_delay = min(max_reconnect_delay, max(2, reconnect_delay * 2))
                    stop_event.wait(reconnect_delay)
                else:
                    stop_event.wait(0.5)
                continue

            read_failures = 0
            if out is None:
                chunk_id = str(uuid.uuid4())
                filename = f"rtsp_{camera_id}_{chunk_id}.mp4"
                out_filepath = str(VIDEO_DIR / filename)
                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                out = cv2.VideoWriter(out_filepath, fourcc, fps, (width, height))
                if not out.isOpened():
                    print(f"[RTSP] Could not open writer for {filename}")
                    out.release()
                    out = None
                    out_filepath = None
                    filename = None
                    stop_event.wait(2)
                    continue
                frames_written = 0

            out.write(frame)
            frames_written += 1
            max_frames = max(1, int(fps * chunk_duration_sec))
            if frames_written >= max_frames:
                finalize_chunk()

    except Exception as exc:
        print(f"[RTSP] Fatal error in worker for {camera_id}: {exc}")
    finally:
        finalize_chunk()
        if cap is not None:
            cap.release()
        print(f"[RTSP] Stopped stream capture for camera {camera_id}")

def start_rtsp_streams():
    """Start RTSP threads for all cameras that have an rtsp_url."""
    db = SessionLocal()
    cameras = db.query(Camera).filter(Camera.rtsp_url.isnot(None)).all()
    db.close()
    
    with _streams_lock:
        for cam in cameras:
            if cam.rtsp_url.strip() and cam.id not in _active_streams:
                stop_event = threading.Event()
                t = threading.Thread(
                    target=_rtsp_worker,
                    args=(cam.id, cam.rtsp_url.strip(), stop_event),
                    daemon=True
                )
                t.start()
                _active_streams[cam.id] = (t, stop_event)
                
def stop_rtsp_streams(timeout: float = 5.0):
    """Stop all active RTSP streams and wait for them to finish."""
    with _streams_lock:
        threads_to_join = []
        for cam_id, (t, stop_event) in _active_streams.items():
            stop_event.set()
            threads_to_join.append(t)
        _active_streams.clear()

    # Join outside the lock to prevent deadlocks
    for t in threads_to_join:
        t.join(timeout=timeout)

def restart_camera_stream(camera_id: str, rtsp_url: str):
    """Restart or start a specific camera stream (e.g. after config update)."""
    with _streams_lock:
        if camera_id in _active_streams:
            old_t, stop_event = _active_streams[camera_id]
            stop_event.set()
            # Join for a short period inside lock is risky, but we need it dead before starting new one.
            # To be safe, we release lock, join, then reacquire, or just do a brief wait.
            old_t.join(timeout=2.0)
            del _active_streams[camera_id]
            
        if rtsp_url and rtsp_url.strip():
            stop_event = threading.Event()
            t = threading.Thread(
                target=_rtsp_worker,
                args=(camera_id, rtsp_url.strip(), stop_event),
                daemon=True
            )
            t.start()
            _active_streams[camera_id] = (t, stop_event)
