"""
Lightweight IOU-based multi-object tracker.

Not a full SORT/DeepSORT implementation (no Kalman filter, no re-ID
embedding) — this is deliberately the simplest thing that gives a real
capability: linking "this SUV in frame 40" to "this SUV in frame 55" so a
user can ask "show me everywhere this vehicle appears" instead of getting
isolated, unrelated keyframe captions.

Algorithm: greedy IOU matching between this frame's motion-contour boxes
and the previous frame's active tracks. A track survives up to
`max_missed_frames` frames without a match before being closed (handles
brief occlusion / momentary stillness). This runs on every frame during
motion pruning, not just at keyframe capture, so track continuity isn't
lost during the cooldown window between saved keyframes.
"""
import itertools
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional


BBox = Tuple[int, int, int, int]  # x, y, w, h


def _iou(a: BBox, b: BBox) -> float:
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


@dataclass
class Track:
    track_id: int
    bbox: BBox
    missed_frames: int = 0
    total_frames_seen: int = 1
    first_seen_time: float = 0.0
    last_seen_time: float = 0.0


class IOUTracker:
    """
    Call `update(boxes, timestamp)` once per processed frame with the
    current frame's contour bounding boxes. Returns the list of
    (track_id, bbox) active this frame.
    """

    def __init__(self, iou_threshold: float = 0.3, max_missed_frames: int = 15):
        self.iou_threshold = iou_threshold
        self.max_missed_frames = max_missed_frames
        self._tracks: Dict[int, Track] = {}
        self._next_id = itertools.count(1)

    def update(self, boxes: List[BBox], timestamp: float) -> List[Tuple[int, BBox]]:
        unmatched_boxes = set(range(len(boxes)))
        matched_track_ids = set()

        # Greedy match: for each existing track, find the best unmatched box.
        for track_id, track in list(self._tracks.items()):
            best_iou, best_idx = 0.0, None
            for idx in unmatched_boxes:
                score = _iou(track.bbox, boxes[idx])
                if score > best_iou:
                    best_iou, best_idx = score, idx
            if best_idx is not None and best_iou >= self.iou_threshold:
                track.bbox = boxes[best_idx]
                track.missed_frames = 0
                track.total_frames_seen += 1
                track.last_seen_time = timestamp
                unmatched_boxes.discard(best_idx)
                matched_track_ids.add(track_id)
            else:
                track.missed_frames += 1

        # Unmatched boxes become new tracks.
        for idx in unmatched_boxes:
            tid = next(self._next_id)
            self._tracks[tid] = Track(
                track_id=tid,
                bbox=boxes[idx],
                first_seen_time=timestamp,
                last_seen_time=timestamp,
            )
            matched_track_ids.add(tid)

        # Drop tracks that have been missing too long.
        for track_id in list(self._tracks.keys()):
            if self._tracks[track_id].missed_frames > self.max_missed_frames:
                del self._tracks[track_id]

        return [
            (tid, self._tracks[tid].bbox)
            for tid in matched_track_ids
            if tid in self._tracks
        ]

    def dominant_track_at(
        self, active: List[Tuple[int, BBox]]
    ) -> Optional[int]:
        """Of the tracks active this frame, return the one with the largest
        bounding box area — the most visually prominent object, used as the
        single track_id attached to a keyframe/caption."""
        if not active:
            return None
        return max(active, key=lambda t: t[1][2] * t[1][3])[0]
