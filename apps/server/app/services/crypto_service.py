"""Symmetric encryption service using Fernet (AES-256)."""

from cryptography.fernet import Fernet

from app.config import settings


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
        return self._fernet.decrypt(ciphertext.encode()).decode()
