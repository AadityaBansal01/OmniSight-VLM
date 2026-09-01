import os
import cv2
import numpy as np
import pytest
import tempfile
from app.ai.motion_pruner import extract_motion_keyframes

def _create_test_video(path: str, num_static: int = 30, num_moving: int = 15):
    """Creates a temporary test video with static frames followed by moving shape."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(path, fourcc, 10.0, (320, 240))
    
    # Static black frames
    for _ in range(num_static):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        out.write(frame)
        
    # Moving bright rectangle
    for i in range(num_moving):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        x = int(20 + i * 15)
        cv2.rectangle(frame, (x, 50), (x + 80, 150), (255, 255, 255), -1)
        out.write(frame)
        
    out.release()

def test_motion_pruner_prunes_static_and_detects_motion():
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tf:
        video_path = tf.name

    try:
        _create_test_video(video_path, num_static=30, num_moving=20)
        keyframes, meta = extract_motion_keyframes(
            video_path,
            min_contour_area=500,
            cooldown_sec=0.5
        )

        assert meta["total_frames"] == 50
        assert meta["fps"] == 10.0
        assert meta["resolution"] == "320x240"
        assert meta["duration"] == 5.0

        # Should extract keyframes from the moving portion, pruning the static portion
        assert len(keyframes) >= 1
        # Cooldown prevents capturing every single moving frame
        assert len(keyframes) < 20
        # Check structure: (timestamp, frame_ndarray, track_id, bbox)
        ts, frame, track_id, bbox = keyframes[0]
        assert isinstance(bbox, (tuple, type(None)))
        assert isinstance(ts, float)
        assert isinstance(frame, np.ndarray)
    finally:
        if os.path.exists(video_path):
            os.remove(video_path)

def test_motion_pruner_invalid_path():
    with pytest.raises(FileNotFoundError):
        extract_motion_keyframes("/non/existent/video/path.mp4")
