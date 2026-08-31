import os
import uuid
import pytest
from app.models import Video
from app.config import VIDEO_DIR

def test_stream_video_head_and_partial_range(client, db_session):
    # Setup test file in VIDEO_DIR
    os.makedirs(VIDEO_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    filename = f"stream_test_{file_id}.mp4"
    filepath = VIDEO_DIR / filename
    
    # Write 100 bytes of dummy content
    dummy_data = b"OmniSightVideoStreamingTestContent" * 5  # 35 * 5 = 175 bytes
    with open(filepath, "wb") as f:
        f.write(dummy_data)
        
    total_size = len(dummy_data)
    
    video = Video(
        id=file_id,
        filename=filename,
        filepath=str(filepath),
        file_size=total_size,
        duration=10.0,
        fps=30.0,
        resolution="1280x720",
        status="ready"
    )
    db_session.add(video)
    db_session.commit()

    try:
        # 1. Test HEAD probe
        head_res = client.head(f"/api/v1/videos/{file_id}/stream")
        assert head_res.status_code == 200
        assert head_res.headers.get("accept-ranges") == "bytes"
        assert head_res.headers.get("content-length") == str(total_size)

        # 2. Test full GET without range
        full_res = client.get(f"/api/v1/videos/{file_id}/stream")
        assert full_res.status_code == 200
        assert full_res.content == dummy_data

        # 3. Test HTTP 206 Partial Content
        range_res = client.get(
            f"/api/v1/videos/{file_id}/stream",
            headers={"Range": "bytes=0-19"}
        )
        assert range_res.status_code == 206
        assert range_res.headers.get("content-range") == f"bytes 0-19/{total_size}"
        assert range_res.headers.get("content-length") == "20"
        assert len(range_res.content) == 20
        assert range_res.content == dummy_data[0:20]

        # 4. Test Out-of-bounds range -> 416
        oob_res = client.get(
            f"/api/v1/videos/{file_id}/stream",
            headers={"Range": f"bytes={total_size + 10}-{total_size + 20}"}
        )
        assert oob_res.status_code == 416

    finally:
        if filepath.exists():
            filepath.unlink()
