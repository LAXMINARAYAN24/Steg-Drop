"""Quick round-trip test for encode/decode pipeline."""
import requests

# Test encode
with open("test_cover.png", "rb") as f:
    cover_data = f.read()

files = {"cover_image": ("test_cover.png", cover_data, "image/png")}
data = {
    "password": "TestPassword123!",
    "secret_text": "Hello from Steg-Drop! This is a secret message hidden inside an image using edge-adaptive LSB steganography with AES-256-GCM encryption."
}

print("Encoding...")
r = requests.post("http://127.0.0.1:8000/encode", files=files, data=data)
print(f"Encode status: {r.status_code}")

if r.status_code != 200:
    print(f"Encode error: {r.text}")
    exit(1)

with open("stego_output.png", "wb") as f:
    f.write(r.content)
print(f"Stego image saved: {len(r.content)} bytes")

# Test decode
with open("stego_output.png", "rb") as f:
    stego_data = f.read()

files2 = {"stego_image": ("stego_output.png", stego_data, "image/png")}
data2 = {"password": "TestPassword123!"}

print("Decoding...")
r2 = requests.post("http://127.0.0.1:8000/decode", files=files2, data=data2)
print(f"Decode status: {r2.status_code}")

if r2.status_code == 200:
    result = r2.json()
    print(f"Type: {result['type']}")
    print(f"Content: {result['content']}")
    print("=== ROUND TRIP SUCCESS! ===")
else:
    print(f"Decode error: {r2.text}")
    exit(1)
