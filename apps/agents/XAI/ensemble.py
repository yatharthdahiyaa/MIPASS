"""
Chest X-ray ensemble: the CheXpert 7-finding model in ``ml/chexpert_ensemble.pth``.

Three networks, each trained on CheXpert, averaged:

    densenet121          512 px   timm ``densenet121``
    tf_efficientnetv2_s  512 px   timm ``tf_efficientnetv2_s``
    rad_dino             518 px   timm ``vit_base_patch14_dinov2`` + head on [CLS, mean(patch tokens)]

Each network sees the image and its horizontal mirror ("hflip" test-time augmentation); the
ensemble probability is the mean of the six. A finding is positive when that mean reaches the
finding's threshold, which the checkpoint carries (fitted on the training run's tune split with
Youden's J).

The checkpoint is a dict of tensors and plain values, loaded with ``weights_only=True``: nothing
in the file can run code. Its format is checked before anything is built.

The same file is used by apps/agents/XAI (an identical copy; a test there checks they match).

Input normalisation is not stored in the checkpoint; ``MEMBER_NORMALISATION`` records what each
network was found to expect (see ``docs/CHEST_XRAY_MODEL.md`` for how it was determined).
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import logging

import numpy as np
import torch
import torch.nn as nn
from PIL import Image

logger = logging.getLogger("mipaas.cxr_ensemble")

EXPECTED_FORMAT = 1
IMAGENET = ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))
HALF = ((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
RAD_DINO = ((0.5307, 0.5307, 0.5307), (0.2583, 0.2583, 0.2583))

# What each member expects (mean, std) on RGB-replicated [0, 1] input.
MEMBER_NORMALISATION: dict[str, tuple[tuple[float, ...], tuple[float, ...]]] = {
    "densenet121": IMAGENET,
    "tf_efficientnetv2_s": IMAGENET,
    "rad_dino": IMAGENET,
}

# CheXpert labels that are findings (abnormal) vs. what is merely seen on the film.
NON_PATHOLOGY = {"Support Devices"}


class ModelFormatError(RuntimeError):
    """The checkpoint is not the ensemble format this module understands."""


class _Member(nn.Module):
    """Same attribute layout as the training code saved (``backbone.*``, ``head.*``)."""

    def __init__(self, backbone: nn.Module, head: nn.Module | None = None):
        super().__init__()
        self.backbone = backbone
        if head is not None:
            self.head = head

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if not hasattr(self, "head"):
            return self.backbone(x)
        tokens = self.backbone.forward_features(x)  # [B, 1 + patches, C], already normed
        pooled = torch.cat([tokens[:, 0], tokens[:, 1:].mean(dim=1)], dim=1)
        return self.head(pooled)


@dataclass
class _LoadedMember:
    name: str
    image_size: int
    model: _Member
    mean: torch.Tensor
    std: torch.Tensor


@dataclass
class Ensemble:
    labels: list[str]
    thresholds: dict[str, float]
    description: str
    created: str
    members: list[_LoadedMember]

    @property
    def model_name(self) -> str:
        return "CheXpert ensemble (" + " + ".join(m.name for m in self.members) + ")"


def _build_member(spec: dict[str, Any], n_labels: int) -> _Member:
    import timm  # heavy; only when a model is actually loaded

    name = spec["model_name"]
    if name == "rad_dino":
        backbone = timm.create_model(
            "vit_base_patch14_dinov2", pretrained=False, img_size=int(spec["image_size"]), num_classes=0
        )
        width = 2 * backbone.num_features
        head = nn.Sequential(nn.LayerNorm(width), nn.Dropout(float(spec.get("dropout", 0.0))), nn.Linear(width, n_labels))
        return _Member(backbone, head)
    if name in ("densenet121", "tf_efficientnetv2_s"):
        return _Member(timm.create_model(name, pretrained=False, num_classes=n_labels))
    raise ModelFormatError(f"unknown ensemble member {name!r}")


def load(path: Path) -> Ensemble:
    checkpoint = torch.load(str(path), map_location="cpu", weights_only=True)
    if not isinstance(checkpoint, dict) or checkpoint.get("format_version") != EXPECTED_FORMAT:
        raise ModelFormatError(f"{path.name} is not a format {EXPECTED_FORMAT} ensemble checkpoint")
    labels = list(checkpoint["labels"])
    thresholds = {k: float(v) for k, v in checkpoint["thresholds"].items()}
    if set(thresholds) != set(labels):
        raise ModelFormatError("thresholds don't cover exactly the model's labels")
    if checkpoint.get("tta") not in (None, "hflip"):
        raise ModelFormatError(f"unsupported test-time augmentation {checkpoint.get('tta')!r}")

    members = []
    for spec in checkpoint["members"]:
        model = _build_member(spec, len(labels))
        model.load_state_dict(spec["state_dict"], strict=True)  # any mismatch is an error
        model.eval()
        mean, std = MEMBER_NORMALISATION[spec["model_name"]]
        members.append(
            _LoadedMember(
                name=spec["name"],
                image_size=int(spec["image_size"]),
                model=model,
                mean=torch.tensor(mean).view(1, 3, 1, 1),
                std=torch.tensor(std).view(1, 3, 1, 1),
            )
        )
    logger.info("cxr ensemble loaded from %s: %s", path, ", ".join(m.name for m in members))
    return Ensemble(
        labels=labels,
        thresholds=thresholds,
        description=str(checkpoint.get("description", "")),
        created=str(checkpoint.get("created", "")),
        members=members,
    )


_CACHE: dict[str, Ensemble] = {}
_LOCK = threading.Lock()


def get(path: Path) -> Ensemble:
    """The ensemble, loaded once per process (about 115M parameters)."""
    key = str(path)
    with _LOCK:
        if key not in _CACHE:
            _CACHE[key] = load(path)
        return _CACHE[key]


def _input(gray: np.ndarray, member: _LoadedMember) -> torch.Tensor:
    """uint8 grayscale [H, W] -> normalised [1, 3, S, S] for one member."""
    size = member.image_size
    img = Image.fromarray(gray).resize((size, size), Image.Resampling.BILINEAR)
    x = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255.0).expand(3, -1, -1).unsqueeze(0)
    return (x - member.mean) / member.std


@torch.no_grad()
def predict(ensemble: Ensemble, gray: np.ndarray) -> dict[str, Any]:
    """Probabilities for one radiograph (uint8 grayscale, any size).

    Returns {"probabilities": {label: p}, "members": {member: {label: p}}}: the ensemble mean and
    each member's own mean over the original and mirrored image (members are kept so disagreement
    between them can be shown to the doctor).
    """
    per_member: dict[str, np.ndarray] = {}
    for member in ensemble.members:
        x = _input(gray, member)
        both = torch.cat([x, torch.flip(x, dims=[3])])
        probs = torch.sigmoid(member.model(both)).mean(dim=0).numpy()
        per_member[member.name] = probs
    mean = np.mean(list(per_member.values()), axis=0)
    return {
        "probabilities": {label: float(mean[i]) for i, label in enumerate(ensemble.labels)},
        "members": {name: {label: float(p[i]) for i, label in enumerate(ensemble.labels)} for name, p in per_member.items()},
    }


def gradcam(ensemble: Ensemble, gray: np.ndarray, label: str) -> np.ndarray:
    """Grad-CAM for one label from the DenseNet member, as a [0, 1] map the size of ``gray``.

    The attention map comes from one of the three networks: it shows where that network looked,
    not where the ensemble as a whole did.
    """
    member = next(m for m in ensemble.members if m.name == "densenet121")
    model = member.model
    target = model.backbone.features.norm5
    store: dict[str, torch.Tensor] = {}
    hooks = [
        target.register_forward_hook(lambda _m, _i, out: store.__setitem__("act", out)),
        target.register_full_backward_hook(lambda _m, _gi, gout: store.__setitem__("grad", gout[0])),
    ]
    try:
        x = _input(gray, member).requires_grad_(True)
        model.zero_grad()
        logits = model(x)
        logits[0, ensemble.labels.index(label)].backward()
        weights = store["grad"][0].mean(dim=(1, 2), keepdim=True)
        cam = torch.relu((weights * store["act"][0]).sum(dim=0)).detach().numpy()
    finally:
        for h in hooks:
            h.remove()
        model.zero_grad()
    if cam.max() > cam.min():
        cam = (cam - cam.min()) / (cam.max() - cam.min())
    else:
        cam = np.zeros_like(cam)
    up = Image.fromarray((cam * 255).astype(np.uint8)).resize((gray.shape[1], gray.shape[0]), Image.Resampling.BICUBIC)
    return np.asarray(up, dtype=np.float32) / 255.0
