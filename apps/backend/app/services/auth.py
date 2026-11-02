"""
Auth Service — Token verification for incoming requests.

Verifies Firebase ID tokens or Google OAuth2 tokens from the frontend
using Workload Identity Federation.
"""

import structlog
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

logger = structlog.get_logger()


class AuthService:
    """Authentication and authorization service."""

    def __init__(self, config: dict):
        """Initialize auth service.

        Args:
            config: Application configuration with GCP project ID.
        """
        self._project_id = config.get("GCP_PROJECT_ID")

    def verify_token(self, token: str) -> dict | None:
        """Verify a bearer token (Firebase ID token or Google OAuth2).

        Args:
            token: Bearer token string.

        Returns:
            Decoded token claims dict, or None if invalid.
        """
        try:
            # Verify as Google ID token
            claims = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=self._project_id,
            )
            logger.info(
                "token_verified",
                sub=claims.get("sub"),
                email=claims.get("email"),
            )
            return claims

        except ValueError as e:
            logger.warning("token_verification_failed", error=str(e))
            return None

    def get_user_id_from_token(self, token: str) -> str | None:
        """Extract user ID from a verified token.

        Args:
            token: Bearer token string.

        Returns:
            User ID string or None if token is invalid.
        """
        claims = self.verify_token(token)
        if not claims:
            return None
        return claims.get("sub")
