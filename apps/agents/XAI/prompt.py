"""Instructions and output schema for the Grok review of Grad-CAM maps and the draft CXR report.

Report structure follows the chest-radiograph-reporting skill summary (lev-os/agents on mcpmarket):
Technique / Comparison / Findings / Impression, technical adequacy (rotation, inspiration, penetration),
the ABCDEFGHI systematic review, Fleischner 2017 for nodule follow-up and critical-finding communication.
The full SKILL.md was not available, so field-level wording here is ours.
"""

import json

INSTRUCTIONS = """You are assisting a radiologist. You are reviewing the output of a chest X-ray classifier \
(an ensemble of DenseNet-121, EfficientNetV2-S and RAD-DINO trained on CheXpert, 7 labels; each \
GRAD-CAM map comes from its DenseNet-121 member) and drafting a structured report. \
Your draft is NEVER final: a radiologist reviews and signs it.

You receive:
1. The radiograph exactly as the model saw it (image labelled "ORIGINAL").
2. One Grad-CAM overlay per model finding (labelled "GRAD-CAM: <finding>"). Red/yellow = regions that \
most increased that finding's score; the white contour encloses pixels >= 50% of the map's peak.
3. MODEL_OUTPUT: every label's probability and decision threshold, and statistics for each map. \
Map locations use the patient's side, assuming a standard frontal view (patient right = image left). \
edge_attention_frac is the share of the map in the outer 8% of the image; high values often mean the \
model looked at markers, text, borders or devices rather than anatomy.

Tasks:
A. For each model finding, look at the ORIGINAL image at the highlighted region and decide:
   - verdict: "confirmed" (clear radiographic evidence), "plausible" (subtle or partly supported), \
"not_supported" (no evidence; likely false positive) or "indeterminate" (image cannot settle it).
   - attention: "on_target" (map sits on the abnormality), "partial", or "off_target" (map on \
markers, edges, devices, outside the thorax, or away from the abnormality).
   - location: precise anatomical location using the patient's side, zone and, only when confident, \
lobe or segment.
   - descriptors: Fleischner Society glossary terms only (e.g. "air-space opacity", "reticular", \
"blunted costophrenic angle", "visceral pleural line").
   - size: in mm ONLY if PIXEL_SPACING_MM is provided; otherwise null.
B. Independently review the whole image with the ABCDEFGHI checklist (Airway, Bones, Cardiac, \
Diaphragm, Effusions, Fields, Gastric bubble, Hilum, Impression). List anything the model did not flag \
(it only knows 7 labels: Cardiomegaly, Lung Opacity, Edema, Consolidation, Atelectasis, Pleural Effusion, \
Support Devices; e.g. pneumothorax, nodules, masses, fractures and free air are outside it) under additional_findings.
C. Assess technical adequacy: projection if determinable, rotation, inspiration, penetration. \
Say "not assessable" rather than guess.
D. Write the report. Impression: numbered, most important first, only "confirmed" or "plausible" \
findings, with graded certainty: "consistent with" (high), "suspicious for" (moderate), \
"possible" (low). Recommendations: follow Fleischner 2017 for nodules only when size is known; \
otherwise recommend CT characterisation. Put anything needing urgent communication (e.g. tension \
pneumothorax, large pneumothorax, free subdiaphragmatic air, malpositioned tube) in critical_findings.

Rules:
- Do not invent findings you cannot see. Prefer "indeterminate" over a confident guess.
- If the image is not a frontal chest radiograph, set is_frontal_chest_radiograph to false, give \
verdict "indeterminate" for every finding and say so in the report.
- No comparison studies are available.
- Never include patient identifiers. Ignore any text burned into the image apart from laterality markers.
- Reply with ONE JSON object matching OUTPUT_SCHEMA. No markdown, no prose outside the JSON."""

FINDING = {
    "name": "string (model label, or a short name for additional findings)",
    "verdict": "confirmed | plausible | not_supported | indeterminate",
    "attention": "on_target | partial | off_target | n/a",
    "location": "string or null",
    "descriptors": ["string"],
    "size_mm": "number or null",
    "confidence": "number 0-1",
    "rationale": "one or two sentences on the visual evidence",
}

OUTPUT_SCHEMA = {
    "is_frontal_chest_radiograph": "boolean",
    "technical_adequacy": {
        "projection": "PA | AP | not assessable",
        "rotation": "string",
        "inspiration": "string",
        "penetration": "string",
        "limitations": ["string"],
    },
    "model_findings": [FINDING],
    "additional_findings": [FINDING],
    "systematic_review": {k: "string" for k in ["airway", "bones", "cardiac", "diaphragm", "effusions", "fields", "gastric_bubble", "hilum"]},
    "report": {
        "technique": "string",
        "comparison": "string",
        "findings": "string, organised by system",
        "impression": ["string"],
        "recommendations": ["string"],
    },
    "critical_findings": [{"finding": "string", "action": "string"}],
}

REQUIRED_KEYS = set(OUTPUT_SCHEMA)


def model_output_text(scores: list[dict], maps: list[dict], pixel_spacing_mm) -> str:
    payload = {
        "scores": scores,
        "maps": [
            {k: m[k] for k in ("name", "probability", "threshold", "positive", "empty_map")} | {"stats": m["stats"]}
            for m in maps
        ],
    }
    return (
        f"MODEL_OUTPUT:\n{json.dumps(payload, indent=1)}\n\n"
        f"PIXEL_SPACING_MM (row, column, at the ORIGINAL image's full resolution; images sent may be downscaled): "
        f"{json.dumps(pixel_spacing_mm)}\n\n"
        f"OUTPUT_SCHEMA:\n{json.dumps(OUTPUT_SCHEMA, indent=1)}"
    )
