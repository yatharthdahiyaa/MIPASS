"""
3D DenseNet Architecture — Standalone implementation.

Used as a fallback when MONAI is not available.
DenseNet uses dense connections where each layer receives feature
maps from all preceding layers — particularly effective for medical
imaging where features at multiple scales are important.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class DenseLayer3D(nn.Module):
    """Single dense layer within a DenseBlock."""

    def __init__(self, in_channels: int, growth_rate: int, bn_size: int = 4):
        super().__init__()
        mid_channels = bn_size * growth_rate

        self.norm1 = nn.BatchNorm3d(in_channels)
        self.conv1 = nn.Conv3d(in_channels, mid_channels, kernel_size=1, bias=False)
        self.norm2 = nn.BatchNorm3d(mid_channels)
        self.conv2 = nn.Conv3d(mid_channels, growth_rate, kernel_size=3, padding=1, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.conv1(F.relu(self.norm1(x), inplace=True))
        out = self.conv2(F.relu(self.norm2(out), inplace=True))
        return torch.cat([x, out], dim=1)


class DenseBlock3D(nn.Module):
    """Dense block — sequence of dense layers with concatenated outputs."""

    def __init__(self, num_layers: int, in_channels: int, growth_rate: int):
        super().__init__()
        self.layers = nn.ModuleList()
        for i in range(num_layers):
            self.layers.append(
                DenseLayer3D(in_channels + i * growth_rate, growth_rate)
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x)
        return x


class TransitionBlock3D(nn.Module):
    """Transition block between dense blocks — reduces spatial dimensions."""

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.norm = nn.BatchNorm3d(in_channels)
        self.conv = nn.Conv3d(in_channels, out_channels, kernel_size=1, bias=False)
        self.pool = nn.AvgPool3d(kernel_size=2, stride=2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv(F.relu(self.norm(x), inplace=True))
        x = self.pool(x)
        return x


class DenseNet3D(nn.Module):
    """3D DenseNet for volumetric medical image classification.

    Architecture:
        Input [B, 1, D, H, W]
        → Conv3d(1→64) + BN + ReLU + MaxPool3d
        → DenseBlock(6 layers, growth=32)    → Transition
        → DenseBlock(12 layers, growth=32)   → Transition
        → DenseBlock(24 layers, growth=32)   → Transition  ← Grad-CAM++
        → DenseBlock(16 layers, growth=32)
        → BN + ReLU + AdaptiveAvgPool3d
        → FC → num_classes
    """

    def __init__(
        self,
        in_channels: int = 1,
        num_classes: int = 2,
        growth_rate: int = 32,
        block_config: list[int] | None = None,
        init_features: int = 64,
        compression: float = 0.5,
    ):
        """Initialize 3D DenseNet.

        Args:
            in_channels: Number of input channels.
            num_classes: Number of output classes.
            growth_rate: How many features each dense layer adds.
            block_config: Number of layers in each dense block.
            init_features: Number of features after stem convolution.
            compression: Compression factor for transition layers.
        """
        super().__init__()
        block_config = block_config or [6, 12, 24, 16]

        # Stem
        self.features = nn.Sequential()
        self.features.add_module("conv0", nn.Conv3d(
            in_channels, init_features, kernel_size=7, stride=2, padding=3, bias=False
        ))
        self.features.add_module("norm0", nn.BatchNorm3d(init_features))
        self.features.add_module("relu0", nn.ReLU(inplace=True))
        self.features.add_module("pool0", nn.MaxPool3d(kernel_size=3, stride=2, padding=1))

        # Dense blocks + transitions
        num_features = init_features
        for i, num_layers in enumerate(block_config):
            block = DenseBlock3D(
                num_layers=num_layers,
                in_channels=num_features,
                growth_rate=growth_rate,
            )
            self.features.add_module(f"denseblock{i + 1}", block)
            num_features = num_features + num_layers * growth_rate

            # Add transition (except after last block)
            if i != len(block_config) - 1:
                out_features = int(num_features * compression)
                transition = TransitionBlock3D(num_features, out_features)
                self.features.add_module(f"transition{i + 1}", transition)
                num_features = out_features

        # Final batch norm
        self.features.add_module("norm_final", nn.BatchNorm3d(num_features))

        # Classifier
        self.avgpool = nn.AdaptiveAvgPool3d((1, 1, 1))
        self.classifier = nn.Linear(num_features, num_classes)

        # Weight initialization
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv3d):
                nn.init.kaiming_normal_(m.weight)
            elif isinstance(m, nn.BatchNorm3d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.constant_(m.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: Input tensor [B, C, D, H, W].

        Returns:
            Logits tensor [B, num_classes].
        """
        features = self.features(x)
        out = F.relu(features, inplace=True)
        out = self.avgpool(out)
        out = torch.flatten(out, 1)
        out = self.classifier(out)
        return out
