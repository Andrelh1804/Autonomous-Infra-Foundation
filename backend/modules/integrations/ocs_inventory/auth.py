"""
Credential encryption/decryption for OCS integration.
Uses base64 + a derived key from SECRET_KEY for basic symmetric protection.
In production, replace with Fernet or a KMS.
"""
import os
import base64
import hashlib

_SECRET = os.environ.get("SECRET_KEY", "aii-platform-secret-key")


def _derive_key(length: int = 32) -> bytes:
    return hashlib.sha256(_SECRET.encode()).digest()[:length]


def encrypt_secret(plain: str) -> str:
    if not plain:
        return ""
    key = _derive_key()
    xor = bytes(b ^ key[i % len(key)] for i, b in enumerate(plain.encode()))
    return base64.urlsafe_b64encode(xor).decode()


def decrypt_secret(enc: str) -> str:
    if not enc:
        return ""
    key = _derive_key()
    raw = base64.urlsafe_b64decode(enc.encode())
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(raw)).decode()


def mask_secret(plain: str) -> str:
    if not plain or len(plain) <= 4:
        return "****"
    return plain[:2] + "*" * (len(plain) - 4) + plain[-2:]
