"""How the chest X-ray reading turns ensemble scores into a grade and text (no model weights needed)."""

import numpy as np
import pytest

from app.services import dicom_service as ds
from app.services import study_analysis as sa


def _finding(name, p, thr):
    return {"name": name, "probability": p, "threshold": thr, "positive": p >= thr, "certainty": ds._certainty(p, thr)}


def test_certainty_bands():
    assert ds._certainty(0.30, 0.20) == "high"  # 1.5x
    assert ds._certainty(0.24, 0.20) == "moderate"  # 1.2x
    assert ds._certainty(0.205, 0.20) == "low"
    assert ds._certainty(0.19, 0.20) is None


def test_severity_needs_a_clear_acute_finding_for_high():
    edema_marginal = _finding("Edema", 0.34, 0.33)  # 1.03x: low certainty
    edema_clear = _finding("Edema", 0.50, 0.33)
    cardiomegaly = _finding("Cardiomegaly", 0.75, 0.11)
    assert ds._severity([edema_clear], []) == "HIGH"
    assert ds._severity([edema_marginal], []) == "MODERATE"
    assert ds._severity([cardiomegaly], []) == "MODERATE"  # not acute on its own
    assert ds._severity([], [_finding("Atelectasis", 0.24, 0.27)]) == "MODERATE"  # borderline only
    assert ds._severity([], []) == "NORMAL"


def test_reading_text_never_rules_out_what_the_model_cannot_see(monkeypatch, tmp_path):
    """A negative reading has no primary finding and says what the model does not assess."""
    from app.services import cxr_ensemble

    class FakeEnsemble:
        labels = ["Cardiomegaly", "Lung Opacity", "Pleural Effusion", "Support Devices"]
        thresholds = {"Cardiomegaly": 0.11, "Lung Opacity": 0.53, "Pleural Effusion": 0.45, "Support Devices": 0.58}
        model_name = "fake ensemble"
        created = ""

    probs = {"Cardiomegaly": 0.05, "Lung Opacity": 0.2, "Pleural Effusion": 0.1, "Support Devices": 0.9}
    checkpoint = tmp_path / "chexpert_ensemble.pth"
    checkpoint.write_bytes(b"x" * 2000)
    monkeypatch.setattr(ds, "CXR_CHECKPOINT_PATH", checkpoint)
    monkeypatch.setattr(cxr_ensemble, "get", lambda path: FakeEnsemble())
    monkeypatch.setattr(cxr_ensemble, "predict", lambda e, g: {"probabilities": probs, "members": {"a": probs}})

    out = ds.read_radiograph(np.zeros((64, 64), dtype=np.uint8))
    assert out["severity"] == "NORMAL" and out["primary_diagnosis"] is None
    assert "Support devices appear to be present" in out["clinical_summary"]
    assert "does not assess pneumothorax" in out["clinical_summary"]
    text = " ".join([out["clinical_summary"], *out["recommended_actions"]]).lower()
    for treatment in ("diuretic", "antibiotic", "antimicrobial", "thoracentesis", "intravenous"):
        assert treatment not in text


def test_analyser_waits_when_the_model_file_is_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(sa, "CXR_CHECKPOINT_PATH", tmp_path / "missing.pth")
    assert sa.get_analyzer("chest_xray").is_available() is False


@pytest.mark.parametrize("photometric", ["MONOCHROME2", "MONOCHROME1"])
def test_dicom_pixels_are_scaled_and_inverted(photometric):
    import pydicom
    from pydicom.dataset import FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, generate_uid

    meta = FileMetaDataset()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.1.1"
    meta.MediaStorageSOPInstanceUID = generate_uid()
    d = pydicom.Dataset()
    d.file_meta = meta
    d.Rows, d.Columns = 32, 32
    d.BitsAllocated, d.BitsStored, d.HighBit, d.PixelRepresentation, d.SamplesPerPixel = 16, 12, 11, 0, 1
    d.PhotometricInterpretation = photometric
    ramp = np.tile(np.linspace(0, 4095, 32, dtype=np.uint16), (32, 1))
    d.PixelData = ramp.tobytes()
    gray = ds.dicom_to_gray(d)
    assert gray.dtype == np.uint8 and gray.shape == (32, 32)
    left, right = int(gray[:, 0].mean()), int(gray[:, -1].mean())
    assert (left < right) if photometric == "MONOCHROME2" else (left > right)
