"""
Central database session and engine for MIPAAS.

PostgreSQL is the only supported database. The SQLAlchemy models in
``app.database.models`` are the single source of truth for the schema;
``init_db()`` creates any missing tables on startup.

Configuration: ``DATABASE_URL`` (see ``.env.example``). Local development uses the
Docker stack in ``infra/database/docker-compose.db.yml``.
"""

import os
import time
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import psycopg2
import structlog
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, scoped_session, sessionmaker

from app.database.models import Base

logger = structlog.get_logger()

# Matches infra/database/docker-compose.db.yml. Override with DATABASE_URL in any real environment.
DEFAULT_DATABASE_URL = "postgresql+psycopg2://mipaas:mipaas_dev_pass@127.0.0.1:5432/mipaas_central"
DRIVER = "postgresql+psycopg2"

_engine: Engine | None = None
_SessionFactory: sessionmaker | None = None
_ScopedSession: scoped_session | None = None


def normalize_url(url: str) -> str:
    """Accept postgres:// and postgresql:// forms; always return the psycopg2 driver URL."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = DRIVER + url[len("postgresql") :]
    if not url.startswith(DRIVER + "://"):
        raise RuntimeError("DATABASE_URL must be a PostgreSQL URL (postgresql://...).")
    return url


def get_database_url() -> str:
    """The central database URL from the environment, or the local Docker default."""
    return normalize_url(os.getenv("DATABASE_URL") or DEFAULT_DATABASE_URL)


def ensure_database_exists(url: str) -> None:
    """Create the target database if the server doesn't have it yet (connects to 'postgres')."""
    parsed = make_url(url)
    name = parsed.database
    admin = parsed.set(database="postgres")
    conn = psycopg2.connect(
        host=admin.host,
        port=admin.port or 5432,
        user=admin.username,
        password=admin.password,
        dbname="postgres",
    )
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,))
            if cur.fetchone() is None:
                cur.execute(f'CREATE DATABASE "{name}"')
                logger.info("database_created", name=name)
    finally:
        conn.close()


def create_db_engine(db_url: str | None = None) -> Engine:
    """Create the SQLAlchemy engine: pooled, UTC session timezone, pre-ping on checkout."""
    url = normalize_url(db_url) if db_url else get_database_url()
    return create_engine(
        url,
        echo=os.getenv("DATABASE_ECHO", "false").lower() in ("true", "1"),
        pool_size=int(os.getenv("DATABASE_POOL_SIZE", "10")),
        max_overflow=int(os.getenv("DATABASE_MAX_OVERFLOW", "20")),
        pool_pre_ping=True,
        pool_recycle=int(os.getenv("DATABASE_POOL_RECYCLE", "1800")),
        connect_args={"options": "-c timezone=UTC"},
    )


def get_engine() -> Engine:
    """Get or initialize the singleton engine."""
    global _engine
    if _engine is None:
        _engine = create_db_engine()
    return _engine


def get_session_factory() -> sessionmaker:
    """Get or initialize the sessionmaker."""
    global _SessionFactory, _ScopedSession
    if _SessionFactory is None:
        _SessionFactory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
            expire_on_commit=False,
        )
        _ScopedSession = scoped_session(_SessionFactory)
    return _SessionFactory


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """Session with automatic commit on success and rollback on error."""
    session: Session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db(drop_first: bool = False, db_url: str | None = None) -> None:
    """Create the central database (if needed) and all tables from the models."""
    global _engine, _SessionFactory, _ScopedSession
    if db_url:
        _engine = create_db_engine(db_url)
        _SessionFactory = None
        _ScopedSession = None

    engine = get_engine()
    # render_as_string(hide_password=False): str(url) masks the password as "***".
    ensure_database_exists(engine.url.render_as_string(hide_password=False))
    if drop_first:
        logger.warning("database_drop_all_tables", database=engine.url.database)
        Base.metadata.drop_all(bind=engine)
    logger.info("database_create_all_tables", database=engine.url.database)
    Base.metadata.create_all(bind=engine)
    add_missing_columns(engine)


def add_missing_columns(engine: Engine) -> list[str]:
    """Add model columns missing from existing tables (``create_all`` never alters tables).

    Strictly additive and only for nullable columns without server defaults, so it
    can't fail on existing rows. Anything else needs a real migration.
    """
    from sqlalchemy import inspect
    from sqlalchemy.schema import CreateColumn

    added: list[str] = []
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            present = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present:
                    continue
                if not column.nullable or column.server_default is not None:
                    logger.warning(
                        "database_column_needs_migration", table=table.name, column=column.name
                    )
                    continue
                ddl = CreateColumn(column).compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN {ddl}'))
                added.append(f"{table.name}.{column.name}")
    if added:
        logger.info("database_columns_added", columns=added)
    return added


def check_db_health() -> dict[str, Any]:
    """Quick connectivity check for the health endpoint."""
    start = time.time()
    engine = get_engine()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "dialect": engine.dialect.name,
            "connected": True,
            "latency_ms": round((time.time() - start) * 1000, 2),
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "dialect": engine.dialect.name,
            "connected": False,
            "error": str(exc),
        }


def redacted_url(url: str) -> str:
    """The URL without the password, safe to show in logs and the admin API."""
    parts = urlsplit(url)
    host = parts.hostname or ""
    netloc = f"{parts.username or ''}@{host}" + (f":{parts.port}" if parts.port else "")
    return urlunsplit((parts.scheme, netloc, parts.path, "", ""))


def get_db_stats() -> dict[str, Any]:
    """Row counts for every table in the central database."""
    engine = get_engine()
    table_stats: dict[str, int] = {}
    with engine.connect() as conn:
        for table_name in Base.metadata.tables:
            try:
                table_stats[table_name] = (
                    conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar() or 0
                )
            except Exception:
                table_stats[table_name] = -1
    return {
        "dialect": engine.dialect.name,
        "database_url": redacted_url(str(engine.url)),
        "total_tables": len(table_stats),
        "tables": table_stats,
    }
