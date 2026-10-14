"""
Central Database Session & Engine Configuration for MiPAAS.

Supports PostgreSQL for staging/production and SQLite for local development.
"""

from contextlib import contextmanager
import os
from pathlib import Path
import time
from typing import Any, Dict, Generator, Optional
import structlog
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker, Session

from app.database.models import Base

logger = structlog.get_logger()

# Default SQLite database path in backend directory
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "mipaas_central.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

_engine: Optional[Engine] = None
_SessionFactory: Optional[sessionmaker] = None
_ScopedSession: Optional[scoped_session] = None


def get_database_url() -> str:
    """Resolve database URL from environment or fallback to local SQLite."""
    url = os.getenv("DATABASE_URL")
    if not url:
        return DEFAULT_SQLITE_URL
    # Ensure modern postgresql driver notation if needed
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def create_db_engine(db_url: Optional[str] = None) -> Engine:
    """Create and configure SQLAlchemy Engine."""
    url = db_url or get_database_url()
    is_sqlite = url.startswith("sqlite")

    connect_args: Dict[str, Any] = {}
    engine_kwargs: Dict[str, Any] = {
        "echo": os.getenv("DATABASE_ECHO", "false").lower() in ("true", "1"),
        "future": True,
    }

    if is_sqlite:
        connect_args["check_same_thread"] = False
        engine_kwargs["connect_args"] = connect_args
    else:
        # PostgreSQL / MySQL connection pool tuning
        engine_kwargs.update({
            "pool_size": int(os.getenv("DATABASE_POOL_SIZE", "10")),
            "max_overflow": int(os.getenv("DATABASE_MAX_OVERFLOW", "20")),
            "pool_pre_ping": True,
            "pool_recycle": int(os.getenv("DATABASE_POOL_RECYCLE", "1800")),
        })

    engine = create_engine(url, **engine_kwargs)

    # SQLite performance & foreign key configuration
    if is_sqlite:
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA foreign_keys = ON;")
                cursor.execute("PRAGMA journal_mode = WAL;")
                cursor.execute("PRAGMA synchronous = NORMAL;")
            finally:
                cursor.close()

    return engine


def get_engine() -> Engine:
    """Get or initialize singleton engine."""
    global _engine
    if _engine is None:
        _engine = create_db_engine()
    return _engine


def get_session_factory() -> sessionmaker:
    """Get or initialize sessionmaker factory."""
    global _SessionFactory, _ScopedSession
    if _SessionFactory is None:
        engine = get_engine()
        _SessionFactory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine,
            expire_on_commit=False,
        )
        _ScopedSession = scoped_session(_SessionFactory)
    return _SessionFactory


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """Context manager for database sessions with automatic commit/rollback."""
    factory = get_session_factory()
    session: Session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db(drop_first: bool = False, db_url: Optional[str] = None) -> None:
    """Initialize central database tables."""
    global _engine, _SessionFactory, _ScopedSession
    if db_url:
        _engine = create_db_engine(db_url)
        _SessionFactory = None
        _ScopedSession = None

    engine = get_engine()
    if drop_first:
        logger.warning("database_drop_all_tables", dialect=engine.dialect.name)
        Base.metadata.drop_all(bind=engine)

    logger.info("database_create_all_tables", dialect=engine.dialect.name)
    Base.metadata.create_all(bind=engine)


def check_db_health() -> Dict[str, Any]:
    """Perform quick connection and health check."""
    start_time = time.time()
    engine = get_engine()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "healthy",
            "dialect": engine.dialect.name,
            "connected": True,
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "dialect": engine.dialect.name,
            "connected": False,
            "error": str(exc),
        }


def get_db_stats() -> Dict[str, Any]:
    """Inspect row counts across all central database tables."""
    engine = get_engine()
    table_stats: Dict[str, int] = {}
    with engine.connect() as conn:
        for table_name in Base.metadata.tables.keys():
            try:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                count = result.scalar() or 0
                table_stats[table_name] = count
            except Exception:
                table_stats[table_name] = -1

    return {
        "dialect": engine.dialect.name,
        "database_url": str(engine.url).split("@")[-1] if "@" in str(engine.url) else str(engine.url),
        "total_tables": len(table_stats),
        "tables": table_stats,
    }
