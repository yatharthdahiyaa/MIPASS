"""
3D ResNet Architecture Module.
Re-exports ResNet3D and associated blocks.
"""

from models.resnefallback import (
    ResBlock3D,
    Bottleneck3D,
    ResNet3D,
)

def resnet3d_10(in_channels: int = 1, num_classes: int = 2) -> ResNet3D:
    return ResNet3D(in_channels=in_channels, num_classes=num_classes, layers=[1, 1, 1, 1])

def resnet3d_18(in_channels: int = 1, num_classes: int = 2) -> ResNet3D:
    return ResNet3D(in_channels=in_channels, num_classes=num_classes, layers=[2, 2, 2, 2])

def resnet3d_34(in_channels: int = 1, num_classes: int = 2) -> ResNet3D:
    return ResNet3D(in_channels=in_channels, num_classes=num_classes, layers=[3, 4, 6, 3])

def resnet3d_50(in_channels: int = 1, num_classes: int = 2) -> ResNet3D:
    return ResNet3D(in_channels=in_channels, num_classes=num_classes, layers=[3, 4, 6, 3], use_bottleneck=True)

__all__ = [
    "ResBlock3D",
    "Bottleneck3D",
    "ResNet3D",
    "resnet3d_10",
    "resnet3d_18",
    "resnet3d_34",
    "resnet3d_50",
]
