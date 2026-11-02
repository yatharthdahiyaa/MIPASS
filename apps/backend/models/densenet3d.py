"""
3D DenseNet Architecture Module.
Re-exports DenseNet3D and associated blocks.
"""

from models.densefallback import (
    DenseLayer3D,
    DenseBlock3D,
    TransitionBlock3D,
    DenseNet3D,
)

def densenet3d_121(in_channels: int = 1, num_classes: int = 2) -> DenseNet3D:
    return DenseNet3D(in_channels=in_channels, num_classes=num_classes, growth_rate=32, block_config=[6, 12, 24, 16])

def densenet3d_169(in_channels: int = 1, num_classes: int = 2) -> DenseNet3D:
    return DenseNet3D(in_channels=in_channels, num_classes=num_classes, growth_rate=32, block_config=[6, 12, 32, 32])

def densenet3d_201(in_channels: int = 1, num_classes: int = 2) -> DenseNet3D:
    return DenseNet3D(in_channels=in_channels, num_classes=num_classes, growth_rate=32, block_config=[6, 12, 48, 32])

__all__ = [
    "DenseLayer3D",
    "DenseBlock3D",
    "TransitionBlock3D",
    "DenseNet3D",
    "densenet3d_121",
    "densenet3d_169",
    "densenet3d_201",
]
