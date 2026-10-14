"""
MIPAAS Configuration Module.

Environment-based configuration with defaults for development,
staging, and production deployments on GCP.
"""

import os


class BaseConfig:
    """Base configuration shared across all environments."""

    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    JSON_SORT_KEYS = False

    # GCP Project
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "mipaas-dev")
    GCP_REGION = os.getenv("GCP_REGION", "us-central1")

    # Cloud Storage
    GCS_DATA_BUCKET = os.getenv("GCS_DATA_BUCKET", f"mipaas-dev-data")
    GCS_MODELS_BUCKET = os.getenv("GCS_MODELS_BUCKET", "mipaas-models")
    GCS_SIGNED_URL_EXPIRY_MINUTES = int(os.getenv("GCS_SIGNED_URL_EXPIRY_MINUTES", "15"))
    GCS_MAX_UPLOAD_SIZE_BYTES = int(os.getenv("GCS_MAX_UPLOAD_SIZE_BYTES", str(2 * 1024**3)))  # 2 GB

    # Pub/Sub Topics
    PUBSUB_TOPIC_DICOM_UPLOADED = os.getenv("PUBSUB_TOPIC_DICOM_UPLOADED", "dicom-uploaded")
    PUBSUB_TOPIC_PREPROCESSING_DONE = os.getenv("PUBSUB_TOPIC_PREPROCESSING_DONE", "preprocessing-done")
    PUBSUB_TOPIC_INFERENCE_DONE = os.getenv("PUBSUB_TOPIC_INFERENCE_DONE", "inference-done")
    PUBSUB_TOPIC_RESULTS_READY = os.getenv("PUBSUB_TOPIC_RESULTS_READY", "results-ready")

    # Firestore
    FIRESTORE_COLLECTION_JOBS = os.getenv("FIRESTORE_COLLECTION_JOBS", "jobs")
    FIRESTORE_COLLECTION_USERS = os.getenv("FIRESTORE_COLLECTION_USERS", "users")

    # Redis (Memorystore)
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))

    # Central Database
    DATABASE_URL = os.getenv("DATABASE_URL")
    DATABASE_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "10"))
    DATABASE_MAX_OVERFLOW = int(os.getenv("DATABASE_MAX_OVERFLOW", "20"))
    DATABASE_AUTO_SEED = os.getenv("DATABASE_AUTO_SEED", "true").lower() in ("true", "1")

    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.getenv("RATE_LIMIT_RPM", "60"))

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    # Disease Config Directory
    DISEASE_CONFIG_DIR = os.getenv(
        "DISEASE_CONFIG_DIR",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "diseases"),
    )

    # Model Registry
    MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/tmp/model_cache")
    MODEL_REGISTRY_COLLECTION = os.getenv("MODEL_REGISTRY_COLLECTION", "model_registry")


class DevelopmentConfig(BaseConfig):
    """Development configuration."""
    DEBUG = True
    TESTING = False
    GCS_DATA_BUCKET = os.getenv("GCS_DATA_BUCKET", "mipaas-dev-data")

    # Use emulators locally only when explicitly configured
    FIRESTORE_EMULATOR_HOST = os.getenv("FIRESTORE_EMULATOR_HOST")
    PUBSUB_EMULATOR_HOST = os.getenv("PUBSUB_EMULATOR_HOST")


class StagingConfig(BaseConfig):
    """Staging configuration."""
    DEBUG = False
    TESTING = False
    GCS_DATA_BUCKET = os.getenv("GCS_DATA_BUCKET", "mipaas-staging-data")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://staging.mipaas.app").split(",")


class ProductionConfig(BaseConfig):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    GCS_DATA_BUCKET = os.getenv("GCS_DATA_BUCKET", "mipaas-prod-data")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "https://mipaas.app").split(",")
    GCS_SIGNED_URL_EXPIRY_MINUTES = 10  # Tighter in production


class TestingConfig(BaseConfig):
    """Testing configuration."""
    DEBUG = True
    TESTING = True
    GCS_DATA_BUCKET = "mipaas-test-data"
    FIRESTORE_EMULATOR_HOST = "localhost:8080"
    PUBSUB_EMULATOR_HOST = "localhost:8085"
