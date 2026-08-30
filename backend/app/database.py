"""
SQLAlchemy database engine, session factory, and table initialization.
Uses synchronous SQLite — perfectly fine for a local-first application.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from sqlalchemy import text
from app.config import DATABASE_URL


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI threads
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def init_db():
    """Create all tables if they don't exist and run light migrations."""
    from app.models import Camera, Video, Event, SearchLog  # noqa: F401
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE search_log ADD COLUMN search_time_ms FLOAT DEFAULT 0.0"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE events ADD COLUMN track_id INTEGER"))
            conn.commit()
        except Exception:
            pass
    print("[Database] SQLite tables initialized.")


def get_db():
    """FastAPI dependency that yields a DB session and auto-closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
