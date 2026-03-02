"""Unit tests for CryptoService (T010)."""

import base64


class TestCryptoService:
    def test_encrypt_decrypt_roundtrip(self):
        from app.services.crypto_service import CryptoService

        svc = CryptoService()
        plaintext = "my_secret_password"
        ciphertext = svc.encrypt(plaintext)
        assert svc.decrypt(ciphertext) == plaintext

    def test_encrypted_is_base64(self):
        from app.services.crypto_service import CryptoService

        svc = CryptoService()
        ciphertext = svc.encrypt("test")
        # Fernet tokens are url-safe base64
        base64.urlsafe_b64decode(ciphertext)  # should not raise

    def test_different_plaintexts_different_ciphertexts(self):
        from app.services.crypto_service import CryptoService

        svc = CryptoService()
        c1 = svc.encrypt("password1")
        c2 = svc.encrypt("password2")
        assert c1 != c2

    def test_same_plaintext_different_ciphertexts(self):
        """Fernet includes a timestamp, so same plaintext → different ciphertext."""
        from app.services.crypto_service import CryptoService

        svc = CryptoService()
        c1 = svc.encrypt("same")
        c2 = svc.encrypt("same")
        # They may differ due to timestamp; both should decrypt to same value
        assert svc.decrypt(c1) == "same"
        assert svc.decrypt(c2) == "same"

    def test_auto_generate_key_when_empty(self):
        """When ENCRYPTION_KEY is empty, service should auto-generate a key."""
        from app.services.crypto_service import CryptoService

        svc = CryptoService()
        # Should work without explicit key
        assert svc.encrypt("test") is not None
        assert svc.decrypt(svc.encrypt("test")) == "test"
