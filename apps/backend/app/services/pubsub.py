"""
Pub/Sub Service — Publish messages to trigger async pipeline stages.

Each pipeline stage publishes to the next topic:
  dicom-uploaded → preprocessing-done → inference-done → results-ready
"""

import json
import structlog
from google.cloud import pubsub_v1

logger = structlog.get_logger()


class PubSubService:
    """Google Cloud Pub/Sub publisher for pipeline orchestration."""

    def __init__(self, config: dict):
        """Initialize Pub/Sub publisher client.

        Args:
            config: Application configuration with GCP project ID and topic names.
        """
        self._project_id = config["GCP_PROJECT_ID"]
        self._publisher = pubsub_v1.PublisherClient()

    def _topic_path(self, topic_name: str) -> str:
        """Build full topic path from short name.

        Args:
            topic_name: Short topic name (e.g., 'dicom-uploaded').

        Returns:
            Full topic path (e.g., 'projects/mipaas-dev/topics/dicom-uploaded').
        """
        return self._publisher.topic_path(self._project_id, topic_name)

    def publish(
        self,
        topic: str,
        message: dict,
        ordering_key: str | None = None,
        **attributes: str,
    ) -> str:
        """Publish a message to a Pub/Sub topic.

        Args:
            topic: Short topic name.
            message: Message payload (will be JSON-serialized).
            ordering_key: Optional ordering key for ordered delivery.
            **attributes: Additional message attributes.

        Returns:
            Published message ID.
        """
        topic_path = self._topic_path(topic)
        data = json.dumps(message).encode("utf-8")

        # Add job_id as an attribute for filtering
        if "job_id" in message:
            attributes["job_id"] = message["job_id"]
        if "disease_id" in message:
            attributes["disease_id"] = message["disease_id"]

        future = self._publisher.publish(
            topic_path,
            data=data,
            ordering_key=ordering_key or "",
            **attributes,
        )
        message_id = future.result()

        logger.info(
            "pubsub_published",
            topic=topic,
            message_id=message_id,
            job_id=message.get("job_id"),
            attributes=attributes,
        )

        return message_id

    def publish_preprocessing_done(self, job_id: str, disease_id: str, model_name: str) -> str:
        """Convenience method: signal preprocessing is complete.

        Args:
            job_id: The processing job ID.
            disease_id: Disease identifier.
            model_name: Model to use for inference.

        Returns:
            Published message ID.
        """
        return self.publish(
            topic="preprocessing-done",
            message={
                "job_id": job_id,
                "disease_id": disease_id,
                "model_name": model_name,
                "stage": "preprocessing",
                "status": "complete",
            },
        )

    def publish_inference_done(
        self,
        job_id: str,
        disease_id: str,
        model_name: str,
        xai_config: dict | None = None,
    ) -> str:
        """Convenience method: signal inference is complete, trigger XAI + segmentation.

        Args:
            job_id: The processing job ID.
            disease_id: Disease identifier.
            model_name: Model used for inference.
            xai_config: XAI configuration from disease YAML.

        Returns:
            Published message ID.
        """
        return self.publish(
            topic="inference-done",
            message={
                "job_id": job_id,
                "disease_id": disease_id,
                "model_name": model_name,
                "stage": "inference",
                "status": "complete",
                "xai_config": xai_config or {},
            },
        )

    def publish_results_ready(self, job_id: str, stage: str) -> str:
        """Convenience method: signal final results are available.

        Args:
            job_id: The processing job ID.
            stage: Which stage completed ('xai' or 'segmentation').

        Returns:
            Published message ID.
        """
        return self.publish(
            topic="results-ready",
            message={
                "job_id": job_id,
                "stage": stage,
                "status": "complete",
            },
        )
