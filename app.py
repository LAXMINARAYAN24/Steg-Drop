"""
Steg-Drop — Phase 3: FastAPI Web Server
Zero-knowledge steganography service: all processing in RAM, nothing saved to disk.
"""

import os
import time
import base64
import hashlib
from io import BytesIO
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from crypto import (
    serialize_payload,
    deserialize_payload,
    derive_key,
    encrypt,
    decrypt,
    PAYLOAD_TEXT,
    PAYLOAD_FILE,
)
from stego import encode, decode, get_capacity

import numpy as np
from PIL import Image

app = FastAPI(title="Steg-Drop", version="1.0.0")


# ---------------------------------------------------------------------------
# Serve the frontend
# ---------------------------------------------------------------------------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ---------------------------------------------------------------------------
# POST /encode — hide a secret inside a cover image
# ---------------------------------------------------------------------------

@app.post("/encode")
async def encode_endpoint(
    cover_image: UploadFile = File(...),
    password: str = Form(...),
    secret_text: str = Form(default=""),
    secret_file: UploadFile = File(default=None),
):
    """
    Accepts a cover image + (text OR any file) + password.
    Returns JSON with base64 stego image and comprehensive metrics.
    """
    total_start = time.perf_counter()
    metrics = {}

    # Read cover image
    cover_bytes = await cover_image.read()
    if not cover_bytes:
        raise HTTPException(status_code=400, detail="Cover image is empty.")

    # Determine payload
    secret_file_bytes = b""
    secret_filename = ""
    if secret_file and secret_file.filename:
        secret_file_bytes = await secret_file.read()
        secret_filename = secret_file.filename

    if secret_file_bytes:
        serialized = serialize_payload(secret_file_bytes, secret_filename, PAYLOAD_FILE)
        metrics["payload_type"] = "file"
        metrics["payload_filename"] = secret_filename
    elif secret_text:
        serialized = serialize_payload(secret_text.encode("utf-8"), "message.txt", PAYLOAD_TEXT)
        metrics["payload_type"] = "text"
        metrics["payload_filename"] = "message.txt"
    else:
        raise HTTPException(status_code=400, detail="Provide either secret text or a secret file.")

    metrics["original_payload_size_bytes"] = len(serialized)

    # Derive key with a random salt — timed
    t0 = time.perf_counter()
    key, salt = derive_key(password, None)
    metrics["key_derivation_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Encrypt — timed
    t0 = time.perf_counter()
    encrypted = encrypt(serialized, key)
    metrics["encryption_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    
    # Prepend 16-byte salt to the encrypted data
    payload_to_hide = salt + encrypted
    metrics["encrypted_payload_size_bytes"] = len(payload_to_hide)

    # Check capacity — timed
    t0 = time.perf_counter()
    try:
        img = Image.open(BytesIO(cover_bytes)).convert("RGB")
        image_array = np.array(img, dtype=np.uint8)
        capacity = get_capacity(image_array)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cover image.")
    metrics["capacity_analysis_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    metrics["image_width"] = img.width
    metrics["image_height"] = img.height
    metrics["image_capacity_bytes"] = capacity
    metrics["capacity_used_percent"] = round((len(payload_to_hide) / capacity) * 100, 1) if capacity > 0 else 0
    metrics["cover_image_size_bytes"] = len(cover_bytes)

    if len(payload_to_hide) > capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Payload too large! Encrypted size: {len(payload_to_hide)} bytes, "
                   f"but image can hide at most {capacity} bytes. "
                   f"Use a larger or more complex image.",
        )

    # Encode into image — timed
    t0 = time.perf_counter()
    try:
        stego_bytes = encode(cover_bytes, payload_to_hide)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    metrics["steganographic_encoding_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    metrics["stego_image_size_bytes"] = len(stego_bytes)
    metrics["total_time_ms"] = round((time.perf_counter() - total_start) * 1000, 2)

    # Compute integrity hash of the stego image for later verification
    metrics["stego_sha256"] = hashlib.sha256(stego_bytes).hexdigest()[:16]

    # Encode to base64 for JSON response
    stego_b64 = base64.b64encode(stego_bytes).decode("ascii")

    return JSONResponse(content={
        "image_base64": stego_b64,
        "metrics": metrics,
    })


# ---------------------------------------------------------------------------
# POST /decode — extract a secret from a stego image
# ---------------------------------------------------------------------------

@app.post("/decode")
async def decode_endpoint(
    stego_image: UploadFile = File(...),
    password: str = Form(...),
):
    """
    Accepts a stego image + password.
    Returns the hidden payload (auto-detects text vs. file) with metrics
    and interception/tamper alerts.
    """
    total_start = time.perf_counter()
    metrics = {}
    alerts = []  # Interception / tamper alerts

    stego_bytes = await stego_image.read()
    if not stego_bytes:
        raise HTTPException(status_code=400, detail="Stego image is empty.")

    metrics["stego_image_size_bytes"] = len(stego_bytes)

    # Compute hash of the incoming stego image
    metrics["stego_sha256"] = hashlib.sha256(stego_bytes).hexdigest()[:16]

    # Extract bits from image — timed
    t0 = time.perf_counter()
    try:
        extracted = decode(stego_bytes)
    except ValueError as e:
        alerts.append({
            "level": "critical",
            "title": "⚠️ Possible Interception Detected",
            "message": f"Failed to extract hidden data from image. The image may have been modified, "
                       f"recompressed, or intercepted during transmission. Error: {str(e)}",
        })
        return JSONResponse(status_code=400, content={
            "error": True,
            "detail": str(e),
            "alerts": alerts,
            "metrics": metrics,
        })
    metrics["steganographic_decoding_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    if len(extracted) < 16:
        alerts.append({
            "level": "critical",
            "title": "⚠️ Possible Interception Detected",
            "message": "Extracted data is too short. The image may have been tampered with, "
                       "cropped, or re-encoded during transit.",
        })
        return JSONResponse(status_code=400, content={
            "error": True,
            "detail": "Invalid hidden data format.",
            "alerts": alerts,
            "metrics": metrics,
        })

    metrics["extracted_data_size_bytes"] = len(extracted)

    # Extract 16-byte salt and the rest is encrypted data
    salt = extracted[:16]
    encrypted = extracted[16:]

    # Derive key using the extracted salt — timed
    t0 = time.perf_counter()
    key, _ = derive_key(password, salt)
    metrics["key_derivation_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # Decrypt — timed
    t0 = time.perf_counter()
    try:
        serialized = decrypt(encrypted, key)
        metrics["decryption_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    except ValueError:
        metrics["decryption_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        metrics["total_time_ms"] = round((time.perf_counter() - total_start) * 1000, 2)
        alerts.append({
            "level": "critical",
            "title": "🔴 INTERCEPTION ALERT — Data Integrity Compromised",
            "message": "AES-256-GCM authentication tag verification FAILED. "
                       "This means one or more of the following:\n"
                       "• The image was modified or tampered with after encoding\n"
                       "• The wrong password was provided\n"
                       "• The image was re-encoded, compressed, or screenshot-captured\n"
                       "• A man-in-the-middle attack may have altered the data in transit",
        })
        alerts.append({
            "level": "warning",
            "title": "🛡️ Security Recommendation",
            "message": "If you believe the password is correct, the data has likely been "
                       "intercepted or tampered with. Do NOT trust the contents. "
                       "Re-request the original image through a secure channel.",
        })
        return JSONResponse(status_code=400, content={
            "error": True,
            "detail": "Decryption failed — possible interception or wrong password.",
            "alerts": alerts,
            "metrics": metrics,
        })

    # Integrity check passed — add success alert
    alerts.append({
        "level": "success",
        "title": "✅ Integrity Verified",
        "message": "AES-256-GCM authentication tag verified successfully. "
                   "Data has NOT been tampered with since encoding.",
    })

    # Deserialize
    try:
        payload_type, filename, data = deserialize_payload(serialized)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse hidden payload.")

    metrics["decrypted_payload_size_bytes"] = len(data)
    metrics["total_time_ms"] = round((time.perf_counter() - total_start) * 1000, 2)

    if payload_type == PAYLOAD_TEXT:
        return JSONResponse(content={
            "type": "text",
            "filename": filename,
            "content": data.decode("utf-8", errors="replace"),
            "alerts": alerts,
            "metrics": metrics,
        })
    else:
        # For file payloads, encode as base64 so we can include metrics in JSON
        import mimetypes
        mime, _ = mimetypes.guess_type(filename)
        if not mime:
            mime = "application/octet-stream"

        file_b64 = base64.b64encode(data).decode("ascii")
        return JSONResponse(content={
            "type": "file",
            "filename": filename,
            "mime_type": mime,
            "file_base64": file_b64,
            "alerts": alerts,
            "metrics": metrics,
        })
