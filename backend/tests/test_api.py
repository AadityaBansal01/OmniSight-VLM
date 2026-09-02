import pytest
from unittest.mock import patch, MagicMock

def test_get_stats_empty(client):
    response = client.get("/api/v1/stats/")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cameras"] == 0
    assert data["total_videos"] == 0
    assert data["total_events"] == 0

def test_create_and_list_camera(client):
    # Create
    create_response = client.post("/api/v1/cameras/", json={
        "name": "Test Camera",
        "location": "Lobby",
        "resolution": "1080p",
        "fps": 30
    })
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == "Test Camera"
    camera_id = created["id"]

    # List
    list_response = client.get("/api/v1/cameras/")
    assert list_response.status_code == 200
    cameras = list_response.json()
    assert len(cameras) == 1
    assert cameras[0]["id"] == camera_id

def test_search_no_results(client):
    # Search with no data should return empty events
    response = client.get("/api/v1/search/", params={"q": "test"})
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 0
    assert data["query"] == "test"

@patch("app.routers.pipeline.run_indexing_pipeline")
def test_pipeline_index(mock_run_pipeline, client, db_session):
    # Need a video in DB to index
    from app.models import Video
    import uuid
    v = Video(id=str(uuid.uuid4()), filename="test.mp4", filepath="/tmp/test.mp4")
    db_session.add(v)
    db_session.commit()

    # Trigger indexing
    response = client.post(f"/api/v1/pipeline/index?video_id={v.id}")
    assert response.status_code == 200
    assert response.json()["status"] == "started"
    
    # Verify the service was called
    mock_run_pipeline.assert_called_once_with(v.id)
