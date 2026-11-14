"""
MIPAAS Flask application factory.

Creates and configures the Flask application with all blueprints,
middleware, and extensions for the MIPAAS API.
"""

import os
from pathlib import Path

import structlog
from flask import Flask
from flask_cors import CORS


def _load_dotenv() -> None:
    """Read apps/backend/.env (if present) before configuration is built."""
    try:
        from dotenv import load_dotenv
    except ImportError:  # pragma: no cover
        return
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application.

    Args:
        config_name: 'development', 'staging', 'production' or 'testing'.
                     Defaults to the FLASK_ENV environment variable.
    """
    _load_dotenv()
    app = Flask(__name__)

    config_name = config_name or os.getenv("FLASK_ENV", "development")
    live = config_name in ("staging", "production")
    if live:
        # Fail fast, before anything is served: see app/preflight.py for the list.
        from app.preflight import require_production_ready

        require_production_ready()
    app.config.from_object(f"app.config.{config_name.capitalize()}Config")
    app.config["MAX_CONTENT_LENGTH"] = int(app.config.get("MAX_REQUEST_BYTES", 64 * 1024**2))

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
            if config_name == "production"
            else structlog.dev.ConsoleRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
    )
    logger = structlog.get_logger()

    CORS(
        app,
        origins=app.config.get("CORS_ORIGINS", ["http://localhost:3000"]),
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    from app.middleware.error_handler import register_error_handlers
    from app.middleware.security_headers import register_security

    register_error_handlers(app)
    register_security(app)

    # Schema. In development the tables are created (and nullable columns added) on start-up.
    # Staging and production never alter the schema implicitly: it is owned by the Alembic
    # migrations (`alembic upgrade head`, run once per release before the app starts).
    if live:
        logger.info("central_database_schema_managed_by_migrations")
    else:
        try:
            from app.database import init_db

            init_db()
            logger.info("central_database_ready")
        except Exception as exc:
            logger.warning("central_database_init_warning", error=str(exc))

    from app.routes import register_routes

    register_routes(app)

    logger.info(
        "app_initialized",
        config=config_name,
        blueprints=[bp.name for bp in app.blueprints.values()],
    )
    return app
