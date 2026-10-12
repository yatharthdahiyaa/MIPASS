"""
Overlay Generator — Heatmap to PNG overlay for DICOM viewer.

Converts XAI heatmaps (numpy arrays) into colored PNG overlays
that can be displayed on top of the original DICOM slices in the
frontend viewer.
"""

import io
import numpy as np
from PIL import Image
import matplotlib
import matplotlib.cm as cm


class OverlayGenerator:
    """Generate colored heatmap overlay PNGs for the DICOM viewer."""

    def __init__(
        self,
        colormap: str = "jet",
        alpha: float = 0.4,
        output_size: tuple[int, int] = (512, 512),
    ):
        """Initialize overlay generator.

        Args:
            colormap: Matplotlib colormap name for heatmap coloring.
            alpha: Opacity of the heatmap overlay (0.0–1.0).
            output_size: Output image size (width, height).
        """
        self.colormap = cm.get_cmap(colormap)
        self.alpha = alpha
        self.output_size = output_size

    def generate_overlays(
        self,
        volume: np.ndarray,
        heatmap: np.ndarray,
        planes: list[str] | None = None,
        every_n_slices: int = 1,
    ) -> dict[str, list[bytes]]:
        """Generate overlay PNGs for multiple planes.

        Args:
            volume: Original volume [C, D, H, W] or [D, H, W].
            heatmap: Heatmap array [D, H, W] (values in [0, 1]).
            planes: List of planes to generate ('axial', 'coronal', 'sagittal').
            every_n_slices: Generate every N slices (for memory efficiency).

        Returns:
            Dict mapping plane name to list of PNG bytes.
        """
        planes = planes or ["axial"]

        # Remove channel dim if present
        if volume.ndim == 4:
            volume = volume[0]

        # Ensure heatmap matches volume spatial dims
        if heatmap.shape != volume.shape:
            from scipy.ndimage import zoom
            zoom_factors = [v / h for v, h in zip(volume.shape, heatmap.shape)]
            heatmap = zoom(heatmap, zoom_factors, order=1)

        results = {}

        for plane in planes:
            slices = []
            n_slices = self._get_num_slices(volume, plane)

            for idx in range(0, n_slices, every_n_slices):
                vol_slice = self._extract_slice(volume, plane, idx)
                heat_slice = self._extract_slice(heatmap, plane, idx)
                overlay_png = self._create_overlay_png(vol_slice, heat_slice)
                slices.append(overlay_png)

            results[plane] = slices

        return results

    def generate_single_overlay(
        self,
        slice_image: np.ndarray,
        heatmap_slice: np.ndarray,
    ) -> bytes:
        """Generate a single overlay PNG.

        Args:
            slice_image: 2D grayscale image [H, W].
            heatmap_slice: 2D heatmap [H, W] (values in [0, 1]).

        Returns:
            PNG bytes.
        """
        return self._create_overlay_png(slice_image, heatmap_slice)

    def _get_num_slices(self, volume: np.ndarray, plane: str) -> int:
        """Get number of slices for a given plane."""
        axis_map = {"axial": 0, "coronal": 1, "sagittal": 2}
        return volume.shape[axis_map.get(plane, 0)]

    def _extract_slice(self, volume: np.ndarray, plane: str, idx: int) -> np.ndarray:
        """Extract a 2D slice from a 3D volume."""
        if plane == "axial":
            return volume[idx, :, :]
        elif plane == "coronal":
            return volume[:, idx, :]
        elif plane == "sagittal":
            return volume[:, :, idx]
        else:
            return volume[idx, :, :]

    def _create_overlay_png(
        self,
        image_slice: np.ndarray,
        heatmap_slice: np.ndarray,
    ) -> bytes:
        """Create a colored heatmap overlay on a grayscale slice.

        Args:
            image_slice: 2D grayscale image [H, W].
            heatmap_slice: 2D heatmap [H, W] (values in [0, 1]).

        Returns:
            PNG bytes of the overlay image.
        """
        # Normalize grayscale image to [0, 255]
        img = image_slice - image_slice.min()
        if img.max() > 0:
            img = (img / img.max() * 255).astype(np.uint8)
        else:
            img = img.astype(np.uint8)

        # Convert to RGB
        img_rgb = np.stack([img] * 3, axis=-1)

        # Apply colormap to heatmap
        heatmap_colored = self.colormap(heatmap_slice)[:, :, :3]  # Remove alpha
        heatmap_colored = (heatmap_colored * 255).astype(np.uint8)

        # Blend: overlay = (1-alpha)*image + alpha*heatmap
        overlay = (
            (1 - self.alpha) * img_rgb.astype(np.float32)
            + self.alpha * heatmap_colored.astype(np.float32)
        ).astype(np.uint8)

        # Convert to PIL and save as PNG
        pil_img = Image.fromarray(overlay)
        pil_img = pil_img.resize(self.output_size, Image.LANCZOS)

        buffer = io.BytesIO()
        pil_img.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
