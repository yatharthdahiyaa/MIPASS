"""The XAI agent's chest X-ray model: same code as the backend, and (when the weights are present) a real run."""

import importlib.util
from pathlib import Path

import numpy as np
import pytest

AGENTS = Path(__file__).resolve().parents[1]
BACKEND_COPY = AGENTS.parent / "backend" / "app" / "services" / "cxr_ensemble.py"
CHECKPOINT = AGENTS.parents[1] / "ml" / "chexpert_ensemble.pth"


def _need(*modules: str) -> None:
    """Skip unless every module is installed, WITHOUT importing it.

    pytest.importorskip("torch") would load torch before the XAI package does. On Anaconda for
    Windows, torch and MKL (numpy/scipy) each ship an OpenMP runtime (libiomp5md.dll); when torch's
    starts first and MKL's second, Intel's runtime aborts the whole process (OMP Error #15).
    Importing through the package keeps the order server.py uses, which is safe.
    """
    missing = [m for m in modules if importlib.util.find_spec(m) is None]
    if missing:
        pytest.skip(f"not installed: {', '.join(missing)}")


@pytest.mark.skipif(not BACKEND_COPY.exists(), reason="backend not in this checkout")
def test_ensemble_module_matches_the_backend():
    """XAI/ensemble.py must be byte-identical to the backend's, so both score the same way."""
    agent = (AGENTS / "XAI" / "ensemble.py").read_bytes().replace(b"\r\n", b"\n")
    backend = BACKEND_COPY.read_bytes().replace(b"\r\n", b"\n")
    assert agent == backend, "copy apps/backend/app/services/cxr_ensemble.py to apps/agents/XAI/ensemble.py"


def test_overlay_file_names_have_no_spaces():
    _need("torch", "cv2")
    from XAI.model import slug

    assert slug("Lung Opacity") == "Lung_Opacity" and slug("Cardiomegaly") == "Cardiomegaly"


@pytest.mark.skipif(not CHECKPOINT.exists(), reason="model weights (ml/chexpert_ensemble.pth) not present")
def test_real_ensemble_scores_and_maps_a_radiograph_shaped_image():
    _need("timm", "cv2")
    from XAI import ensemble, gradcam
    from XAI.model import get_ensemble

    model = get_ensemble()
    assert model.labels == [
        "Cardiomegaly", "Lung Opacity", "Edema", "Consolidation", "Atelectasis", "Pleural Effusion", "Support Devices",
    ]
    # A smooth synthetic "film": the numbers mean nothing, the plumbing has to work.
    yy, xx = np.mgrid[0:600, 0:500]
    gray = (127 + 100 * np.sin(xx / 60) * np.cos(yy / 80)).astype(np.uint8)
    probs = ensemble.predict(model, gray)
    assert set(probs["members"]) == {"densenet121", "tf_efficientnetv2_s", "rad_dino"}
    for label, p in probs["probabilities"].items():
        members = [m[label] for m in probs["members"].values()]
        assert 0.0 <= p <= 1.0 and abs(p - sum(members) / 3) < 1e-6
    out = gradcam.explain({"display": gray}, max_maps=1)
    assert out["maps"] and out["maps"][0]["overlay"].shape[:2] == gray.shape
