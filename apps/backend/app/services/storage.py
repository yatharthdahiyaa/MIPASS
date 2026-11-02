"""
Cloud Storage Service — GCS operations for DICOM data, processed volumes, and results.

Handles signed URL generation, blob upload/download, and lifecycle management.
"""

import datetime
import structlog
from google.cloud import storage
from google.cloud.storage import Blob

logger = structlog.get_logger()


class StorageService:
    """Google Cloud Storage operations for MIPAAS."""

    def __init__(self, config: dict):
        """Initialize storage client.

        Args:
            config: Application configuration dict with GCS bucket names.
        """
        self._client = storage.Client(project=config.get("GCP_PROJECT_ID"))
        self._data_bucket_name = config["GCS_DATA_BUCKET"]
        self._models_bucket_name = config["GCS_MODELS_BUCKET"]
        self._data_bucket = self._client.bucket(self._data_bucket_name)
        """Generate a V4 signed URL for direct upload from the frontend.

        Args:
            blob_path: Object path within the data bucket.
            content_type: MIME type of the upload.
            expiry_minutes: URL expiry time in minutes.
            max_size_bytes: Maximum upload size (enforced by signed URL policy).

        Returns:
            Signed upload URL string.
        """
        blob = self._data_bucket.blob(blob_path)

        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=expiry_minutes),
            method="PUT",
            content_type=content_type,
            headers={
                "x-goog-content-length-range": f"0,{max_size_bytes}",
            },
        )

        logger.info(
            "signed_url_created",
            blob_path=blob_path,
            expiry_minutes=expiry_minutes,
            content_type=content_type,
        )

        return url

    def generate_signed_download_url(
        self,
        blob_path: str,
        expiry_minutes: int = 60,
    ) -> str:
        """Generate a V4 signed URL for downloading a result artifact.

        Args:
            blob_path: Object path within the data bucket.
            expiry_minutes: URL expiry time in minutes.

        Returns:
            Signed download URL string.
        """
        blob = self._data_bucket.blob(blob_path)
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=expiry_minutes),
            method="GET",
        )
        return url

    def upload_blob(
        self,
        blob_path: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        bucket: str = "data",
    ) -> str:
        """Upload data to GCS.

        Args:
            blob_path: Destination object path.
            data: Raw bytes to upload.
            content_type: MIME type.
            bucket: 'data' or 'models' bucket.

        Returns:
            GCS URI (gs://bucket/path).
        """
        target_bucket = self._data_bucket if bucket == "data" else self._models_bucket
        blob = target_bucket.blob(blob_path)
        blob.upload_from_string(data, content_type=content_type)

        gcs_uri = f"gs://{target_bucket.name}/{blob_path}"
        logger.info("blob_uploaded", gcs_uri=gcs_uri, size_bytes=len(data))
        return gcs_uri

    def download_blob(self, blob_path: str, bucket: str = "data") -> bytes | None:
        """Download blob contents from GCS.

        Args:
            blob_path: Object path within the bucket.
            bucket: 'data' or 'models' bucket.

        Returns:
            Raw bytes or None if blob doesn't exist.
        """
        target_bucket = self._data_bucket if bucket == "data" else self._models_bucket
        blob = target_bucket.blob(blob_path)

        if not blob.exists():
            logger.warning("blob_not_found", blob_path=blob_path, bucket=target_bucket.name)
            return None

        return blob.download_as_bytes()

    def download_blob_to_file(
        self,
        blob_path: str,
        local_path: str,
        bucket: str = "data",
    ) -> bool:
        """Download blob to a local file (used by workers for model weights).

        Args:
            blob_path: Object path within the bucket.
            local_path: Local filesystem destination.
            bucket: 'data' or 'models' bucket.

        Returns:
            True if downloaded successfully, False if blob not found.
        """
        target_bucket = self._data_bucket if bucket == "data" else self._models_bucket
        blob = target_bucket.blob(blob_path)

        if not blob.exists():
            logger.warning("blob_not_found", blob_path=blob_path)
            return False

        blob.download_to_filename(local_path)
        logger.info("blob_downloaded", blob_path=blob_path, local_path=local_path)
        return True

    def list_blobs(self, prefix: str, bucket: str = "data") -> list[str]:
        """List blob paths under a prefix.

        Args:
            prefix: GCS prefix to list under.
            bucket: 'data' or 'models' bucket.

        Returns:
            List of blob path strings.
        """
        target_bucket = self._data_bucket if bucket == "data" else self._models_bucket
        blobs = target_bucket.list_blobs(prefix=prefix)
        return [blob.name for blob in blobs]

    def delete_prefix(self, prefix: str, bucket: str = "data") -> int:
        """Delete all blobs under a prefix (used for job cleanup).

        Args:
            prefix: GCS prefix to delete under.
            bucket: 'data' or 'models' bucket.

        Returns:
            Number of blobs deleted.
        """
        target_bucket = self._data_bucket if bucket == "data" else self._models_bucket
        blobs = list(target_bucket.list_blobs(prefix=prefix))
        target_bucket.delete_blobs(blobs)
        logger.info("prefix_deleted", prefix=prefix, count=len(blobs))
        return len(blobs)
