"""
Integrated Gradients — Attribution via input interpolation path.

Computes the integral of gradients along a straight-line path from
a baseline (e.g., zeros) to the actual input. This satisfies the
Completeness axiom: attributions sum to the difference between the
model's output on the input vs the baseline.

Reference: Sundararajan et al. "Axiomatic Attribution for Deep Networks" (2017)
"""

import numpy as np
import torch
import torch.nn as nn


class IntegratedGradients:
    """Integrated Gradients for 3D/2D medical imaging models.

    Uses the Captum library when available, falls back to manual
    Riemann sum approximation.
    """

    def __init__(
        self,
        model: nn.Module,
        n_steps: int = 50,
        baseline_type: str = "zeros",
    ):
        """Initialize Integrated Gradients.

        Args:
            model: The neural network model.
            n_steps: Number of interpolation steps (higher = more accurate).
            baseline_type: 'zeros' or 'noise' (Gaussian noise baseline).
        """
        self.model = model
        self.n_steps = n_steps
        self.baseline_type = baseline_type

    def _create_baseline(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """Create baseline input.

        Args:
            input_tensor: Original input tensor.

        Returns:
            Baseline tensor of same shape.
        """
        if self.baseline_type == "zeros":
            return torch.zeros_like(input_tensor)
        elif self.baseline_type == "noise":
            return torch.randn_like(input_tensor) * 0.01
        else:
            return torch.zeros_like(input_tensor)

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class: int | None = None,
    ) -> np.ndarray:
        """Compute Integrated Gradients attribution map.

        Args:
            input_tensor: Model input [B, C, D, H, W] or [B, C, H, W].
            target_class: Target class. If None, uses predicted class.

        Returns:
            Attribution map as numpy array (same spatial dims as input).
        """
        self.model.eval()
        device = input_tensor.device

        # Try using Captum (optimized implementation)
        try:
            return self._generate_with_captum(input_tensor, target_class)
        except ImportError:
            pass

        # Manual Riemann sum implementation
        baseline = self._create_baseline(input_tensor)

        # Determine target class
        if target_class is None:
            with torch.no_grad():
                output = self.model(input_tensor)
                target_class = output.argmax(dim=1).item()

        # Compute interpolation steps
        alphas = torch.linspace(0, 1, self.n_steps + 1, device=device)

        # Accumulate gradients along interpolation path
        integrated_grads = torch.zeros_like(input_tensor)

        for i, alpha in enumerate(alphas):
            # Interpolated input
            interpolated = baseline + alpha * (input_tensor - baseline)
            interpolated.requires_grad_(True)

            # Forward pass
            output = self.model(interpolated)
            target_score = output[0, target_class]

            # Backward pass
            self.model.zero_grad()
            target_score.backward(retain_graph=True)

            if interpolated.grad is not None:
                integrated_grads += interpolated.grad.detach()

            interpolated.requires_grad_(False)

        # Average gradients (Riemann sum approximation)
        integrated_grads = integrated_grads / (self.n_steps + 1)

        # Scale by input - baseline difference
        attributions = (input_tensor - baseline).detach() * integrated_grads

        # Reduce channel dimension and take absolute values
        attr_map = attributions.squeeze(0).abs()
        if attr_map.ndim > 3:
            attr_map = attr_map.mean(dim=0)  # Average over channels

        attr_map = attr_map.cpu().numpy()

        # Normalize to [0, 1]
        amin, amax = attr_map.min(), attr_map.max()
        if amax > amin:
            attr_map = (attr_map - amin) / (amax - amin)

        return attr_map.astype(np.float32)

    def _generate_with_captum(
        self,
        input_tensor: torch.Tensor,
        target_class: int | None,
    ) -> np.ndarray:
        """Use Facebook's Captum library for optimized IG computation.

        Args:
            input_tensor: Model input tensor.
            target_class: Target class index.

        Returns:
            Attribution map as numpy array.
        """
        from captum.attr import IntegratedGradients as CaptumIG

        ig = CaptumIG(self.model)
        baseline = self._create_baseline(input_tensor)

        if target_class is None:
            with torch.no_grad():
                output = self.model(input_tensor)
                target_class = output.argmax(dim=1).item()

        attributions = ig.attribute(
            input_tensor,
            baselines=baseline,
            target=target_class,
            n_steps=self.n_steps,
            return_convergence_delta=False,
        )

        attr_map = attributions.squeeze(0).abs()
        if attr_map.ndim > 3:
            attr_map = attr_map.mean(dim=0)

        attr_map = attr_map.detach().cpu().numpy()

        amin, amax = attr_map.min(), attr_map.max()
        if amax > amin:
            attr_map = (attr_map - amin) / (amax - amin)

        return attr_map.astype(np.float32)
