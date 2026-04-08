"""
Steg-Drop — Phase 1: Security & Cryptography Module
AES-256-GCM encryption with PBKDF2 key derivation bound to image metadata.
Supports any file type as payload (text, images, zip, PDF, etc.)
"""

import struct
import hashlib
from io import BytesIO
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from PIL import Image
from PIL.ExifTags import TAGS


# ---------------------------------------------------------------------------
# Payload Serialization — wraps any data with its filename & type
# ---------------------------------------------------------------------------

PAYLOAD_TEXT = 0x01
PAYLOAD_FILE = 0x02


def serialize_payload(data: bytes, filename: str = "", payload_type: int = PAYLOAD_TEXT) -> bytes:
    """
    Pack payload into:
        [type_flag 1B][filename_len 2B][filename UTF-8][data]
    """
    fname_bytes = filename.encode("utf-8") if filename else b""
    header = struct.pack(">BH", payload_type, len(fname_bytes))
    return header + fname_bytes + data


def deserialize_payload(blob: bytes) -> tuple[int, str, bytes]:
    """
    Unpack payload → (type_flag, filename, data_bytes)
    """
    payload_type = struct.unpack(">B", blob[0:1])[0]
    fname_len = struct.unpack(">H", blob[1:3])[0]
    filename = blob[3 : 3 + fname_len].decode("utf-8")
    data = blob[3 + fname_len :]
    return payload_type, filename, data


# (extract_metadata removed as we now use randomly generated salts)


# ---------------------------------------------------------------------------
# Key Derivation — PBKDF2-HMAC-SHA256
# ---------------------------------------------------------------------------


def derive_key(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
    """
    Derives a 256-bit key from the user's password using PBKDF2.
    If salt is None, generates a new random 16-byte salt.
    Returns: (key_bytes, salt_bytes)
    """
    if salt is None:
        salt = get_random_bytes(16)
        
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations=100_000,
        dklen=32,
    )
    return key, salt


# ---------------------------------------------------------------------------
# AES-256-GCM Encryption / Decryption
# ---------------------------------------------------------------------------


def encrypt(plaintext: bytes, key: bytes) -> bytes:
    """
    Encrypt with AES-256-GCM.
    Returns: nonce (12B) + ciphertext + tag (16B)
    """
    nonce = get_random_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return nonce + ciphertext + tag


def decrypt(encrypted: bytes, key: bytes) -> bytes:
    """
    Decrypt AES-256-GCM.
    Expects: nonce (12B) + ciphertext + tag (16B)
    Raises ValueError on tampered data.
    """
    nonce = encrypted[:12]
    tag = encrypted[-16:]
    ciphertext = encrypted[12:-16]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    try:
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
    except (ValueError, KeyError) as e:
        raise ValueError("Decryption failed — wrong password, wrong image, or data tampered.") from e
    return plaintext
