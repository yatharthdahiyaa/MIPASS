"""
Single source of truth for filesystem locations.

Repository layout (see docs/PROJECT_STRUCTURE.md):

    <repo>/apps/backend   Flask API (BACKEND_DIR)
    <repo>/data/          Local runtime data (DATA_DIR): samples/, uploads/, model_cache/ (the database is PostgreSQL)
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
SAMPLES_DIR = DATA_DIR / "samples"
UPLOADS_DIR = DATA_DIR / "uploads"
# Patient-owned files (record locker, X-rays). Keep on encrypted storage in production.
PATIENT_FILES_DIR = _env_path("PATIENT_FILES_DIR", UPLOADS_DIR / "patients")
DOCTOR_FILES_DIR = _env_path("DOCTOR_FILES_DIR", UPLOADS_DIR / "doctors")
MODEL_CACHE_DIR = _env_path("MODEL_CACHE_DIR", DATA_DIR / "model_cache")

ML_DIR = _env_path("MIPAAS_ML_DIR", REPO_ROOT / "ml")
DISEASE_CONFIG_DIR = _env_path("DISEASE_CONFIG_DIR", BACKEND_DIR / "config" / "diseases")

# Chest X-ray model: the CheXpert ensemble (DenseNet-121 + EfficientNetV2-S + RAD-DINO),
# read by app/services/cxr_ensemble.py.
CXR_CHECKPOINT_PATH = _env_path("MIPAAS_CXR_CHECKPOINT", ML_DIR / "chexpert_ensemble.pth")

SAMPLE_CXR_PATH = SAMPLES_DIR / "sample_cxr.dcm"
