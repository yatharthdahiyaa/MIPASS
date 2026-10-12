"""
Grad-CAM++ Implementation — 3D/2D gradient-weighted class activation mapping.

Grad-CAM++ improves upon Grad-CAM by using higher-order derivatives to
better localize discriminative regions, especially for multiple instances
of the same class (e.g., multiple nodules in a CT scan).

Reference: Chattopadhyay et al. "Grad-CAM++: Generalized Gradient-based
Visual Explanations for Deep Convolutional Networks" (2018)
"""

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


class GradCAMPlusPlus:
    """Grad-CAM++ for 3D (volumetric) and 2D medical image models.

    Computes weighted combination of forward activation maps using
    the second and third order gradients (alpha weights) to produce
    a high-resolution class-discriminative heatmap.
    """

    def __init__(self, model: nn.Module, target_layer: nn.Module):
        """Initialize Grad-CAM++.

        Args:
            model: The neural network model.
            target_layer: The convolutional layer to compute Grad-CAM++ on.
        """
        self.model = model
        self.target_layer = target_layer

        # Storage for hook outputs
        self._activations: torch.Tensor | None = None
        self._gradients: torch.Tensor | None = None

        # Register hooks
        self._forward_hook = target_layer.register_forward_hook(self._save_activation)
        self._backward_hook = target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        """Forward hook: save activations."""
        self._activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        """Backward hook: save gradients."""
        self._gradients = grad_output[0].detach()

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class: int | None = None,
    ) -> np.ndarray:
        """Generate Grad-CAM++ heatmap.

        Args:
            input_tensor: Model input tensor [B, C, D, H, W] or [B, C, H, W].
            target_class: Target class index. If None, uses predicted class.

        Returns:
            Heatmap as numpy array, same spatial dimensions as input.
        """
        self.model.eval()
        input_tensor.requires_grad_(True)

        # Forward pass
        output = self.model(input_tensor)

        # Determine target class
        if target_class is None:
            target_class = output.argmax(dim=1).item()

        # Zero gradients
        self.model.zero_grad()

        # Backward pass on target class score
        target_score = output[0, target_class]
        target_score.backward(retain_graph=True)

        # Get activations and gradients
        activations = self._activations  # [B, K, d, h, w]
        gradients = self._gradients      # [B, K, d, h, w]

        if activations is None or gradients is None:
            raise RuntimeError("Hooks did not capture activations/gradients")

        # ──── Grad-CAM++ alpha computation ────
        # Second derivative (gradient of gradient)
        grad_2 = gradients.pow(2)
        # Third derivative approximation
        grad_3 = gradients.pow(3)

        # Spatial sum of activations for normalization
        spatial_dims = tuple(range(2, activations.ndim))
        sum_activations = activations.sum(dim=spatial_dims, keepdim=True)

        # Alpha weights (Grad-CAM++ specific)
        denominator = 2 * grad_2 + sum_activations * grad_3 + 1e-10
        alpha = grad_2 / denominator

        # Weighted gradients
        weights = (alpha * F.relu(gradients)).sum(dim=spatial_dims, keepdim=True)

        # Weighted combination of activation maps
        heatmap = (weights * activations).sum(dim=1, keepdim=True)
        heatmap = F.relu(heatmap)

        # Upsample to input spatial dimensions
        input_spatial = input_tensor.shape[2:]
        if activations.ndim == 5:
            # 3D volume
            heatmap = F.interpolate(
                heatmap,
                size=input_spatial,
                mode="trilinear",
                align_corners=False,
            )
        else:
            # 2D image
            heatmap = F.interpolate(
                heatmap,
                size=input_spatial,
                mode="bilinear",
                align_corners=False,
            )

        # Normalize to [0, 1]
        heatmap = heatmap.squeeze().cpu().numpy()
        heatmap_min, heatmap_max = heatmap.min(), heatmap.max()
        if heatmap_max > heatmap_min:
            heatmap = (heatmap - heatmap_min) / (heatmap_max - heatmap_min)

        return heatmap.astype(np.float32)

    def __del__(self):
        """Clean up hooks."""
        if hasattr(self, "_forward_hook"):
            self._forward_hook.remove()
        if hasattr(self, "_backward_hook"):
            self._backward_hook.remove()
