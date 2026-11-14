"""
Study analysis: one pluggable interface for every imaging model the clinical panels use.

A *study analyser* knows which files it accepts, whether its trained model is
installed, and how to turn an image into a standard :class:`AnalysisResult`.
The doctor panel and the patient portal only talk to this module, never to a
model directly, so adding a modality is: subclass :class:`StudyAnalyzer`,
then :func:`register` it (see ``_register_builtin``).

Lifecycle written onto a study row (any object with the study columns):

    processing ─▶ completed            analyser ran
               ├▶ failed               analyser raised (unreadable pixels, bad weights, ...)
               └▶ pending              no trained model installed yet; re-run later

Results are only ever what a real model produced. Nothing here invents findings.
"""

from __future__ import annotations

import base64
import json
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

import structlog

from app.paths import CXR_CHECKPOINT_PATH

logger = structlog.get_logger()

# Ordered from least to most urgent. Analysers must report one of these (or None).
SEVERITIES = ("NORMAL", "MODERATE", "HIGH", "CRITICAL")
URGENT_SEVERITIES = ("HIGH", "CRITICAL")


class Status:
    PROCESSING = "processing"
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

    ALL = (PROCESSING, PENDING, COMPLETED, FAILED)
    # States a study can be (re-)analysed from.
    RERUNNABLE = (PENDING, FAILED)


class AnalysisError(Exception):
    """A file or analyser request that can't be served (maps to an API error)."""

    def __init__(self, message: str, status: int = 422, code: str = "ANALYSIS_ERROR"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


@dataclass(frozen=True)
class Finding:
    """One labelled output of a model (a pathology, class, risk bucket ...)."""

    name: str
    probability: float | None = None
    threshold: float | None = None
    positive: bool = False
    description: str | None = None


@dataclass
class AnalysisResult:
    """The standard shape every analyser returns."""

    model_name: str
    findings: list[Finding]
    primary_finding: str | None = None
    severity: str | None = None
    clinical_summary: str | None = None
    recommended_actions: list[str] = field(default_factory=list)
    disclaimer: str | None = None
    preview_png: bytes | None = None
    heatmap_png: bytes | None = None

    def __post_init__(self) -> None:
        sev = (self.severity or "").strip().upper() or None
        if sev is not None and sev not in SEVERITIES:
            raise ValueError(f"severity must be one of {SEVERITIES}, got {self.severity!r}")
        self.severity = sev

    def findings_payload(self) -> dict[str, Any]:
        """JSON for ``findings_json``; ``pathologies`` is the key existing clients read."""
        return {
            "pathologies": [asdict(f) for f in self.findings],
            "positive_findings": [f.name for f in self.findings if f.positive],
            "clinical_summary": self.clinical_summary,
            "recommended_actions": list(self.recommended_actions),
            "disclaimer": self.disclaimer,
        }


class FileStoreLike(Protocol):
    def save(self, user_id: str, kind: str, blob: bytes, ext: str) -> str: ...
    def delete(self, *rels: str | None) -> None: ...


class StudyAnalyzer(ABC):
    """Base class for a model that analyses one kind of study."""

    #: Stable identifier stored on the study (``analyzer_id``) and accepted by the API.
    id: str
    #: Imaging modality code, e.g. ``XRAY``, ``CT``, ``MRI``, ``DERMOSCOPY``.
    modality: str
    display_name: str
    description: str = ""
    #: File extensions (lower case, no dot) the desktop/web pickers should offer.
    extensions: tuple[str, ...] = ()

    @abstractmethod
    def is_available(self) -> bool:
        """True when the trained model is installed and can run now."""

    @abstractmethod
    def accepts(self, blob: bytes, filename: str) -> tuple[bool, str | None]:
        """Whether this file is something the analyser can read (no model needed)."""

    @abstractmethod
    def analyze(self, blob: bytes, filename: str) -> AnalysisResult:
        """Run the model. Raise on failure; never return made-up findings."""

    def describe(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "modality": self.modality,
            "display_name": self.display_name,
            "description": self.description,
            "extensions": list(self.extensions),
            "available": self.is_available(),
        }


# --------------------------------------------------------------------------- registry

_REGISTRY: dict[str, StudyAnalyzer] = {}


def register(analyzer: StudyAnalyzer, *, replace: bool = False) -> StudyAnalyzer:
    if not getattr(analyzer, "id", None) or not getattr(analyzer, "modality", None):
        raise ValueError("Analysers need an id and a modality.")
    if analyzer.id in _REGISTRY and not replace:
        raise ValueError(f"Analyser {analyzer.id!r} is already registered.")
    _REGISTRY[analyzer.id] = analyzer
    return analyzer


def unregister(analyzer_id: str) -> None:
    _REGISTRY.pop(analyzer_id, None)


def get_analyzer(analyzer_id: str | None) -> StudyAnalyzer | None:
    return _REGISTRY.get(analyzer_id or "")


def list_analyzers(modality: str | None = None) -> list[StudyAnalyzer]:
    items = list(_REGISTRY.values())
    if modality:
        items = [a for a in items if a.modality == modality.upper()]
    return items


def resolve(
    blob: bytes,
    filename: str,
    *,
    analyzer_id: str | None = None,
    modality: str | None = None,
) -> StudyAnalyzer:
    """Pick the analyser for an upload: the one asked for, else the first that accepts the file."""
    if analyzer_id:
        analyzer = get_analyzer(analyzer_id)
        if analyzer is None:
            raise AnalysisError(f"Unknown analyser: {analyzer_id}.", 422, "UNKNOWN_ANALYZER")
        candidates = [analyzer]
    else:
        candidates = list_analyzers(modality)
        if not candidates:
            raise AnalysisError(
                "No study type is configured on this server.", 415, "UNSUPPORTED_MEDIA_TYPE"
            )

    reasons: list[str] = []
    for analyzer in candidates:
        ok, err = analyzer.accepts(blob, filename)
        if ok:
            return analyzer
        if err:
            reasons.append(err)
    names = ", ".join(a.display_name for a in candidates)
    raise AnalysisError(
        reasons[0]
        if len(candidates) == 1 and reasons
        else f"This file isn't a supported study ({names}).",
        415,
        "UNSUPPORTED_MEDIA_TYPE",
    )


# --------------------------------------------------------------------------- running


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _image_kind(analyzer: StudyAnalyzer) -> str:
    return analyzer.modality.lower()


def apply_result(study: Any, result: AnalysisResult, store: FileStoreLike, kind: str) -> None:
    """Write a result onto the study, replacing any images from an earlier run."""
    old = (getattr(study, "preview_path", None), getattr(study, "heatmap_path", None))
    study.preview_path = (
        store.save(study.user_id, kind, result.preview_png, ".png") if result.preview_png else None
    )
    study.heatmap_path = (
        store.save(study.user_id, kind, result.heatmap_png, ".png")
        if result.heatmap_png and result.heatmap_png != result.preview_png
        else None
    )
    store.delete(*old)

    study.status = Status.COMPLETED
    study.error = None
    study.primary_finding = result.primary_finding
    study.severity = result.severity
    study.model_name = result.model_name[:100]
    study.findings_json = json.dumps(result.findings_payload())
    study.analyzed_at = _utcnow()


def run_analysis(
    study: Any,
    analyzer: StudyAnalyzer,
    blob: bytes,
    store: FileStoreLike,
    *,
    failure_message: str = (
        "The study was saved but couldn't be analysed. Try running the analysis again."
    ),
) -> str:
    """Analyse a study in place and return its new status. Never raises for model problems."""
    if hasattr(study, "analyzer_id"):
        study.analyzer_id = analyzer.id
    if hasattr(study, "modality"):
        study.modality = analyzer.modality

    if not analyzer.is_available():
        study.status = Status.PENDING
        study.error = (
            f"No trained model is installed for {analyzer.display_name} yet. "
            "The study is saved and can be analysed once one is available."
        )
        logger.info(
            "study_analysis_pending", study_id=getattr(study, "id", None), analyzer=analyzer.id
        )
        return study.status

    try:
        result = analyzer.analyze(blob, study.original_filename)
        apply_result(study, result, store, _image_kind(analyzer))
    except Exception as exc:  # model missing at run time, unreadable pixels, bad output ...
        logger.error(
            "study_analysis_failed",
            study_id=getattr(study, "id", None),
            analyzer=analyzer.id,
            error=str(exc),
        )
        study.status = Status.FAILED
        study.error = failure_message
    return study.status


# --------------------------------------------------------------------------- built-in analysers


def _decode_data_url(data_url: str | None) -> bytes | None:
    if not data_url or "," not in data_url:
        return None
    try:
        return base64.b64decode(data_url.split(",", 1)[1])
    except (ValueError, TypeError):
        return None


class ChestXrayAnalyzer(StudyAnalyzer):
    """Multi-label chest radiograph model served by ``app.services.dicom_service``."""

    id = "chest_xray"
    modality = "XRAY"
    display_name = "Chest X-ray"
    description = (
        "Cardiomegaly, lung opacity, oedema, consolidation, atelectasis, pleural effusion and support "
        "devices on a frontal chest radiograph (CheXpert ensemble), with an attention map."
    )
    extensions = ("dcm", "dicom", "png", "jpg", "jpeg", "webp")

    def is_available(self) -> bool:
        path = CXR_CHECKPOINT_PATH
        if not (path.is_file() and path.stat().st_size >= 1000):
            return False
        try:
            import timm  # noqa: F401  (the ensemble's architectures)
        except ImportError:
            return False
        return True

    def accepts(self, blob: bytes, filename: str) -> tuple[bool, str | None]:
        from app.services.dicom_service import is_valid_chest_image  # heavy (torch); import lazily

        return is_valid_chest_image(blob, filename)

    def analyze(self, blob: bytes, filename: str) -> AnalysisResult:
        from app.services.dicom_service import analyze_dicom_image

        report = analyze_dicom_image(blob, filename)
        preview = _decode_data_url(report.get("preview_image"))
        return AnalysisResult(
            model_name=" · ".join(
                x for x in (report.get("model_architecture"), report.get("model_version")) if x
            ),
            findings=[
                Finding(
                    name=p.get("name"),
                    probability=p.get("probability"),
                    threshold=p.get("threshold"),
                    positive=bool(p.get("positive")),
                    description=p.get("description"),
                )
                for p in report.get("pathologies", [])
            ],
            primary_finding=report.get("primary_diagnosis"),
            severity=report.get("severity"),
            clinical_summary=report.get("clinical_summary"),
            recommended_actions=report.get("recommended_actions", []),
            disclaimer=report.get("disclaimer"),
            preview_png=preview,
            heatmap_png=_decode_data_url(report.get("heatmap_image")),
        )


def _register_builtin() -> None:
    register(ChestXrayAnalyzer(), replace=True)


_register_builtin()
