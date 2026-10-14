"""
Chest X-ray Multi-Label Disease Classification Models — Real Trained Architectures.

Integrated from MODELS/shreya.
Supports DenseNet-121 and ResNet-18 for 14 chest pathology classes:
Atelectasis, Cardiomegaly, Consolidation, Edema, Effusion, Emphysema,
Fibrosis, Hernia, Infiltration, Mass, Nodule, Pleural Thickening,
Pneumonia, Pneumothorax.

ZERO FALLBACK ARCHITECTURE: Uses real DenseNet-121/ResNet-18 architectures
that strictly match the trained checkpoint weights in MODELS/shreya.
"""

import os
import json
import torch
import torch.nn as nn
import torch.nn.functional as F

NUM_CLASSES = 14

DISEASE_CLASSES = [
    "Atelectasis",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Effusion",
    "Emphysema",
    "Fibrosis",
    "Hernia",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pleural_Thickening",
    "Pneumonia",
    "Pneumothorax",
]

DEFAULT_THRESHOLDS = {
    "Atelectasis": 0.28,
    "Cardiomegaly": 0.25,
    "Consolidation": 0.26,
    "Edema": 0.22,
    "Effusion": 0.30,
    "Emphysema": 0.16,
    "Fibrosis": 0.18,
    "Hernia": 0.12,
    "Infiltration": 0.32,
    "Mass": 0.18,
    "Nodule": 0.15,
    "Pleural_Thickening": 0.24,
    "Pneumonia": 0.22,
    "Pneumothorax": 0.20,
}


class _DenseLayer(nn.Module):
    def __init__(self, num_input_features: int, growth_rate: int, bn_size: int = 4):
        super().__init__()
        self.norm1 = nn.BatchNorm2d(num_input_features)
        self.relu1 = nn.ReLU(inplace=False)
        self.conv1 = nn.Conv2d(num_input_features, bn_size * growth_rate, kernel_size=1, stride=1, bias=False)
        self.norm2 = nn.BatchNorm2d(bn_size * growth_rate)
        self.relu2 = nn.ReLU(inplace=False)
        self.conv2 = nn.Conv2d(bn_size * growth_rate, growth_rate, kernel_size=3, stride=1, padding=1, bias=False)

    def forward(self, init_features: torch.Tensor) -> torch.Tensor:
        features = [init_features]
        x = torch.cat(features, 1)
        new_features = self.conv1(self.relu1(self.norm1(x)))
        new_features = self.conv2(self.relu2(self.norm2(new_features)))
        return new_features


class _DenseBlock(nn.ModuleDict):
    def __init__(self, num_layers: int, num_input_features: int, bn_size: int = 4, growth_rate: int = 32):
        super().__init__()
        for i in range(num_layers):
            self.add_module(
                f"denselayer{i+1}",
                _DenseLayer(num_input_features + i * growth_rate, growth_rate=growth_rate, bn_size=bn_size),
            )

    def forward(self, init_features: torch.Tensor) -> torch.Tensor:
        features = [init_features]
        for name, layer in self.items():
            features.append(layer(torch.cat(features, 1)))
        return torch.cat(features, 1)


class _Transition(nn.Sequential):
    def __init__(self, num_input_features: int, num_output_features: int):
        super().__init__()
        self.norm = nn.BatchNorm2d(num_input_features)
        self.relu = nn.ReLU(inplace=False)
        self.conv = nn.Conv2d(num_input_features, num_output_features, kernel_size=1, stride=1, bias=False)
        self.pool = nn.AvgPool2d(kernel_size=2, stride=2)


class DenseNet121(nn.Module):
    """Full DenseNet-121 architecture matching trained checkpoints in MODELS/shreya."""

    def __init__(
        self,
        growth_rate: int = 32,
        block_config: tuple = (6, 12, 24, 16),
        num_init_features: int = 64,
        bn_size: int = 4,
        num_classes: int = NUM_CLASSES,
        in_channels: int = 1,
    ):
        super().__init__()
        self.features = nn.Sequential()
        self.features.add_module(
            "conv0",
            nn.Conv2d(in_channels, num_init_features, kernel_size=7, stride=2, padding=3, bias=False),
        )
        self.features.add_module("norm0", nn.BatchNorm2d(num_init_features))
        self.features.add_module("relu0", nn.ReLU(inplace=False))
        self.features.add_module("pool0", nn.MaxPool2d(kernel_size=3, stride=2, padding=1))

        num_features = num_init_features
        for i, num_layers in enumerate(block_config):
            self.features.add_module(
                f"denseblock{i+1}",
                _DenseBlock(num_layers, num_features, bn_size, growth_rate),
            )
            num_features += num_layers * growth_rate
            if i != len(block_config) - 1:
                self.features.add_module(
                    f"transition{i+1}",
                    _Transition(num_features, num_features // 2),
                )
                num_features //= 2

        self.features.add_module("norm5", nn.BatchNorm2d(num_features))
        self.classifier = nn.Linear(num_features, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.features(x)
        out = F.relu(features, inplace=False)
        out = F.adaptive_avg_pool2d(out, (1, 1))
        out = torch.flatten(out, 1)
        return self.classifier(out)


def build_densenet121(num_classes: int = NUM_CLASSES, in_channels: int = 1) -> nn.Module:
    """Build DenseNet-121 adapted for chest X-ray inputs without fallback."""
    return DenseNet121(num_classes=num_classes, in_channels=in_channels)


def build_resnet18(num_classes: int = NUM_CLASSES, in_channels: int = 1) -> nn.Module:
    """Build ResNet-18 adapted for chest X-ray inputs."""
    # Standard ResNet-18 definition matching best_resnet18.pth
    class BasicBlock(nn.Module):
        expansion = 1
        def __init__(self, inplanes, planes, stride=1, downsample=None):
            super().__init__()
            self.conv1 = nn.Conv2d(inplanes, planes, 3, stride, 1, bias=False)
            self.bn1 = nn.BatchNorm2d(planes)
            self.relu = nn.ReLU(inplace=False)
            self.conv2 = nn.Conv2d(planes, planes, 3, 1, 1, bias=False)
            self.bn2 = nn.BatchNorm2d(planes)
            self.downsample = downsample
        def forward(self, x):
            identity = x
            out = self.relu(self.bn1(self.conv1(x)))
            out = self.bn2(self.conv2(out))
            if self.downsample is not None:
                identity = self.downsample(x)
            out += identity
            return self.relu(out)

    class ResNet(nn.Module):
        def __init__(self, block, layers, num_classes=14, in_channels=1):
            super().__init__()
            self.inplanes = 64
            self.conv1 = nn.Conv2d(in_channels, 64, 7, 2, 3, bias=False)
            self.bn1 = nn.BatchNorm2d(64)
            self.relu = nn.ReLU(inplace=False)
            self.maxpool = nn.MaxPool2d(3, 2, 1)
            self.layer1 = self._make_layer(block, 64, layers[0])
            self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
            self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
            self.layer4 = self._make_layer(block, 512, layers[3], stride=2)
            self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
            self.fc = nn.Linear(512, num_classes)
        def _make_layer(self, block, planes, blocks, stride=1):
            downsample = None
            if stride != 1 or self.inplanes != planes:
                downsample = nn.Sequential(
                    nn.Conv2d(self.inplanes, planes, 1, stride, bias=False),
                    nn.BatchNorm2d(planes)
                )
            layers = [block(self.inplanes, planes, stride, downsample)]
            self.inplanes = planes
            for _ in range(1, blocks):
                layers.append(block(self.inplanes, planes))
            return nn.Sequential(*layers)
        def forward(self, x):
            x = self.maxpool(self.relu(self.bn1(self.conv1(x))))
            x = self.layer1(x)
            x = self.layer2(x)
            x = self.layer3(x)
            x = self.layer4(x)
            x = self.avgpool(x)
            x = torch.flatten(x, 1)
            return self.fc(x)

    return ResNet(BasicBlock, [2, 2, 2, 2], num_classes=num_classes, in_channels=in_channels)


def load_thresholds(config_path: str | None = None, model_variant: str = "densenet121") -> dict[str, float]:
    """Load calibrated thresholds for each pathology class."""
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                data = json.load(f)
            if model_variant in data:
                return data[model_variant]
            return data
        except Exception:
            pass
    return DEFAULT_THRESHOLDS.copy()


__all__ = [
    "NUM_CLASSES",
    "DISEASE_CLASSES",
    "DEFAULT_THRESHOLDS",
    "DenseNet121",
    "build_densenet121",
    "build_resnet18",
    "load_thresholds",
]
