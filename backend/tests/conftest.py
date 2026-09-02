import os
import pytest
import tempfile
import shutil

# Create temporary directories for testing
temp_dir = tempfile.mkdtemp()
temp_chroma = os.path.join(temp_dir, "chroma")
os.makedirs(temp_chroma, exist_ok=True)

# Set env vars BEFORE importing app config
os.environ["DATABASE_URL"] = f"sqlite:///{temp_dir}/test.db"
os.environ["CHROMA_DIR"] = temp_chroma

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, engine
from app.main import app
from app.models import Camera, Video, Event

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def cleanup_temp_dir():
    yield
    # Cleanup temp dir after all tests run
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Provides a TestClient with a mocked DB session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
