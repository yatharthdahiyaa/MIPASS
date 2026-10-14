"""
HAM10000 Skin Lesion Classification Models — Real Trained Architectures.

Integrated from MODELS/HAM10000-Skin-Lesion-Classifier.
Architecture: Exact EfficientNet-B0 and BaselineCNN matching trained checkpoints:
- baseline_best.pth (423k params)
- efficientnet_inference.pth (4.6M params)

Supports 7 dermatological diagnosis classes:
- akiec (Actinic Keratosis)
- bcc (Basal Cell Carcinoma)
- bkl (Benign Keratosis)
- df (Dermatofibroma)
- mel (Melanoma)
- nv (Melanocytic Nevi)
- vasc (Vascular Lesions)

ZERO FALLBACK ARCHITECTURE: Strict parameter-matching definitions.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

CLASS_NAMES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

CLASS_METADATA = {
    "akiec": {
        "full_name": "Actinic Keratosis / Intraepithelial Carcinoma",
        "description": "Pre-cancerous / early squamous cell lesion caused by UV exposure.",
        "malignant": True,
    },
    "bcc": {
        "full_name": "Basal Cell Carcinoma",
        "description": "Common non-melanoma skin cancer with high cure rate when caught early.",
        "malignant": True,
    },
    "bkl": {
        "full_name": "Benign Keratosis",
        "description": "Non-cancerous growths including seborrheic keratosis and solar lentigines.",
        "malignant": False,
    },
    "df": {
        "full_name": "Dermatofibroma",
        "description": "Benign fibrous nodule commonly found on the lower extremities.",
        "malignant": False,
    },
    "mel": {
        "full_name": "Melanoma",
        "description": "Aggressive malignant skin neoplasm originating from melanocytes.",
        "malignant": True,
    },
    "nv": {
        "full_name": "Melanocytic Nevi",
        "description": "Common benign pigmented mole composed of clustered melanocytes.",
        "malignant": False,
    },
    "vasc": {
        "full_name": "Vascular Lesions",
        "description": "Benign vascular proliferations (angiomas, pyogenic granulomas).",
        "malignant": False,
    },
}


class BaselineCNN(nn.Module):
    """Exact BaselineCNN matching baseline_best.pth weights."""

    def __init__(self, num_classes: int = 7):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
        )
        self.gap = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.3),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)
        return self.classifier(x)


class ConvNormActivation(nn.Sequential):
    def __init__(self, in_planes, out_planes, kernel_size=3, stride=1, padding=None, groups=1, bias=False):
        if padding is None:
            padding = (kernel_size - 1) // 2
        super().__init__(
            nn.Conv2d(in_planes, out_planes, kernel_size, stride, padding, groups=groups, bias=bias),
            nn.BatchNorm2d(out_planes),
            nn.SiLU(),
        )


class SqueezeExcitation(nn.Module):
    def __init__(self, input_channels, squeeze_channels):
        super().__init__()
        self.avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc1 = nn.Conv2d(input_channels, squeeze_channels, 1)
        self.activation = nn.SiLU()
        self.fc2 = nn.Conv2d(squeeze_channels, input_channels, 1)
        self.scale_activation = nn.Sigmoid()

    def forward(self, x):
        scale = self.avgpool(x)
        scale = self.activation(self.fc1(scale))
        scale = self.scale_activation(self.fc2(scale))
        return scale * x


class MBConv(nn.Module):
    def __init__(self, in_ch, out_ch, kernel, stride, expand_ratio, se_ratio=0.25):
        super().__init__()
        self.use_res_connect = stride == 1 and in_ch == out_ch
        mid_ch = in_ch * expand_ratio
        layers = []
        if expand_ratio != 1:
            layers.append(ConvNormActivation(in_ch, mid_ch, kernel_size=1))
        layers.append(ConvNormActivation(mid_ch, mid_ch, kernel_size=kernel, stride=stride, groups=mid_ch))
        squeeze_ch = max(1, int(in_ch * se_ratio))
        layers.append(SqueezeExcitation(mid_ch, squeeze_ch))
        layers.append(nn.Sequential(
            nn.Conv2d(mid_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
        ))
        self.block = nn.Sequential(*layers)

    def forward(self, x):
        res = self.block(x)
        if self.use_res_connect:
            return x + res
        return res


class TrainedEfficientNetB0(nn.Module):
    """Full EfficientNet-B0 matching efficientnet_inference.pth state_dict."""

    def __init__(self, num_classes: int = 7):
        super().__init__()
        configs = [
            (1, 3, 1, 32, 16, 1),
            (6, 3, 2, 16, 24, 2),
            (6, 5, 2, 24, 40, 2),
            (6, 3, 2, 40, 80, 3),
            (6, 5, 1, 80, 112, 3),
            (6, 5, 2, 112, 192, 4),
            (6, 3, 1, 192, 320, 1),
        ]
        features = [ConvNormActivation(3, 32, kernel_size=3, stride=2)]
        for exp, k, s, in_c, out_c, n in configs:
            stage = []
            for i in range(n):
                stride = s if i == 0 else 1
                inp = in_c if i == 0 else out_c
                stage.append(MBConv(inp, out_c, k, stride, exp))
            features.append(nn.Sequential(*stage))
        features.append(ConvNormActivation(320, 1280, kernel_size=1))

        self.features = nn.Sequential(*features)
        self.avgpool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(1280, 512),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        return self.classifier(x)


def build_efficientnet(num_classes: int = 7) -> nn.Module:
    """Build trained EfficientNet-B0 architecture matching checkpoint."""
    return TrainedEfficientNetB0(num_classes=num_classes)


def build_baseline_cnn(num_classes: int = 7) -> nn.Module:
    """Build trained BaselineCNN architecture matching checkpoint."""
    return BaselineCNN(num_classes=num_classes)


__all__ = [
    "CLASS_NAMES",
    "CLASS_METADATA",
    "BaselineCNN",
    "TrainedEfficientNetB0",
    "build_efficientnet",
    "build_baseline_cnn",
]
