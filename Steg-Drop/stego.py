"""
Steg-Drop — Phase 2: Adaptive Steganography Module
Edge-adaptive LSB embedding using Canny edge detection.
"""

import numpy as np
import cv2
from io import BytesIO
from PIL import Image
import struct


# ---------------------------------------------------------------------------
# Edge Detection — find the best hiding spots
# ---------------------------------------------------------------------------


def get_edge_mask(image_array: np.ndarray) -> np.ndarray:
    """
    Apply Canny Edge Detection to find high-texture areas.
    Zero out the LSBs first so the mask is identical on both cover and stego images.
    Dilate edges to increase the embedding region.
    Returns a boolean mask (H x W) of embeddable pixel locations.
    """
    # Create a copy and zero out the LSB to ensure identical edge detection
    # before and after embedding data in the LSBs.
    base_array = image_array & 0xFE
    
    gray = cv2.cvtColor(base_array, cv2.COLOR_RGB2GRAY)

    # Canny edge detection with auto-thresholding
    median_val = np.median(gray)
    lower = int(max(0, 0.5 * median_val))
    upper = int(min(255, 1.5 * median_val))
    edges = cv2.Canny(gray, lower, upper)

    # Dilate edges to expand the embedding area
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    return dilated > 0  # boolean mask


# ---------------------------------------------------------------------------
# Capacity check
# ---------------------------------------------------------------------------


def get_capacity(image_array: np.ndarray) -> int:
    """
    Returns the maximum number of bytes that can be hidden in this image.
    Accounts for the 32-bit length header.
    """
    mask = get_edge_mask(image_array)
    total_pixel_slots = int(np.sum(mask))
    # 3 channels × 1 bit per channel = 3 bits per pixel
    total_bits = total_pixel_slots * 3
    total_bytes = total_bits // 8
    # Reserve 4 bytes for the length header
    return max(0, total_bytes - 4)


# ---------------------------------------------------------------------------
# LSB Encoding — hide encrypted bytes in edge pixels
# ---------------------------------------------------------------------------


def encode(cover_image_bytes: bytes, secret_bytes: bytes) -> bytes:
    """
    Embed secret_bytes into the LSBs of edge-pixels in the cover image.;
    
    Layout: [length (4B / 32 bits)] [secret data bits]
    
    Returns: PNG image bytes of the stego image.
    """
    # Load image
    img = Image.open(BytesIO(cover_image_bytes)).convert("RGB")
    image_array = np.array(img, dtype=np.uint8)

    # Get edge mask
    mask = get_edge_mask(image_array)

    # Prepare the data: 4-byte length header + secret data
    length_header = struct.pack(">I", len(secret_bytes))
    full_data = length_header + secret_bytes

    # Convert data to bits
    data_bits = np.unpackbits(np.frombuffer(full_data, dtype=np.uint8))

    # Get embeddable pixel positions (row, col)
    edge_positions = np.argwhere(mask)  # shape: (N, 2)
    total_available_bits = len(edge_positions) * 3  # R, G, B channels

    if len(data_bits) > total_available_bits:
        raise ValueError(
            f"Payload too large! Need {len(data_bits)} bits but only "
            f"{total_available_bits} bits available in edge pixels. "
            f"Max payload: {total_available_bits // 8 - 4} bytes. "
            f"Try a larger or more complex image."
        )

    # Embed bits into LSBs of R, G, B channels at edge positions
    bit_idx = 0
    for pos in edge_positions:
        if bit_idx >= len(data_bits):
            break
        r, c = pos[0], pos[1]
        for channel in range(3):  # R, G, B
            if bit_idx >= len(data_bits):
                break
            # Clear the LSB and set it to the data bit
            image_array[r, c, channel] = (
                (image_array[r, c, channel] & 0xFE) | int(data_bits[bit_idx])
            )
            bit_idx += 1

    # Save to PNG (lossless) in memory
    stego_img = Image.fromarray(image_array)
    output = BytesIO()
    stego_img.save(output, format="PNG")
    output.seek(0)
    return output.read()


# ---------------------------------------------------------------------------
# LSB Decoding — extract hidden bytes from edge pixels
# ---------------------------------------------------------------------------


def decode(stego_image_bytes: bytes) -> bytes:
    """
    Extract hidden data from the LSBs of edge-pixels.
    Returns the original secret bytes.
    """
    # Load stego image
    img = Image.open(BytesIO(stego_image_bytes)).convert("RGB")
    image_array = np.array(img, dtype=np.uint8)

    # Recompute the same edge mask (deterministic from the image content)
    mask = get_edge_mask(image_array)
    edge_positions = np.argwhere(mask)

    # First, extract enough bits for the 4-byte length header (32 bits)
    header_bits = []
    bit_idx = 0
    for pos in edge_positions:
        if bit_idx >= 32:
            break
        r, c = pos[0], pos[1]
        for channel in range(3):
            if bit_idx >= 32:
                break
            header_bits.append(image_array[r, c, channel] & 1)
            bit_idx += 1

    if len(header_bits) < 32:
        raise ValueError("Image too small or no edge data to decode.")

    # Parse the length
    header_bytes = np.packbits(np.array(header_bits, dtype=np.uint8)).tobytes()
    data_length = struct.unpack(">I", header_bytes)[0]

    # Sanity check
    if data_length <= 0 or data_length > 100_000_000:  # 100MB limit
        raise ValueError("Invalid data length detected — wrong image or no hidden data.")

    # Now extract the full data bits (header + data)
    total_bits_needed = 32 + (data_length * 8)
    all_bits = []
    bit_idx = 0
    for pos in edge_positions:
        if bit_idx >= total_bits_needed:
            break
        r, c = pos[0], pos[1]
        for channel in range(3):
            if bit_idx >= total_bits_needed:
                break
            all_bits.append(image_array[r, c, channel] & 1)
            bit_idx += 1

    if len(all_bits) < total_bits_needed:
        raise ValueError("Not enough edge pixels to extract the full payload.")

    # Skip the 32 header bits, pack the rest
    data_bits = np.array(all_bits[32:], dtype=np.uint8)
    # Pad to multiple of 8 if needed
    remainder = len(data_bits) % 8
    if remainder:
        data_bits = np.concatenate([data_bits, np.zeros(8 - remainder, dtype=np.uint8)])

    secret_bytes = np.packbits(data_bits).tobytes()[:data_length]
    return secret_bytes
