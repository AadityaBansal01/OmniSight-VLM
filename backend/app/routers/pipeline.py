"""
Pipeline control API routes + WebSocket endpoint for live progress.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Video
from app.schemas import PipelineStatus
from app.services.pipeline_service import run_indexing_pipeline, get_pipeline_status
from app.websocket import ws_manager


router = APIRouter(prefix="/api/v1/pipeline", tags=["Pipeline"])


@router.post("/index")
def trigger_indexing(
    video_id: str = Query(..., description="Video ID to index"),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """Manually trigger the indexing pipeline for a video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")


    background_tasks.add_task(run_indexing_pipeline, video_id)
    return {
        "status": "started",
        "video_id": video_id,
        "video_filename": video.filename,
    }


@router.get("/status", response_model=PipelineStatus)
def pipeline_status():
    """Get current pipeline status."""
    return get_pipeline_status()


@router.websocket("/ws")
async def pipeline_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time pipeline progress.
    Clients connect here to receive live stage/progress/message updates.
    """
    await ws_manager.connect(websocket)
    try:
        # Send current status immediately on connect
        status = get_pipeline_status()
        await websocket.send_json(status.model_dump())

        # Keep connection alive — the broadcast_sync method pushes updates
        while True:
            # Wait for client messages (ping/keepalive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
