"""
Segmentation Worker — SHAP attribution + lesion mask generation.

Runs in parallel with the XAI worker after inference completes.
Produces:
1. SHAP feature attribution map (DeepSHAP or KernelSHAP)
2. Binary/probabilistic lesion mask with morphological post-processing
3. Lesion measurements (count, volumes in mm³)
"""

import io
import os
import json
import numpy as np
import torch
import structlog

from workers.base_worker import BaseWorker
from workers.adapters.factory import get_adapter
from app.services.firestore import FirestoreService
from app.services.storage import StorageService
from app.services.pubsub import PubSubService
from app.services.registry import ModelRegistry

logger = structlog.get_logger()


class SegmentationWorker(BaseWorker):
    """Segmentation pipeline worker — SHAP + lesion mask."""

    def __init__(self):
        super().__init__(worker_name="segmentation")

    def process(
        self,
        message: dict,
        firestore: FirestoreService,
        storage: StorageService,
        pubsub: PubSubService,
        registry: ModelRegistry,
    ) -> None:
        """Execute segmentation pipeline."""
        job_id = message["job_id"]
        disease_id = message["disease_id"]
        model_name = message["model_name"]

        seg_config = registry.get_segmentation_config(disease_id)
        if not seg_config or not seg_config.get("enabled", False):
            logger.info("segmentation_disabled", job_id=job_id, disease_id=disease_id)
            firestore.update_segmentation_status(job_id, "skipped")
            pubsub.publish_results_ready(job_id, stage="segmentation")
            return

        firestore.update_segmentation_status(job_id, "running")

        # Load inference state
        state_data = storage.download_blob(f"inference/{job_id}/inference_state.pt")
        if not state_data:
            raise FileNotFoundError(f"Inference state not found for job {job_id}")

        state = torch.load(io.BytesIO(state_data), map_location="cpu")
        input_tensor = state["input_tensor"]
        adapter_name = state["adapter_name"]
        checkpoint_uri = state["checkpoint_uri"]
        classes = state.get("classes", [])

        # Re-load model
        adapter = get_adapter(adapter_name, classes=classes) if classes else get_adapter(adapter_name)

        from workers.inference.worker import MODEL_CACHE_DIR
        blob_path = checkpoint_uri.replace("gs://", "").split("/", 1)[1]
        cache_path = os.path.join(
            MODEL_CACHE_DIR,
            f"{model_name}_{os.path.basename(blob_path)}",
        )
        if not os.path.exists(cache_path):
            storage.download_blob_to_file(blob_path, cache_path, bucket="models")

        adapter.load_model(cache_path)
        model = adapter.get_model()

        # ──── 1. SHAP Feature Attribution ────
        shap_values = self._compute_shap(
            model=model,
            input_tensor=input_tensor,
            method=seg_config.get("method", "shap_deepshap"),
        )

        # Save SHAP values
        buffer = io.BytesIO()
        np.save(buffer, shap_values)
        storage.upload_blob(
            f"segmentation/{job_id}/shap_values.npy",
            buffer.getvalue(),
        )

        # ──── 2. Lesion Mask Generation ────
        mask_config = seg_config.get("lesion_mask", {})
        lesion_mask = self._generate_lesion_mask(
            shap_values=shap_values,
            threshold=mask_config.get("threshold", 0.5),
            min_volume_mm3=mask_config.get("min_volume_mm3", 10),
            morphology=mask_config.get("morphology", []),
            kernel_size=mask_config.get("kernel_size", 3),
        )

        # Save lesion mask
        buffer = io.BytesIO()
        np.save(buffer, lesion_mask)
        storage.upload_blob(
            f"segmentation/{job_id}/lesion_mask.npy",
            buffer.getvalue(),
        )

        # ──── 3. Compute Lesion Measurements ────
        measurements = self._measure_lesions(lesion_mask, voxel_spacing=[1.0, 1.0, 1.0])

        # Generate overlay PNGs
        volume_data = storage.download_blob(f"processed/{job_id}/volume.npy")
        if volume_data:
            from workers.xai.overlay_generator import OverlayGenerator
            original_volume = np.load(io.BytesIO(volume_data))
            overlay_gen = OverlayGenerator(colormap="hot", alpha=0.5)
            overlays = overlay_gen.generate_overlays(
                volume=original_volume,
                heatmap=lesion_mask.astype(np.float32),
                planes=["axial"],
            )
            for plane, slice_images in overlays.items():
                for idx, img_bytes in enumerate(slice_images):
                    storage.upload_blob(
                        f"segmentation/{job_id}/overlays/{plane}_{idx:04d}.png",
                        img_bytes,
                        "image/png",
                    )

        # Update Firestore
        firestore.update_segmentation_status(
            job_id,
            "complete",
            lesion_mask_uri=f"segmentation/{job_id}/lesion_mask.npy",
            shap_uri=f"segmentation/{job_id}/shap_values.npy",
            lesion_count=measurements["lesion_count"],
            lesion_volumes_mm3=measurements["lesion_volumes_mm3"],
        )

        pubsub.publish_results_ready(job_id, stage="segmentation")
        logger.info(
            "segmentation_complete",
            job_id=job_id,
            lesion_count=measurements["lesion_count"],
        )

    def _compute_shap(
        self,
        model: torch.nn.Module,
        input_tensor: torch.Tensor,
        method: str = "shap_deepshap",
    ) -> np.ndarray:
        """Compute SHAP feature attribution values.

        Args:
            model: PyTorch model.
            input_tensor: Input tensor.
            method: 'shap_deepshap' or 'shap_kernel'.

        Returns:
            SHAP values as numpy array.
        """
        try:
            if method == "shap_deepshap":
                return self._deep_shap(model, input_tensor)
            else:
                return self._kernel_shap(model, input_tensor)
        except Exception as e:
            logger.warning(
                "shap_fallback",
                error=str(e),
                message="Falling back to gradient-based attribution",
            )
            return self._gradient_attribution(model, input_tensor)

    def _deep_shap(self, model: torch.nn.Module, input_tensor: torch.Tensor) -> np.ndarray:
        """Compute DeepSHAP values using the SHAP library."""
        import shap

        # Create background dataset (baseline)
        background = torch.zeros_like(input_tensor[:1])

        explainer = shap.DeepExplainer(model, background)
        shap_values = explainer.shap_values(input_tensor)

        if isinstance(shap_values, list):
            # Multi-class: take the predicted class
            with torch.no_grad():
                pred_class = model(input_tensor).argmax(dim=1).item()
            shap_values = shap_values[pred_class]

        if isinstance(shap_values, torch.Tensor):
            shap_values = shap_values.cpu().numpy()

        # Reduce to spatial dimensions
        shap_map = np.abs(shap_values).squeeze()
        if shap_map.ndim > 3:
            shap_map = shap_map.mean(axis=0)

        # Normalize
        smax = shap_map.max()
        if smax > 0:
            shap_map = shap_map / smax

        return shap_map.astype(np.float32)

    def _kernel_shap(self, model: torch.nn.Module, input_tensor: torch.Tensor) -> np.ndarray:
        """Compute KernelSHAP (model-agnostic, slower)."""
        import shap

        def predict_fn(x):
            tensor = torch.from_numpy(x).float().to(input_tensor.device)
            tensor = tensor.view(input_tensor.shape)
            with torch.no_grad():
                return model(tensor).cpu().numpy()

        flat_input = input_tensor.cpu().numpy().flatten().reshape(1, -1)
        background = np.zeros_like(flat_input)

        explainer = shap.KernelExplainer(predict_fn, background)
        shap_values = explainer.shap_values(flat_input, nsamples=100)

        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        shap_map = np.abs(shap_values).reshape(input_tensor.shape[2:])
        smax = shap_map.max()
        if smax > 0:
            shap_map = shap_map / smax

        return shap_map.astype(np.float32)

    def _gradient_attribution(
        self,
        model: torch.nn.Module,
        input_tensor: torch.Tensor,
    ) -> np.ndarray:
        """Fallback: simple gradient-based attribution."""
        input_tensor.requires_grad_(True)
        output = model(input_tensor)
        pred_class = output.argmax(dim=1).item()
        target_score = output[0, pred_class]

        model.zero_grad()
        target_score.backward()

        grads = input_tensor.grad.detach().cpu().numpy()
        attr_map = np.abs(grads).squeeze()
        if attr_map.ndim > 3:
            attr_map = attr_map.mean(axis=0)

        amax = attr_map.max()
        if amax > 0:
            attr_map = attr_map / amax

        return attr_map.astype(np.float32)

    def _generate_lesion_mask(
        self,
        shap_values: np.ndarray,
        threshold: float = 0.5,
        min_volume_mm3: float = 10,
        morphology: list[str] | None = None,
        kernel_size: int = 3,
    ) -> np.ndarray:
        """Generate binary lesion mask from SHAP attribution values.

        Args:
            shap_values: SHAP attribution map [D, H, W].
            threshold: Binarization threshold.
            min_volume_mm3: Minimum lesion volume to keep.
            morphology: Morphological operations to apply.
            kernel_size: Kernel size for morphological operations.

        Returns:
            Binary lesion mask [D, H, W].
        """
        from scipy import ndimage
        from skimage.morphology import ball, disk

        # Threshold
        mask = (shap_values >= threshold).astype(np.uint8)

        # Morphological operations
        morphology = morphology or []
        if mask.ndim == 3:
            struct = ball(kernel_size // 2)
        else:
            struct = disk(kernel_size // 2)

        for op in morphology:
            if op == "opening":
                mask = ndimage.binary_opening(mask, structure=struct).astype(np.uint8)
            elif op == "closing":
                mask = ndimage.binary_closing(mask, structure=struct).astype(np.uint8)
            elif op == "dilation":
                mask = ndimage.binary_dilation(mask, structure=struct).astype(np.uint8)
            elif op == "erosion":
                mask = ndimage.binary_erosion(mask, structure=struct).astype(np.uint8)

        # Remove small components
        labeled, num_features = ndimage.label(mask)
        for i in range(1, num_features + 1):
            component = labeled == i
            volume_voxels = component.sum()
            if volume_voxels < min_volume_mm3:
                mask[component] = 0

        return mask

    def _measure_lesions(
        self,
        mask: np.ndarray,
        voxel_spacing: list[float] | None = None,
    ) -> dict:
        """Measure lesion count and volumes from the binary mask.

        Args:
            mask: Binary lesion mask.
            voxel_spacing: Voxel size in mm [d, h, w].

        Returns:
            Dict with lesion_count and lesion_volumes_mm3.
        """
        from scipy import ndimage

        voxel_spacing = voxel_spacing or [1.0, 1.0, 1.0]
        voxel_volume_mm3 = np.prod(voxel_spacing)

        labeled, num_features = ndimage.label(mask)

        volumes = []
        for i in range(1, num_features + 1):
            voxel_count = (labeled == i).sum()
            volume_mm3 = float(voxel_count * voxel_volume_mm3)
            volumes.append(round(volume_mm3, 2))

        return {
            "lesion_count": num_features,
            "lesion_volumes_mm3": sorted(volumes, reverse=True),
        }


# Entry point for Cloud Run
worker = SegmentationWorker()
app = worker.app

if __name__ == "__main__":
    worker.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
