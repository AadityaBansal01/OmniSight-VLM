"""
Camera management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from pathlib import Path
import shutil

from app.config import VIDEO_DIR, THUMBNAIL_DIR
from app.ai.vector_store import VectorStore
from app.database import get_db
from app.models import Camera, Video
from app.schemas import CameraCreate, CameraUpdate, CameraOut


router = APIRouter(prefix="/api/v1/cameras", tags=["Cameras"])


def _camera_to_out(camera: Camera, db: Session) -> dict:
    videos = db.query(Video).filter(Video.camera_id == camera.id).all()
    video_count = len(videos)
    total_size_bytes = sum(v.file_size or 0 for v in videos)

    resolution = None
    fps = None
    if camera.rtsp_url:
        status = "ONLINE"
    elif video_count:
        status = "RECORDED"
    else:
        status = "STANDBY"

    for v in videos:
        if v.resolution:
            resolution = v.resolution
        if v.fps:
            fps = round(v.fps, 1)
        if v.status == "indexing":
            status = "INDEXING"
            break
        elif v.status == "error":
            status = "ERROR"

    return {
        "id": camera.id,
        "name": camera.name,
        "location": camera.location,
        "zone_tag": camera.zone_tag,
        "rtsp_url": camera.rtsp_url,
        "created_at": camera.created_at,
        "video_count": video_count,
        "total_size_bytes": total_size_bytes,
        "resolution": resolution or "N/A",
        "fps": fps,
        "status": status,
    }


@router.get("", response_model=List[CameraOut])
def list_cameras(db: Session = Depends(get_db)):
    """List all cameras with real video resolution, FPS, and storage."""
    cameras = db.query(Camera).order_by(Camera.created_at.desc()).all()
    return [_camera_to_out(c, db) for c in cameras]


@router.post("", response_model=CameraOut)
def create_camera(data: CameraCreate, db: Session = Depends(get_db)):
    """Create a new camera source."""
    camera = Camera(
        name=data.name,
        location=data.location,
        zone_tag=data.zone_tag,
        rtsp_url=data.rtsp_url,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    
    if camera.rtsp_url:
        from app.services.rtsp_service import restart_camera_stream
        restart_camera_stream(camera.id, camera.rtsp_url)
        
    return _camera_to_out(camera, db)


@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(camera_id: str, data: CameraUpdate, db: Session = Depends(get_db)):
    """Update camera metadata."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    if data.name is not None:
        camera.name = data.name
    if data.location is not None:
        camera.location = data.location
    if data.zone_tag is not None:
        camera.zone_tag = data.zone_tag
    if data.rtsp_url is not None:
        camera.rtsp_url = data.rtsp_url

    db.commit()
    db.refresh(camera)
    
    if camera.rtsp_url:
        from app.services.rtsp_service import restart_camera_stream
        restart_camera_stream(camera.id, camera.rtsp_url)
        
    return _camera_to_out(camera, db)


@router.delete("/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    """Delete a camera and thoroughly clean up all associated videos, thumbnails, and vector index entries."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    videos = db.query(Video).filter(Video.camera_id == camera_id).all()
    vector_store = VectorStore()

    for video in videos:
        # Delete video file
        video_path = VIDEO_DIR / Path(video.filepath).name
        if video_path.exists():
            video_path.unlink(missing_ok=True)

        # Delete thumbnails
        thumb_dir = THUMBNAIL_DIR / video.id
        if thumb_dir.exists():
            shutil.rmtree(thumb_dir, ignore_errors=True)

        # Delete from ChromaDB
        try:
            vector_store.delete_video_events(video.id)
        except Exception:
            pass

    db.delete(camera)
    db.commit()
    return {"status": "deleted", "camera_id": camera_id}
