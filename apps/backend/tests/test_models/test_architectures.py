"""Tests for 3D model architectures."""
import pytest
import torch


def test_resnet3d_forward_pass():
    """Test ResNet3D produces correct output shape."""
    from models.resnet3d import ResNet3D

    model = ResNet3D(in_channels=1, num_classes=2)
    x = torch.randn(1, 1, 32, 64, 64)
    output = model(x)

    assert output.shape == (1, 2)


def test_resnet3d_bottleneck():
    """Test ResNet3D with bottleneck blocks."""
    from models.resnet3d import ResNet3D

    model = ResNet3D(in_channels=1, num_classes=3, use_bottleneck=True)
    x = torch.randn(1, 1, 32, 64, 64)
    output = model(x)

    assert output.shape == (1, 3)


def test_densenet3d_forward_pass():
    """Test DenseNet3D produces correct output shape."""
    from models.densenet3d import DenseNet3D

    model = DenseNet3D(in_channels=1, num_classes=2, block_config=[2, 4, 4, 2])
    x = torch.randn(1, 1, 32, 64, 64)
    output = model(x)

    assert output.shape == (1, 2)


def test_resnet3d_gradcam_layer():
    """Test that layer4 is accessible for Grad-CAM++."""
    from models.resnet3d import ResNet3D

    model = ResNet3D(in_channels=1, num_classes=2)
    assert hasattr(model, "layer4")
    assert len(list(model.layer4.children())) > 0


def test_densenet3d_features_accessible():
    """Test that DenseNet features are accessible for Grad-CAM++."""
    from models.densenet3d import DenseNet3D

    model = DenseNet3D(in_channels=1, num_classes=2, block_config=[2, 4, 4, 2])
    assert hasattr(model, "features")
    # Check dense blocks exist
    has_denseblock = any("denseblock" in name for name, _ in model.features.named_children())
    assert has_denseblock
