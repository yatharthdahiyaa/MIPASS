"""
Occlusion Sensitivity — Systematic region occlusion for model interpretation.

Slides an occluding patch across the input volume, measuring how the
model's confidence drops when each region is occluded. High sensitivity
regions are critical for the model's prediction.

Reference: Zeiler & Fergus, "Visualizing and Understanding Convolutional
Networks" (2014)
"""

import numpy as np
import torch
import torch.nn as nn
from itertools import product


class OcclusionSensitivity:
    """Occlusion sensitivity analysis for 3D/2D medical imaging models.

    Systematically occludes patches of the input and records
    the change in model output confidence.
    """

    def __init__(
        self,
        model: nn.Module,
        patch_size: list[int] | None = None,
        stride: list[int] | None = None,
        occlude_value: float = 0.0,
    ):
        """Initialize occlusion sensitivity.

        Args:
            model: The neural network model.
            patch_size: Size of the occluding patch [d, h, w] or [h, w].
            stride: Stride for sliding the patch.
            occlude_value: Value to fill the occluded region (default: 0).
        """
        self.model = model
        self.patch_size = patch_size or [8, 16, 16]
        self.stride = stride or [4, 8, 8]
        self.occlude_value = occlude_value

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class: int | None = None,
    ) -> np.ndarray:
        """Generate occlusion sensitivity map.

        Args:
            input_tensor: Model input [B, C, D, H, W] or [B, C, H, W].
            target_class: Target class index. If None, uses predicted class.

        Returns:
            Sensitivity map as numpy array (same spatial dims as input).
        """
        self.model.eval()
        device = input_tensor.device
        spatial_dims = input_tensor.shape[2:]
        ndim = len(spatial_dims)

        # Adjust patch/stride dimensions to match input
        patch_size = self.patch_size[:ndim]
        stride = self.stride[:ndim]

        # Get baseline prediction
        with torch.no_grad():
            baseline_output = self.model(input_tensor)
            if target_class is None:
                target_class = baseline_output.argmax(dim=1).item()
            baseline_score = torch.softmax(baseline_output, dim=1)[0, target_class].item()

        # Generate patch positions
        ranges = []
        for dim_size, p_size, s in zip(spatial_dims, patch_size, stride):
            positions = list(range(0, dim_size - p_size + 1, s))
            if positions[-1] + p_size < dim_size:
                positions.append(dim_size - p_size)
            ranges.append(positions)

        # Initialize sensitivity map
        sensitivity_map = np.zeros(spatial_dims, dtype=np.float32)
        count_map = np.zeros(spatial_dims, dtype=np.float32)

        # Slide occluding patch
        total_patches = 1
        for r in ranges:
            total_patches *= len(r)

        for i, position in enumerate(product(*ranges)):
            # Create occluded input
            occluded = input_tensor.clone()

            # Build slicing tuple for the patch
            slices = [slice(None), slice(None)]  # batch, channel
            for pos, p_size in zip(position, patch_size):
                slices.append(slice(pos, pos + p_size))

            occluded[tuple(slices)] = self.occlude_value

            # Get prediction on occluded input
            with torch.no_grad():
                occluded_output = self.model(occluded)
                occluded_score = torch.softmax(occluded_output, dim=1)[0, target_class].item()

            # Sensitivity = drop in confidence when region is occluded
            sensitivity = baseline_score - occluded_score

            # Accumulate into sensitivity map
            spatial_slices = tuple(
                slice(pos, pos + p_size)
                for pos, p_size in zip(position, patch_size)
            )
            sensitivity_map[spatial_slices] += sensitivity
            count_map[spatial_slices] += 1

            if (i + 1) % 100 == 0:
                import structlog
                structlog.get_logger().info(
                    "occlusion_progress",
                    patches_done=i + 1,
                    total=total_patches,
                    pct=f"{(i + 1) / total_patches * 100:.1f}%",
                )

        # Average overlapping regions
        count_map[count_map == 0] = 1
        sensitivity_map /= count_map

        # Normalize to [0, 1]
        smin, smax = sensitivity_map.min(), sensitivity_map.max()
        if smax > smin:
            sensitivity_map = (sensitivity_map - smin) / (smax - smin)

        return sensitivity_map.astype(np.float32)
