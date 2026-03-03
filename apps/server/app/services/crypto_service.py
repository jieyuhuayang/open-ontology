"""Symmetric encryption service using Fernet (AES-256)."""

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.exceptions import AppError


class CryptoService:
    def __init__(self) -> None:
        key = settings.ENCRYPTION_KEY
        if not key:
            # Auto-generate for development; production must set ENCRYPTION_KEY
            key = Fernet.generate_key().decode()
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
