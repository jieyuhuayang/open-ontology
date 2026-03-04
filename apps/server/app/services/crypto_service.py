"""Symmetric encryption service using Fernet (AES-256)."""

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.exceptions import AppError

logger = logging.getLogger(__name__)

# Module-level singleton to ensure stable encryption key across requests
_instance: "CryptoService | None" = None
_dev_key: str | None = None


class CryptoService:
    def __init__(self) -> None:
        global _dev_key
        key = settings.ENCRYPTION_KEY
        if not key:
            # Auto-generate for development; cache so all instances share the same key
            if _dev_key is None:
                _dev_key = Fernet.generate_key().decode()
                logger.warning("ENCRYPTION_KEY not set — using auto-generated dev key")
            key = _dev_key
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken:
            raise AppError(
                code="ENCRYPTION_KEY_MISMATCH",
                message="Cannot decrypt credential. Encryption key has changed. Please delete this connection and create a new one.",
                status_code=422,
            )


def get_crypto_service() -> CryptoService:
    """Return module-level singleton CryptoService."""
    global _instance
    if _instance is None:
        _instance = CryptoService()
    return _instance
