"""
OpenCV MOG2 Background Subtraction for temporal keyframe extraction.
Prunes 95%+ of static surveillance frames, keeping only moments with significant motion.
"""
import cv2
import numpy as np
from typing import List, Tuple, Callable, Optional

from app.config import (
    MOTION_MIN_CONTOUR_AREA,
    MOTION_COOLDOWN_SEC,
    MOTION_MOG2_HISTORY,
    MOTION_MOG2_VAR_THRESHOLD,
    MOTION_WARMUP_SEC,
)
from app.ai.tracker import IOUTracker


def extract_motion_keyframes(
    video_path: str,
    min_contour_area: int = MOTION_MIN_CONTOUR_AREA,
    cooldown_sec: float = MOTION_COOLDOWN_SEC,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> Tuple[List[Tuple[float, np.ndarray]], dict]:
    """
    Scans a video file, detects significant motion via MOG2 background subtraction,
    and extracts keyframes with timestamps while pruning out static frames.

    Args:
        video_path: Path to the video file.
        min_contour_area: Minimum pixel area for a contour to count as "significant motion".
        cooldown_sec: Minimum seconds between consecutive keyframe captures.
        progress_callback: Optional function(progress: float, message: str) for live updates.

    Returns:
        Tuple of (keyframes_list, video_metadata_dict)
        - keyframes: [(timestamp_seconds, frame_ndarray, track_id_or_None), ...]
          track_id links this keyframe to the same physical object across
          other keyframes (see app.ai.tracker.IOUTracker) — None if no
          motion contour could be tracked (e.g. borderline/noisy frame).
        - metadata: {"fps": float, "duration": float, "resolution": str, "total_frames": int}
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0.0

    video_meta = {
        "fps": fps,
        "duration": round(duration, 2),
        "resolution": f"{width}x{height}",
        "total_frames": total_frames,
    }

    print(f"\n[Motion Pruner] {video_path}")
    print(f"  Frames: {total_frames} | FPS: {fps:.1f} | Duration: {duration:.1f}s | Resolution: {width}x{height}")

    # MOG2 Background Subtractor
    back_sub = cv2.createBackgroundSubtractorMOG2(
        history=MOTION_MOG2_HISTORY,
        varThreshold=MOTION_MOG2_VAR_THRESHOLD,
        detectShadows=True,
    )

    keyframes = []
    last_saved_time = -cooldown_sec
    frame_idx = 0
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    tracker = IOUTracker()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        current_time = frame_idx / fps
        frame_idx += 1

        # Report progress every 100 frames
        if progress_callback and frame_idx % 100 == 0:
            progress = frame_idx / total_frames if total_frames > 0 else 0.0
            progress_callback(progress, f"Scanning frame {frame_idx}/{total_frames}")

        # 1. Downscale for fast processing
        small = cv2.resize(frame, (640, 360))

        # 2. Foreground mask
        fg_mask = back_sub.apply(small)

        # 3. Filter shadows (keep only strong foreground > 200)
        _, thresh = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)

        # 4. Morphological cleanup
        clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        # 5. Find contours
        contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # 6. Check for significant motion + collect normalized boxes for tracking
        # Bounding boxes are generated on the 640x360 downscaled image.
        # We normalize them to [0.0, 1.0] to be resolution-independent.
        sig_boxes = []
        for c in contours:
            if cv2.contourArea(c) > min_contour_area:
                x, y, w, h = cv2.boundingRect(c)
                sig_boxes.append((x / 640.0, y / 360.0, w / 640.0, h / 360.0))
        
        significant = len(sig_boxes) > 0

        # Tracker runs every frame (not just on keyframe capture) so track
        # identity survives the cooldown gap between saved keyframes.
        active_tracks = tracker.update(sig_boxes, current_time)

        # 7. Let MOG2 establish a background model before treating the
        # initial foreground mask as genuine motion.
        warmup_frames = int(max(0.0, MOTION_WARMUP_SEC) * fps)
        if frame_idx <= warmup_frames:
            continue

        # 8. Apply cooldown to avoid burst captures
        if significant and (current_time - last_saved_time >= cooldown_sec):
            timestamp = round(current_time, 2)
            # Find the dominant track and its bbox
            dominant_track_id = None
            dominant_bbox = None
            if active_tracks:
                dominant_track_info = max(active_tracks, key=lambda t: t[1][2] * t[1][3])
                dominant_track_id = dominant_track_info[0]
                dominant_bbox = dominant_track_info[1]
                
            keyframes.append((timestamp, frame, dominant_track_id, dominant_bbox))
            last_saved_time = current_time
            print(f"  [Keyframe] {timestamp:06.2f}s (track_id={dominant_track_id}, bbox={dominant_bbox})")

    cap.release()

    prune_pct = 100.0 - (len(keyframes) / total_frames * 100.0) if total_frames > 0 else 0.0
    print(f"  Result: {len(keyframes)} keyframes extracted ({prune_pct:.1f}% frames pruned)")

    return keyframes, video_meta
