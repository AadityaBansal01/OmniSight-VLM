"""
Keyframe thumbnail extraction and storage.
Generates JPEG thumbnails from video frames for search result previews.
"""
import cv2
import os
from pathlib import Path

from app.config import THUMBNAIL_DIR


def save_keyframe_thumbnail(
    frame,
    video_id: str,
    timestamp: float,
    quality: int = 85,
) -> str:
    """
    Save a video frame as a JPEG thumbnail.

    Args:
        frame: OpenCV BGR frame (numpy array).
        video_id: Video identifier for organizing thumbnails.
        timestamp: Timestamp in seconds.
        quality: JPEG compression quality (0-100).

    Returns:
        Relative path to the saved thumbnail (relative to data dir).
    """
    # Create per-video thumbnail directory
    video_thumb_dir = THUMBNAIL_DIR / video_id
    video_thumb_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename
    filename = f"{timestamp:.2f}s.jpg"
    filepath = video_thumb_dir / filename

    # Resize to a reasonable thumbnail size (480px wide, keep aspect ratio)
    h, w = frame.shape[:2]
    thumb_width = 480
    thumb_height = int(h * (thumb_width / w))
    thumb = cv2.resize(frame, (thumb_width, thumb_height))

    # Save with quality setting
    cv2.imwrite(
        str(filepath),
        thumb,
        [cv2.IMWRITE_JPEG_QUALITY, quality],
    )

    # Return path relative to the thumbnails directory
    return f"{video_id}/{filename}"


def generate_video_poster(video_path: str, video_id: str) -> str:
    """
    Extract a single frame from the video to use as a poster/thumbnail.
    Takes a frame from ~10% into the video to avoid black intros.

    Returns:
        Relative path to the poster image.
    """
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Seek to 10% into the video
    target_frame = max(1, int(total * 0.1))
    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)

    ret, frame = cap.read()
    cap.release()

    if not ret:
        return ""

    poster_dir = THUMBNAIL_DIR / video_id
    poster_dir.mkdir(parents=True, exist_ok=True)
    poster_path = poster_dir / "poster.jpg"

    h, w = frame.shape[:2]
    thumb_width = 640
    thumb_height = int(h * (thumb_width / w))
    thumb = cv2.resize(frame, (thumb_width, thumb_height))

    cv2.imwrite(str(poster_path), thumb, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return f"{video_id}/poster.jpg"
