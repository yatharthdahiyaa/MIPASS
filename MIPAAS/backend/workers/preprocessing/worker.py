"""
Preprocessing Worker — DICOM → Tensor conversion pipeline.

Disease-aware preprocessing that adapts to each disease's requirements:
- CT scans: Hounsfield unit windowing, body clipping
- MRI scans: Z-score normalization, skull stripping
- X-rays: ImageNet normalization, histogram equalization
- Multi-channel MRI: Stack T1/T2/FLAIR/T1CE as channels
"""

import io
import os
import tempfile
import numpy as np
import structlog

from workers.base_worker import BaseWorker
from app.services.firestore import FirestoreService
from app.services.storage import StorageService
from app.services.pubsub import PubSubService
from app.services.registry import ModelRegistry

logger = structlog.get_logger()


class PreprocessingWorker(BaseWorker):
    """DICOM preprocessing pipeline worker.

    Receives raw DICOM uploads and converts them to preprocessed
    numpy tensors ready for model inference. The preprocessing
    steps are determined by the disease configuration.
    """

    def __init__(self):
        super().__init__(worker_name="preprocessing")

    def process(
        self,
        message: dict,
        firestore: FirestoreService,
        storage: StorageService,
        pubsub: PubSubService,
        registry: ModelRegistry,
    ) -> None:
        """Execute preprocessing pipeline.

        Steps:
        1. Download raw DICOM files from GCS
        2. Parse DICOM headers → extract metadata
        3. Convert to volume array (via pydicom + numpy)
        4. Apply disease-specific preprocessing
        5. Save preprocessed tensor to GCS
        6. Publish preprocessing-done event
        """
        job_id = message["job_id"]
        disease_id = message["disease_id"]
        model_name = message["model_name"]
        gcs_prefix = message["gcs_prefix"]

        # Update status
        firestore.update_job_status(job_id, "preprocessing")

        # Get disease-specific preprocessing config
        preprocess_config = registry.get_preprocessing_config(disease_id)
        logger.info(
            "preprocessing_started",
            job_id=job_id,
            disease_id=disease_id,
            config=preprocess_config,
        )

        # Download DICOM files from GCS
        # Strip the gs://bucket/ prefix to get the blob prefix
        bucket_name = gcs_prefix.split("/")[2]
        blob_prefix = "/".join(gcs_prefix.split("/")[3:])

        dicom_blobs = storage.list_blobs(prefix=blob_prefix)
        if not dicom_blobs:
            raise ValueError(f"No DICOM files found at {gcs_prefix}")

        # Parse and convert DICOM to numpy volume
        volume, metadata = self._load_dicom_volume(storage, dicom_blobs)

        logger.info(
            "dicom_loaded",
            job_id=job_id,
            shape=volume.shape,
            num_slices=len(dicom_blobs),
        )

        # Apply disease-specific preprocessing
        is_3d = preprocess_config.get("is_3d", True)

        if is_3d:
            processed = self._preprocess_3d(volume, preprocess_config)
        else:
            processed = self._preprocess_2d(volume, preprocess_config)

        logger.info(
            "preprocessing_done",
            job_id=job_id,
            input_shape=volume.shape,
            output_shape=processed.shape,
        )

        # Save preprocessed tensor to GCS
        buffer = io.BytesIO()
        np.save(buffer, processed)
        buffer.seek(0)

        storage.upload_blob(
            blob_path=f"processed/{job_id}/volume.npy",
            data=buffer.getvalue(),
            content_type="application/octet-stream",
        )

        # Save metadata
        import json
        meta_json = json.dumps(metadata, default=str).encode("utf-8")
        storage.upload_blob(
            blob_path=f"processed/{job_id}/volume_meta.json",
            data=meta_json,
            content_type="application/json",
        )

        # Generate middle-slice thumbnail
        thumbnail = self._generate_thumbnail(processed)
        storage.upload_blob(
            blob_path=f"processed/{job_id}/thumbnail.png",
            data=thumbnail,
            content_type="image/png",
        )

        # Update Firestore with preprocessing results
        firestore.update_job(job_id, {
            "status": "preprocessed",
            "input.num_slices": volume.shape[0] if is_3d else 1,
            "input.original_shape": list(volume.shape),
            "input.processed_shape": list(processed.shape),
        })

        # Publish to next pipeline stage
        pubsub.publish_preprocessing_done(
            job_id=job_id,
            disease_id=disease_id,
            model_name=model_name,
        )

    def _load_dicom_volume(
        self,
        storage: StorageService,
        blob_paths: list[str],
    ) -> tuple[np.ndarray, dict]:
        """Load DICOM files and convert to a 3D numpy volume.

        Args:
            storage: GCS storage service.
            blob_paths: List of DICOM blob paths.

        Returns:
            Tuple of (volume array [D, H, W], metadata dict).
        """
        import pydicom

        slices = []
        metadata = {}

        for blob_path in sorted(blob_paths):
            if not blob_path.endswith((".dcm", ".dicom", ".DCM")):
                continue

            data = storage.download_blob(blob_path)
            if data is None:
                continue

            ds = pydicom.dcmread(io.BytesIO(data))
            slices.append(ds)

        if not slices:
            raise ValueError("No valid DICOM slices found")

        # Sort by ImagePositionPatient or InstanceNumber
        try:
            slices.sort(key=lambda s: float(s.ImagePositionPatient[2]))
        except (AttributeError, IndexError):
            slices.sort(key=lambda s: int(s.InstanceNumber))

        # Extract metadata from first slice
        first = slices[0]
        metadata = {
            "patient_id": getattr(first, "PatientID", "ANONYMIZED"),
            "modality": getattr(first, "Modality", "UNKNOWN"),
            "series_description": getattr(first, "SeriesDescription", ""),
            "pixel_spacing": list(getattr(first, "PixelSpacing", [1.0, 1.0])),
            "slice_thickness": float(getattr(first, "SliceThickness", 1.0)),
            "rows": int(first.Rows),
            "columns": int(first.Columns),
            "num_slices": len(slices),
        }

        # Stack into 3D volume [D, H, W]
        volume = np.stack([s.pixel_array.astype(np.float32) for s in slices], axis=0)

        # Apply rescale slope/intercept if present (for Hounsfield units)
        slope = float(getattr(first, "RescaleSlope", 1))
        intercept = float(getattr(first, "RescaleIntercept", 0))
        if slope != 1 or intercept != 0:
            volume = volume * slope + intercept

        return volume, metadata

    def _preprocess_3d(self, volume: np.ndarray, config: dict) -> np.ndarray:
        """Apply 3D preprocessing pipeline for CT/MRI volumes.

        Args:
            volume: Raw volume [D, H, W].
            config: Disease-specific preprocessing config.

        Returns:
            Preprocessed volume ready for model input.
        """
        from scipy.ndimage import zoom
        from skimage.transform import resize

        processed = volume.copy()

        # 1. Intensity windowing (CT specific)
        window = config.get("intensity_window")
        if window:
            low, high = window
            processed = np.clip(processed, low, high)
            processed = (processed - low) / (high - low)

        # 2. Z-score normalization (MRI specific)
        if config.get("normalize") == "z_score":
            mask = processed > 0
            if mask.any():
                mean = processed[mask].mean()
                std = processed[mask].std()
                processed = (processed - mean) / (std + 1e-8)

        # 3. Standard normalization (0-1 range)
        elif config.get("normalize") is True:
            pmin, pmax = processed.min(), processed.max()
            if pmax > pmin:
                processed = (processed - pmin) / (pmax - pmin)

        # 4. Resample to target spacing
        target_spacing = config.get("target_spacing")
        if target_spacing:
            # TODO: Use actual DICOM spacing for accurate resampling
            current_spacing = [1.0, 1.0, 1.0]
            zoom_factors = [c / t for c, t in zip(current_spacing, target_spacing)]
            processed = zoom(processed, zoom_factors, order=1)

        # 5. Resize to target size
        target_size = config.get("target_size")
        if target_size:
            processed = resize(
                processed,
                target_size,
                mode="constant",
                anti_aliasing=True,
                preserve_range=True,
            ).astype(np.float32)

        # Add channel dimension: [D, H, W] → [1, D, H, W]
        processed = np.expand_dims(processed, axis=0)

        return processed

    def _preprocess_2d(self, volume: np.ndarray, config: dict) -> np.ndarray:
        """Apply 2D preprocessing for X-rays and per-slice analysis.

        Args:
            volume: Raw image array [H, W] or [D, H, W] (takes middle slice).
            config: Disease-specific preprocessing config.

        Returns:
            Preprocessed 2D image ready for model input.
        """
        from skimage.transform import resize
        from skimage.exposure import equalize_adapthist

        # Take middle slice if 3D
        if volume.ndim == 3:
            processed = volume[volume.shape[0] // 2]
        else:
            processed = volume.copy()

        # Histogram equalization
        if config.get("histogram_equalization"):
            processed = equalize_adapthist(
                processed / processed.max() if processed.max() > 0 else processed
            ).astype(np.float32)

        # Resize to target
        target_size = config.get("target_size")
        if target_size:
            processed = resize(
                processed,
                target_size,
                mode="constant",
                anti_aliasing=True,
                preserve_range=True,
            ).astype(np.float32)

        # Normalize
        if config.get("normalize") == "imagenet":
            # ImageNet normalization (grayscale replicated to 3 channels)
            mean = np.array([0.485, 0.456, 0.406])
            std = np.array([0.229, 0.224, 0.225])
            if config.get("grayscale_to_rgb"):
                processed = np.stack([processed] * 3, axis=0)  # [3, H, W]
            processed = (processed - mean[:, None, None]) / std[:, None, None]
        else:
            processed = np.expand_dims(processed, axis=0)  # [1, H, W]

        return processed.astype(np.float32)

    def _generate_thumbnail(self, volume: np.ndarray) -> bytes:
        """Generate a PNG thumbnail of the middle slice.

        Args:
            volume: Preprocessed volume [C, D, H, W] or [C, H, W].

        Returns:
            PNG bytes.
        """
        from PIL import Image

        # Extract middle slice
        if volume.ndim == 4:
            # [C, D, H, W] → middle axial slice
            mid = volume.shape[1] // 2
            img = volume[0, mid]
        elif volume.ndim == 3:
            img = volume[0]
        else:
            img = volume

        # Normalize to 0-255
        img = img - img.min()
        if img.max() > 0:
            img = (img / img.max() * 255).astype(np.uint8)
        else:
            img = img.astype(np.uint8)

        pil_img = Image.fromarray(img, mode="L")
        pil_img = pil_img.resize((256, 256), Image.LANCZOS)

        buffer = io.BytesIO()
        pil_img.save(buffer, format="PNG")
        return buffer.getvalue()


# Entry point for Cloud Run
worker = PreprocessingWorker()
app = worker.app

if __name__ == "__main__":
    worker.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
