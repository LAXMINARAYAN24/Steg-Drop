"""
Steg-Drop — Phase 3: FastAPI Web Server
Zero-knowledge steganography service: all processing in RAM, nothing saved to disk.
"""

import os
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
    Returns a stego PNG image with the secret embedded.
    """
    # Read cover image
    cover_bytes = await cover_image.read()
    if not cover_bytes:
        raise HTTPException(status_code=400, detail="Cover image is empty.")

    # Determine payload
    secret_file_bytes = b""
    if secret_file and secret_file.filename:
        secret_file_bytes = await secret_file.read()

    if secret_file_bytes:
        serialized = serialize_payload(secret_file_bytes, secret_file.filename, PAYLOAD_FILE)
    elif secret_text:
        serialized = serialize_payload(secret_text.encode("utf-8"), "message.txt", PAYLOAD_TEXT)
    else:
        raise HTTPException(status_code=400, detail="Provide either secret text or a secret file.")

    # Derive key with a random salt
    key, salt = derive_key(password, None)

    # Encrypt
    encrypted = encrypt(serialized, key)
    
    # Prepend 16-byte salt to the encrypted data
    payload_to_hide = salt + encrypted

    # Check capacity
    try:
        img = Image.open(BytesIO(cover_bytes)).convert("RGB")
        image_array = np.array(img, dtype=np.uint8)
        capacity = get_capacity(image_array)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cover image.")

    if len(payload_to_hide) > capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Payload too large! Encrypted size: {len(payload_to_hide)} bytes, "
                   f"but image can hide at most {capacity} bytes. "
                   f"Use a larger or more complex image.",
        )

    # Encode into image
    try:
        stego_bytes = encode(cover_bytes, payload_to_hide)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Stream back as PNG download — zero-knowledge: nothing stored
    return StreamingResponse(
        BytesIO(stego_bytes),
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=steg-drop-output.png"},
    )


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
    Returns the hidden payload (auto-detects text vs. file).
    """
    stego_bytes = await stego_image.read()
    if not stego_bytes:
        raise HTTPException(status_code=400, detail="Stego image is empty.")

    # Extract bits from image
    try:
        extracted = decode(stego_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(extracted) < 16:
        raise HTTPException(status_code=400, detail="Invalid hidden data format.")

    # Extract 16-byte salt and the rest is encrypted data
    salt = extracted[:16]
    encrypted = extracted[16:]

    # Derive key using the extracted salt
    key, _ = derive_key(password, salt)

    # Decrypt
    try:
        serialized = decrypt(encrypted, key)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Decryption failed — wrong password, wrong image, or data has been tampered with.",
        )

    # Deserialize
    try:
        payload_type, filename, data = deserialize_payload(serialized)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse hidden payload.")

    if payload_type == PAYLOAD_TEXT:
        # Return as JSON with the text content
        return JSONResponse(content={
            "type": "text",
            "filename": filename,
            "content": data.decode("utf-8", errors="replace"),
        })
    else:
        # Return as file download
        # Guess MIME type from filename
        import mimetypes
        mime, _ = mimetypes.guess_type(filename)
        if not mime:
            mime = "application/octet-stream"
        return StreamingResponse(
            BytesIO(data),
            media_type=mime,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
