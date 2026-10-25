"""
MIPAAS Flask Application Factory.

Creates and configures the Flask application with all blueprints,
middleware, and extensions for the Medical Image Processing API.
"""

import os
import structlog
from flask import Flask
from flask_cors import CORS


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application.

    Args:
        config_name: Configuration environment name ('development', 'staging', 'production').
                     Defaults to FLASK_ENV environment variable.

    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)

    # Load configuration
    config_name = config_name or os.getenv("FLASK_ENV", "development")
    app.config.from_object(f"app.config.{config_name.capitalize()}Config")

    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer() if config_name == "production"
            else structlog.dev.ConsoleRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
    )

    logger = structlog.get_logger()

    # Initialize CORS
    CORS(
        app,
        origins=app.config.get("CORS_ORIGINS", ["http://localhost:3000"]),
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-User-ID", "X-User-Role"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # Register error handlers
    from app.middleware.error_handler import register_error_handlers
    register_error_handlers(app)

    # Initialize Central Database
    try:
        from app.database import init_db
        init_db()
        logger.info("central_database_ready")
    except Exception as exc:
        logger.warning("central_database_init_warning", error=str(exc))

    # Register blueprints (routes)
    from app.routes.health import health_bp
    from app.routes.upload import upload_bp
    from app.routes.jobs import jobs_bp
    from app.routes.results import results_bp
    from app.routes.diseases import diseases_bp
    from app.routes.auth_rbac import rbac_bp
    from app.routes.inference import inference_bp
    from app.routes.agents_and_workflows import workflows_bp
    from app.routes.openemr import openemr_bp
    from app.routes.eka_portal import eka_bp
    from app.routes.database_admin import database_bp
    from app.routes.indic import indic_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(upload_bp, url_prefix="/api/v1")
    app.register_blueprint(jobs_bp, url_prefix="/api/v1")
    app.register_blueprint(results_bp, url_prefix="/api/v1")
    app.register_blueprint(diseases_bp, url_prefix="/api/v1")
    app.register_blueprint(rbac_bp, url_prefix="/api/v1")
    app.register_blueprint(inference_bp, url_prefix="/api/v1")
    app.register_blueprint(workflows_bp, url_prefix="/api/v1")
    app.register_blueprint(openemr_bp, url_prefix="/api/v1")
    app.register_blueprint(eka_bp, url_prefix="/api/v1")
    app.register_blueprint(database_bp, url_prefix="/api/v1")
    app.register_blueprint(indic_bp, url_prefix="/api/v1")

    logger.info(
        "app_initialized",
        config=config_name,
        blueprints=[bp.name for bp in app.blueprints.values()],
    )

    return app
