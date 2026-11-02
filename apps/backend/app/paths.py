"""
Single source of truth for filesystem locations.

Repository layout (see docs/PROJECT_STRUCTURE.md):

    <repo>/apps/backend   Flask API (BACKEND_DIR)
    <repo>/data/          Local runtime data (DATA_DIR): db/, samples/, uploads/, model_cache/
    <repo>/ml/            Model source repos and trained checkpoints (ML_DIR)

Every location can be overridden by an environment variable so containers
can mount volumes anywhere.
"""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent.parent


def _env_path(name: str, default: Path) -> Path:
    return Path(os.getenv(name) or default).expanduser().resolve()


DATA_DIR = _env_path("MIPAAS_DATA_DIR", REPO_ROOT / "data")
DB_DIR = DATA_DIR / "db"
SAMPLES_DIR = DATA_DIR / "samples"
UPLOADS_DIR = DATA_DIR / "uploads"
MODEL_CACHE_DIR = _env_path("MODEL_CACHE_DIR", DATA_DIR / "model_cache")

ML_DIR = _env_path("MIPAAS_ML_DIR", REPO_ROOT / "ml")
DISEASE_CONFIG_DIR = _env_path("DISEASE_CONFIG_DIR", BACKEND_DIR / "config" / "diseases")

DEFAULT_DB_PATH = DB_DIR / "mipaas_central.db"
SAMPLE_CXR_PATH = SAMPLES_DIR / "sample_cxr.dcm"
