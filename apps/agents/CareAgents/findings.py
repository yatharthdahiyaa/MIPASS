"""Wording for chest X-ray model labels, shared by the drafting and explaining agents.

Covers the CheXpert ensemble the platform runs (ml/chexpert_ensemble.pth: Cardiomegaly, Lung
Opacity, Edema, Consolidation, Atelectasis, Pleural Effusion, Support Devices) and the NIH
ChestX-ray14 labels of the earlier model, so older studies still read correctly.
"""

from __future__ import annotations

# label -> (report wording, plain wording for patients)
LABELS: dict[str, tuple[str, str]] = {
    "Atelectasis": ("atelectasis", "part of the lung is not fully filled with air (partly collapsed)"),
    "Cardiomegaly": ("cardiomegaly", "the heart looks larger than usual"),
    "Consolidation": ("consolidation", "part of the lung looks filled with something other than air, such as fluid or infection"),
    "Edema": ("pulmonary oedema", "there is extra fluid in the lung tissue"),
    "Effusion": ("pleural effusion", "fluid has collected between the lung and the chest wall"),
    "Emphysema": ("emphysema", "the small air sacs of the lung are damaged, usually over a long time"),
    "Fibrosis": ("pulmonary fibrosis", "the lung tissue is scarred"),
    "Hernia": ("hiatus hernia", "part of the stomach has moved up into the chest"),
    "Infiltration": ("pulmonary infiltrate", "an area of the lung looks denser than normal; this has many possible causes"),
    "Mass": ("a pulmonary mass", "there is a spot in the lung larger than 3 cm"),
    "Nodule": ("a pulmonary nodule", "there is a small round spot in the lung"),
    "Pleural_Thickening": ("pleural thickening", "the lining around the lung is thicker than usual, often from old scarring"),
    "Pneumonia": ("pneumonia", "there are signs of an infection in the lung"),
    "Pneumothorax": ("pneumothorax", "air has leaked into the space around the lung"),
    # CheXpert names
    "Lung Opacity": ("pulmonary opacity", "an area of the lung looks denser (whiter) than normal; this has many possible causes"),
    "Pleural Effusion": ("pleural effusion", "fluid has collected between the lung and the chest wall"),
    "Support Devices": ("support devices", "medical lines, tubes or devices can be seen on the X-ray"),
}

# Seen on the film but not a disease: never an impression line of its own.
NON_PATHOLOGY = {"Support Devices"}

# Suggestions a radiologist commonly adds; the doctor decides whether they apply.
RECOMMENDATIONS: dict[str, str] = {
    "Nodule": "Consider CT chest for characterisation (Fleischner Society guidance once size is known).",
    "Mass": "Recommend CT chest for further characterisation.",
    "Pneumothorax": "If not already known, communicate urgently to the referring clinician.",
    "Effusion": "Correlate clinically; ultrasound can quantify and guide drainage if needed.",
    "Consolidation": "Correlate with clinical findings; follow-up radiograph after treatment if indicated.",
    "Pneumonia": "Correlate with clinical findings; follow-up radiograph after treatment if indicated.",
    "Pleural Effusion": "Correlate clinically; ultrasound can quantify and guide drainage if needed.",
    "Lung Opacity": "Correlate with clinical findings; consider follow-up radiograph to confirm resolution.",
    "Support Devices": "Confirm the position of lines and tubes on the image.",
}


def wording(label: str) -> str:
    return LABELS.get(label, (label.replace("_", " ").lower(), ""))[0]


def plain(label: str) -> str:
    return LABELS.get(label, ("", label.replace("_", " ").lower()))[1]


def certainty(probability: float, threshold: float) -> str | None:
    """Graded certainty from how far the score is above the model's own threshold."""
    if not threshold or probability is None:
        return None
    ratio = round(probability / threshold, 6)  # 0.30 / 0.20 is 1.4999999999999998
    if ratio >= 1.5:
        return "consistent with"
    if ratio >= 1.15:
        return "suspicious for"
    if ratio >= 1.0:
        return "possible"
    return None
