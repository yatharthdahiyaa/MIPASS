"""
Inference Worker — Model-agnostic inference pipeline.

Uses the adapter pattern to run ANY registered pre-trained model.
The adapter is resolved from the disease YAML config, model weights
are cached in /tmp to avoid re-downloading on warm Cloud Run instances.
"""

import io
import os
import json
import tempfile
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

# Model weight cache directory (persists across warm Cloud Run instances)
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/tmp/model_cache")


class InferenceWorker(BaseWorker):
    """Model-agnostic inference pipeline worker.

    Steps:
    1. Resolve model adapter from disease config
    2. Download model weights (with caching)
    3. Load preprocessed volume from GCS
    4. Run model-specific prediction
    5. Save predictions + feature maps to GCS
    6. Publish inference-done event
    """

    def __init__(self):
        super().__init__(worker_name="inference")
        os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

    def process(
        self,
        message: dict,
        firestore: FirestoreService,
        storage: StorageService,
        pubsub: PubSubService,
        registry: ModelRegistry,
    ) -> None:
        """Execute model inference."""
        job_id = message["job_id"]
        disease_id = message["disease_id"]
        model_name = message["model_name"]

        firestore.update_job_status(job_id, "inference")

        # 1. Get model config from registry
        model_config = registry.get_model_config(disease_id, model_name)
        if not model_config:
            raise ValueError(f"Model config not found: {disease_id}/{model_name}")

        adapter_name = model_config["adapter"]
        checkpoint_uri = model_config["checkpoint"]
        classes = model_config.get("classes", [])

        logger.info(
            "inference_started",
            job_id=job_id,
            adapter=adapter_name,
            model=model_name,
        )

        # 2. Instantiate adapter
        adapter = get_adapter(adapter_name, classes=classes) if classes else get_adapter(adapter_name)

        # 3. Download model weights (cached)
        checkpoint_path = self._get_cached_checkpoint(storage, checkpoint_uri, model_name)

        # 4. Load model
        adapter.load_model(checkpoint_path)

        # 5. Load preprocessed volume from GCS
        volume_data = storage.download_blob(f"processed/{job_id}/volume.npy")
        if not volume_data:
            raise FileNotFoundError(f"Preprocessed volume not found for job {job_id}")

        volume = np.load(io.BytesIO(volume_data))

        # 6. Model-specific preprocessing (adapter transforms)
        tensor = adapter.preprocess(volume)

        logger.info(
            "running_inference",
            job_id=job_id,
            input_shape=list(tensor.shape),
            device=str(adapter.device),
        )

        # 7. Run inference
        result = adapter.predict(tensor)

        # 8. Save predictions to GCS
        predictions_json = json.dumps(result.to_dict()).encode("utf-8")
        storage.upload_blob(
            blob_path=f"inference/{job_id}/predictions.json",
            data=predictions_json,
            content_type="application/json",
        )

        # 9. Save feature maps for XAI (if available)
        if result.feature_maps is not None:
            buffer = io.BytesIO()
            torch.save(result.feature_maps, buffer)
            storage.upload_blob(
                blob_path=f"inference/{job_id}/feature_maps.pt",
                data=buffer.getvalue(),
            )

        # 10. Save the raw model output for XAI workers
        if result.raw_output is not None:
            buffer = io.BytesIO()
            torch.save({
                "raw_output": result.raw_output,
                "input_tensor": tensor.detach().cpu(),
                "adapter_name": adapter_name,
                "model_name": model_name,
                "checkpoint_uri": checkpoint_uri,
                "classes": classes,
            }, buffer)
            storage.upload_blob(
                blob_path=f"inference/{job_id}/inference_state.pt",
                data=buffer.getvalue(),
            )

        # 11. Update Firestore
        firestore.update_job(job_id, {
            "status": "inference_complete",
            "predictions": result.to_dict(),
        })

        # 12. Publish to XAI + segmentation pipeline
        xai_config = registry.get_xai_config(disease_id)
        seg_config = registry.get_segmentation_config(disease_id)

        pubsub.publish_inference_done(
            job_id=job_id,
            disease_id=disease_id,
            model_name=model_name,
            xai_config=xai_config,
        )

        logger.info(
            "inference_complete",
            job_id=job_id,
            predicted_class=result.predicted_class,
            confidence=result.confidence,
        )

    def _get_cached_checkpoint(
        self,
        storage: StorageService,
        checkpoint_uri: str,
        model_name: str,
    ) -> str:
        """Download model checkpoint with local caching.

        Model weights are cached in /tmp on Cloud Run instances.
        Warm instances reuse cached weights, avoiding re-download.

        Args:
            storage: GCS storage service.
            checkpoint_uri: GCS URI of the checkpoint (gs://bucket/path).
            model_name: Model name for cache key.

        Returns:
            Local file path to the checkpoint.
        """
        # Parse GCS URI
        parts = checkpoint_uri.replace("gs://", "").split("/", 1)
        blob_path = parts[1] if len(parts) > 1 else ""

        # Cache path
        cache_filename = f"{model_name}_{os.path.basename(blob_path)}"
        cache_path = os.path.join(MODEL_CACHE_DIR, cache_filename)

        if os.path.exists(cache_path):
            logger.info("checkpoint_cache_hit", model=model_name, path=cache_path)
            return cache_path

        logger.info(
            "checkpoint_downloading",
            model=model_name,
            uri=checkpoint_uri,
        )

        success = storage.download_blob_to_file(
            blob_path=blob_path,
            local_path=cache_path,
            bucket="models",
        )

        if not success:
            raise FileNotFoundError(f"Model checkpoint not found: {checkpoint_uri}")

        logger.info("checkpoint_cached", model=model_name, path=cache_path)
        return cache_path


# Entry point for Cloud Run
worker = InferenceWorker()
app = worker.app

if __name__ == "__main__":
    worker.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
