"""
XAI Worker — Explainable AI pipeline.

Computes all configured XAI methods for a completed inference job:
1. Grad-CAM++ (primary) — 3D heatmap of discriminative regions
2. Occlusion Sensitivity (validation) — sensitivity map via systematic occlusion
3. Integrated Gradients (validation) — per-voxel attribution along interpolation path

Each method's output is saved to GCS as numpy arrays and optionally
as PNG overlay images for the DICOM viewer.
"""

import io
import os
import json
import numpy as np
import torch
import torch.nn.functional as F
import structlog

from workers.base_worker import BaseWorker
from workers.adapters.factory import get_adapter
from workers.xai.gradcam_plus import GradCAMPlusPlus
from workers.xai.occlusion import OcclusionSensitivity
from workers.xai.integrated_grads import IntegratedGradients
from workers.xai.overlay_generator import OverlayGenerator
from app.services.firestore import FirestoreService
from app.services.storage import StorageService
from app.services.pubsub import PubSubService
from app.services.registry import ModelRegistry

logger = structlog.get_logger()


class XAIWorker(BaseWorker):
    """Explainable AI pipeline worker.

    Runs all configured XAI methods in sequence for a given job.
    XAI configuration is disease-specific (from YAML config).
    """

    def __init__(self):
        super().__init__(worker_name="xai")

    def process(
        self,
        message: dict,
        firestore: FirestoreService,
        storage: StorageService,
        pubsub: PubSubService,
        registry: ModelRegistry,
    ) -> None:
        """Execute XAI pipeline."""
        job_id = message["job_id"]
        disease_id = message["disease_id"]
        model_name = message["model_name"]
        xai_config = message.get("xai_config", {})

        # If xai_config wasn't in the message, load from registry
        if not xai_config:
            xai_config = registry.get_xai_config(disease_id)

        firestore.update_job_status(job_id, "xai_running")

        logger.info(
            "xai_started",
            job_id=job_id,
            disease_id=disease_id,
            methods=xai_config,
        )

        # Load inference state (model output + input tensor)
        state_data = storage.download_blob(f"inference/{job_id}/inference_state.pt")
        if not state_data:
            raise FileNotFoundError(f"Inference state not found for job {job_id}")

        state = torch.load(io.BytesIO(state_data), map_location="cpu")
        input_tensor = state["input_tensor"]
        adapter_name = state["adapter_name"]
        checkpoint_uri = state["checkpoint_uri"]
        classes = state.get("classes", [])

        # Re-load model via adapter (cached on warm instances)
        adapter = get_adapter(adapter_name, classes=classes) if classes else get_adapter(adapter_name)

        # Download checkpoint (cached)
        from workers.inference.worker import MODEL_CACHE_DIR
        model_name_key = state.get("model_name", model_name)
        blob_path = checkpoint_uri.replace("gs://", "").split("/", 1)[1]
        cache_path = os.path.join(
            MODEL_CACHE_DIR,
            f"{model_name_key}_{os.path.basename(blob_path)}",
        )
        if not os.path.exists(cache_path):
            storage.download_blob_to_file(blob_path, cache_path, bucket="models")

        adapter.load_model(cache_path)
        model = adapter.get_model()
        device = adapter.device
        input_tensor = input_tensor.to(device)

        # Load original volume for overlay generation
        volume_data = storage.download_blob(f"processed/{job_id}/volume.npy")
        original_volume = np.load(io.BytesIO(volume_data)) if volume_data else None

        # ──── 1. Grad-CAM++ (Primary XAI) ────
        try:
            firestore.update_xai_status(job_id, "gradcam", "running")

            target_layer = adapter.get_gradcam_target_layer()
            gradcam = GradCAMPlusPlus(model, target_layer)
            heatmap = gradcam.generate(input_tensor)

            # Save heatmap
            buffer = io.BytesIO()
            np.save(buffer, heatmap)
            storage.upload_blob(
                f"xai/{job_id}/heatmap_gradcam.npy",
                buffer.getvalue(),
            )

            # Generate overlay PNGs for DICOM viewer
            overlay_uris = []
            if original_volume is not None:
                overlay_gen = OverlayGenerator()
                overlays = overlay_gen.generate_overlays(
                    volume=original_volume,
                    heatmap=heatmap,
                    planes=["axial", "coronal", "sagittal"],
                )
                for plane, slice_images in overlays.items():
                    for idx, img_bytes in enumerate(slice_images):
                        path = f"xai/{job_id}/overlays/{plane}_{idx:04d}.png"
                        storage.upload_blob(path, img_bytes, "image/png")
                        overlay_uris.append(path)

            firestore.update_xai_status(
                job_id, "gradcam", "complete",
                gcs_uri=f"xai/{job_id}/heatmap_gradcam.npy",
                overlay_uris=overlay_uris,
            )
            logger.info("gradcam_complete", job_id=job_id)

        except Exception as e:
            logger.error("gradcam_failed", job_id=job_id, error=str(e))
            firestore.update_xai_status(job_id, "gradcam", "failed")

        # ──── 2. Occlusion Sensitivity (Validation XAI) ────
        validation_methods = xai_config.get("validation", [])

        if "occlusion_sensitivity" in validation_methods:
            try:
                firestore.update_xai_status(job_id, "occlusion", "running")

                occ_config = xai_config.get("occlusion", {})
                occlusion = OcclusionSensitivity(
                    model=model,
                    patch_size=occ_config.get("patch_size", [8, 16, 16]),
                    stride=occ_config.get("stride", [4, 8, 8]),
                )
                occ_map = occlusion.generate(input_tensor)

                buffer = io.BytesIO()
                np.save(buffer, occ_map)
                storage.upload_blob(
                    f"xai/{job_id}/occlusion_map.npy",
                    buffer.getvalue(),
                )

                firestore.update_xai_status(
                    job_id, "occlusion", "complete",
                    gcs_uri=f"xai/{job_id}/occlusion_map.npy",
                )
                logger.info("occlusion_complete", job_id=job_id)

            except Exception as e:
                logger.error("occlusion_failed", job_id=job_id, error=str(e))
                firestore.update_xai_status(job_id, "occlusion", "failed")

        # ──── 3. Integrated Gradients (Validation XAI) ────
        if "integrated_gradients" in validation_methods:
            try:
                firestore.update_xai_status(job_id, "integrated_gradients", "running")

                ig_config = xai_config.get("integrated_gradients", {})
                ig = IntegratedGradients(
                    model=model,
                    n_steps=ig_config.get("n_steps", 50),
                    baseline_type=ig_config.get("baseline", "zeros"),
                )
                ig_map = ig.generate(input_tensor)

                buffer = io.BytesIO()
                np.save(buffer, ig_map)
                storage.upload_blob(
                    f"xai/{job_id}/integrated_grads.npy",
                    buffer.getvalue(),
                )

                firestore.update_xai_status(
                    job_id, "integrated_gradients", "complete",
                    gcs_uri=f"xai/{job_id}/integrated_grads.npy",
                )
                logger.info("ig_complete", job_id=job_id)

            except Exception as e:
                logger.error("ig_failed", job_id=job_id, error=str(e))
                firestore.update_xai_status(job_id, "integrated_gradients", "failed")

        # ──── Finalize ────
        firestore.update_job_status(job_id, "xai_complete")
        pubsub.publish_results_ready(job_id, stage="xai")

        logger.info("xai_pipeline_complete", job_id=job_id)


# Entry point for Cloud Run
worker = XAIWorker()
app = worker.app

if __name__ == "__main__":
    worker.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
