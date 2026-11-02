"""
3D ResNet Architecture — Standalone implementation.

Used as a fallback when MONAI is not available.
Follows the standard ResNet architecture adapted for 3D volumetric inputs.
"""

import torch
import torch.nn as nn


class ResBlock3D(nn.Module):
    """Residual block for 3D convolutions."""

    expansion = 1

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super().__init__()
        self.conv1 = nn.Conv3d(
            in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False
        )
        self.bn1 = nn.BatchNorm3d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv3d(
            out_channels, out_channels, kernel_size=3, stride=1, padding=1, bias=False
        )
        self.bn2 = nn.BatchNorm3d(out_channels)

        self.downsample = None
        if stride != 1 or in_channels != out_channels:
            self.downsample = nn.Sequential(
                nn.Conv3d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm3d(out_channels),
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)

        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity
        out = self.relu(out)
        return out


class Bottleneck3D(nn.Module):
    """Bottleneck residual block for 3D convolutions."""

    expansion = 4

    def __init__(self, in_channels: int, mid_channels: int, stride: int = 1):
        super().__init__()
        out_channels = mid_channels * self.expansion

        self.conv1 = nn.Conv3d(in_channels, mid_channels, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm3d(mid_channels)
        self.conv2 = nn.Conv3d(
            mid_channels, mid_channels, kernel_size=3, stride=stride, padding=1, bias=False
        )
        self.bn2 = nn.BatchNorm3d(mid_channels)
        self.conv3 = nn.Conv3d(mid_channels, out_channels, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm3d(out_channels)
        self.relu = nn.ReLU(inplace=True)

        self.downsample = None
        if stride != 1 or in_channels != out_channels:
            self.downsample = nn.Sequential(
                nn.Conv3d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm3d(out_channels),
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x

        out = self.relu(self.bn1(self.conv1(x)))
        out = self.relu(self.bn2(self.conv2(out)))
        out = self.bn3(self.conv3(out))

        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity
        out = self.relu(out)
        return out


class ResNet3D(nn.Module):
    """3D ResNet for volumetric medical image classification.

    Architecture:
        Input [B, 1, D, H, W]
        → Conv3d(1→64, 7³, stride=2) + BN + ReLU
        → MaxPool3d(3³, stride=2)
        → Layer1: 3× ResBlock(64→64)
        → Layer2: 4× ResBlock(64→128, stride=2)
        → Layer3: 6× ResBlock(128→256, stride=2)  ← Grad-CAM++ target
        → Layer4: 3× ResBlock(256→512, stride=2)
        → AdaptiveAvgPool3d(1,1,1)
        → FC(512 → num_classes)
    """

    def __init__(
        self,
        in_channels: int = 1,
        num_classes: int = 2,
        layers: list[int] | None = None,
        use_bottleneck: bool = False,
    ):
        """Initialize 3D ResNet.

        Args:
            in_channels: Number of input channels (1 for grayscale).
            num_classes: Number of output classes.
            layers: Number of blocks per layer [l1, l2, l3, l4].
            use_bottleneck: Use Bottleneck blocks (for ResNet-50+).
        """
        super().__init__()
        layers = layers or [3, 4, 6, 3]
        block = Bottleneck3D if use_bottleneck else ResBlock3D

        self.in_planes = 64

        # Stem
        self.conv1 = nn.Conv3d(
            in_channels, 64, kernel_size=7, stride=2, padding=3, bias=False
        )
        self.bn1 = nn.BatchNorm3d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool3d(kernel_size=3, stride=2, padding=1)

        # Residual layers
        self.layer1 = self._make_layer(block, 64, layers[0], stride=1)
        self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
        self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
        self.layer4 = self._make_layer(block, 512, layers[3], stride=2)

        # Classifier
        self.avgpool = nn.AdaptiveAvgPool3d((1, 1, 1))
        final_channels = 512 * block.expansion
        self.fc = nn.Linear(final_channels, num_classes)

        # Weight initialization
        self._init_weights()

    def _make_layer(
        self,
        block: type,
        planes: int,
        num_blocks: int,
        stride: int,
    ) -> nn.Sequential:
        """Build a residual layer."""
        if block == Bottleneck3D:
            first_block = block(self.in_planes, planes, stride)
            self.in_planes = planes * block.expansion
            layers = [first_block]
            for _ in range(1, num_blocks):
                layers.append(block(self.in_planes, planes))
        else:
            first_block = block(self.in_planes, planes, stride)
            self.in_planes = planes
            layers = [first_block]
            for _ in range(1, num_blocks):
                layers.append(block(planes, planes))

        return nn.Sequential(*layers)

    def _init_weights(self):
        """Kaiming initialization for conv and linear layers."""
        for m in self.modules():
            if isinstance(m, nn.Conv3d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm3d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                nn.init.constant_(m.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: Input tensor [B, C, D, H, W].

        Returns:
            Logits tensor [B, num_classes].
        """
        x = self.relu(self.bn1(self.conv1(x)))
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)

        return x
