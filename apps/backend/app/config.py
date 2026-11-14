"""
MIPAAS configuration.

Environment-based configuration with defaults for development, staging and production.
Everything can be set through environment variables (see ``.env.example``).
"""

import os

from app import paths


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


class BaseConfig:
    """Base configuration shared across all environments."""

    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    JSON_SORT_KEYS = False
    MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", str(64 * 1024**2)))  # 64 MB

    # Public web app URL used in e-mails (verification links, notifications)
    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000")

    # E-mail: outbox (default; stored in the database only), console, or smtp
    MAIL_BACKEND = os.getenv("MAIL_BACKEND", "outbox")
    MAIL_FROM = os.getenv("MAIL_FROM", "MIPAAS <no-reply@mipaas.local>")

    # Shared rate limiting across instances (optional)
    REDIS_URL = os.getenv("REDIS_URL")

    # Trust X-Forwarded-* from a load balancer / reverse proxy
    TRUST_PROXY = os.getenv("TRUST_PROXY", "0") in ("1", "true", "yes")

    # GCP (optional cloud storage / pub-sub services)
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "mipaas-dev")
    GCP_REGION = os.getenv("GCP_REGION", "us-central1")
    GCS_DATA_BUCKET = os.getenv("GCS_DATA_BUCKET", "mipaas-dev-data")
    GCS_MODELS_BUCKET = os.getenv("GCS_MODELS_BUCKET", "mipaas-models")
    GCS_SIGNED_URL_EXPIRY_MINUTES = int(os.getenv("GCS_SIGNED_URL_EXPIRY_MINUTES", "15"))
    GCS_MAX_UPLOAD_SIZE_BYTES = int(os.getenv("GCS_MAX_UPLOAD_SIZE_BYTES", str(2 * 1024**3)))
    PUBSUB_TOPIC_DICOM_UPLOADED = os.getenv("PUBSUB_TOPIC_DICOM_UPLOADED", "dicom-uploaded")
    PUBSUB_TOPIC_PREPROCESSING_DONE = os.getenv(
        "PUBSUB_TOPIC_PREPROCESSING_DONE", "preprocessing-done"
    )
    PUBSUB_TOPIC_INFERENCE_DONE = os.getenv("PUBSUB_TOPIC_INFERENCE_DONE", "inference-done")
    PUBSUB_TOPIC_RESULTS_READY = os.getenv("PUBSUB_TOPIC_RESULTS_READY", "results-ready")

    # Central database
    DATABASE_URL = os.getenv("DATABASE_URL")
    DATABASE_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "10"))
    DATABASE_MAX_OVERFLOW = int(os.getenv("DATABASE_MAX_OVERFLOW", "20"))

    # CORS
    CORS_ORIGINS = _split(os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:1420,http://127.0.0.1:1420"))

    # Disease config directory
    DISEASE_CONFIG_DIR = str(paths.DISEASE_CONFIG_DIR)

    # Patient record locker / X-ray uploads and doctor studies
    PATIENT_FILES_DIR = str(paths.PATIENT_FILES_DIR)
    DOCTOR_FILES_DIR = str(paths.DOCTOR_FILES_DIR)
    PATIENT_MAX_UPLOAD_BYTES = int(os.getenv("PATIENT_MAX_UPLOAD_BYTES", str(25 * 1024**2)))

    # Model registry
    MODEL_CACHE_DIR = str(paths.MODEL_CACHE_DIR)
    MODEL_REGISTRY_COLLECTION = os.getenv("MODEL_REGISTRY_COLLECTION", "model_registry")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    TESTING = False
    PUBSUB_EMULATOR_HOST = os.getenv("PUBSUB_EMULATOR_HOST")


class StagingConfig(BaseConfig):
    DEBUG = False
    TESTING = False
    CORS_ORIGINS = _split(os.getenv("CORS_ORIGINS", "https://staging.mipaas.app"))


class ProductionConfig(BaseConfig):
    DEBUG = False
    TESTING = False
    CORS_ORIGINS = _split(os.getenv("CORS_ORIGINS", "https://mipaas.app"))
    GCS_SIGNED_URL_EXPIRY_MINUTES = 10


class TestingConfig(BaseConfig):
    DEBUG = True
    TESTING = True
    GCS_DATA_BUCKET = "mipaas-test-data"
