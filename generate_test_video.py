import argparse
from pathlib import Path

import cv2
import numpy as np

parser = argparse.ArgumentParser(description='Generate a portable synthetic CCTV video.')
parser.add_argument('--output', default='backend/data/videos/test_video.mp4')
args = parser.parse_args()

width, height = 640, 480
fps = 30
duration = 5
num_frames = duration * fps

out_path = Path(args.output)
out_path.parent.mkdir(parents=True, exist_ok=True)
out = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
if not out.isOpened():
    raise RuntimeError(f'Could not open output path: {out_path}')

for i in range(num_frames):
    # Dark background
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Moving square (simulating a person or car)
    x = int(50 + (i / num_frames) * (width - 100))
    y = height // 2
    cv2.rectangle(frame, (x, y), (x+50, y+50), (0, 0, 255), -1)
    
    # Static text
    cv2.putText(frame, f"Frame {i}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    out.write(frame)

out.release()
print("Test video created successfully!")
