"""
Base Worker — Shared Pub/Sub consumer logic for all pipeline workers.

Each worker is a Flask app that receives Pub/Sub push messages as HTTP
POST requests. Cloud Run automatically scales workers based on message
volume and scales to zero when idle.
"""

import json
import base64
import traceback
from abc import ABC, abstractmethod

import structlog
from flask import Flask, request, jsonify

from app.config import BaseConfig
from app.services.firestore import FirestoreService
from app.services.storage import StorageService
from app.services.pubsub import PubSubService
from app.services.registry import ModelRegistry

logger = structlog.get_logger()


class BaseWorker(ABC):
    """Abstract base class for pipeline workers.

    Each worker:
    1. Receives a Pub/Sub push message (HTTP POST from Cloud Run)
    2. Parses the message payload
    3. Loads disease-specific configuration
    4. Executes the processing logic
    5. Publishes to the next pipeline stage
    6. Updates job status in Firestore
    """

    def __init__(self, worker_name: str):
        """Initialize the worker.

        Args:
            worker_name: Human-readable worker name for logging.
        """
        self.worker_name = worker_name
        self.app = Flask(__name__)
        self._setup_routes()

        # Services (initialized per-request to use correct config)
        self._config = BaseConfig()

    def _setup_routes(self) -> None:
        """Register the Pub/Sub push endpoint."""

        @self.app.route("/", methods=["POST"])
        def handle_pubsub_push():
            """Handle incoming Pub/Sub push message."""
            return self._handle_message()

        @self.app.route("/health", methods=["GET"])
        def health():
            return jsonify({"status": "healthy", "worker": self.worker_name}), 200

    def _handle_message(self):
        """Parse and process a Pub/Sub push message."""
        envelope = request.get_json()
        if not envelope:
            return "Bad Request: no message", 400

        # Extract message from Pub/Sub envelope
        pubsub_message = envelope.get("message", {})
        if not pubsub_message:
            return "Bad Request: no message in envelope", 400

        # Decode message data
        try:
            data_bytes = base64.b64decode(pubsub_message.get("data", ""))
            message_data = json.loads(data_bytes.decode("utf-8"))
        except (json.JSONDecodeError, ValueError) as e:
            logger.error("message_decode_error", error=str(e))
            return "Bad Request: invalid message data", 400

        job_id = message_data.get("job_id")
        disease_id = message_data.get("disease_id")

        logger.info(
            "message_received",
            worker=self.worker_name,
            job_id=job_id,
            disease_id=disease_id,
        )

        # Initialize services
        config = self.app.config
        config.from_object(BaseConfig)
        firestore = FirestoreService(config)
        storage = StorageService(config)
        pubsub = PubSubService(config)
        registry = ModelRegistry(config.get("DISEASE_CONFIG_DIR", "config/diseases"))

        try:
            # Execute worker-specific processing
            self.process(
                message=message_data,
                firestore=firestore,
                storage=storage,
                pubsub=pubsub,
                registry=registry,
            )

            logger.info(
                "processing_complete",
                worker=self.worker_name,
                job_id=job_id,
            )
            return "OK", 200

        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "processing_failed",
                worker=self.worker_name,
                job_id=job_id,
                error=str(e),
                traceback=tb,
            )

            # Record error in Firestore
            if job_id:
                firestore.update_job_error(
                    job_id=job_id,
                    stage=self.worker_name,
                    message=str(e),
                    traceback=tb,
                )

            # Return 200 to prevent Pub/Sub retries for non-retryable errors
            # Return 500 for retryable errors (Pub/Sub will retry with backoff)
            if self._is_retryable_error(e):
                return f"Retryable error: {str(e)}", 500
            return "OK", 200

    def _is_retryable_error(self, error: Exception) -> bool:
        """Determine if an error should trigger a Pub/Sub retry.

        Override in subclasses for custom retry logic.

        Args:
            error: The exception that occurred.

        Returns:
            True if the error is retryable (e.g., transient GCS/network error).
        """
        retryable_types = (
            ConnectionError,
            TimeoutError,
            OSError,
        )
        return isinstance(error, retryable_types)

    @abstractmethod
    def process(
        self,
        message: dict,
        firestore: FirestoreService,
        storage: StorageService,
        pubsub: PubSubService,
        registry: ModelRegistry,
    ) -> None:
        """Execute the worker's processing logic.

        Args:
            message: Decoded Pub/Sub message payload.
            firestore: Firestore service for status updates.
            storage: GCS service for data I/O.
            pubsub: Pub/Sub service for publishing to next stage.
            registry: Model registry for disease/model configs.
        """
        raise NotImplementedError

    def run(self, **kwargs) -> None:
        """Run the worker Flask app (for local development).

        Args:
            **kwargs: Passed to Flask.run().
        """
        self.app.run(**kwargs)
