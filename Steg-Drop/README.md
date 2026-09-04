# 🔐 Steg-Drop

> **Edge-Adaptive Steganography · AES-256-GCM · Zero Knowledge**

Steg-Drop is a secure, browser-based steganography service that invisibly hides secrets — text messages or any file — inside ordinary images. All processing happens entirely in RAM; nothing is ever saved to disk.

---

## ✨ Features

- **Hide anything** — embed text messages or arbitrary files inside a cover image
- **AES-256-GCM encryption** — authenticated encryption with a password-derived key (PBKDF2-HMAC-SHA256, 100,000 iterations)
- **Edge-adaptive LSB embedding** — data is hidden in textured edge regions detected by the Canny algorithm, making changes visually imperceptible
- **Zero-knowledge server** — the server never writes plaintext or stego images to disk; everything is streamed in memory
- **Auto-detection on decode** — the server automatically returns the hidden payload as readable text or a file download
- **Modern web UI** — dark-themed, drag-and-drop interface; no extra software required

---

## 🖼️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  ENCODE                                                       │
│                                                               │
│  Cover Image ──┐                                             │
│                ├─► Edge Detection (Canny)                    │
│  Secret + PW ──┤         │                                   │
│                │   LSB Embedding into edge pixels            │
│                └─────────┴──────► Stego Image (PNG)         │
│                                                               │
│  DECODE                                                       │
│                                                               │
│  Stego Image + PW ──► Extract LSB bits from edge pixels      │
│                           │                                   │
│                      AES-256-GCM Decrypt                      │
│                           │                                   │
│                    Text (JSON) or File (download)             │
└─────────────────────────────────────────────────────────────┘
```

### Three-Phase Architecture

| Phase | Module | Responsibility |
|-------|--------|----------------|
| 1 | `crypto.py` | PBKDF2 key derivation + AES-256-GCM encrypt/decrypt |
| 2 | `stego.py` | Canny edge detection + LSB bit-plane embedding/extraction |
| 3 | `app.py` | FastAPI web server, REST endpoints, in-memory I/O |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3, FastAPI, Uvicorn |
| Image processing | Pillow, OpenCV (headless), NumPy |
| Cryptography | pycryptodome (AES-256-GCM, PBKDF2) |
| Frontend | HTML5, CSS3, vanilla JavaScript |

---

## 📦 Installation

### Prerequisites

- Python 3.8 or later
- `pip`

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/LAXMINARAYAN24/Steg-Drop.git
cd Steg-Drop

# 2. (Optional) create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server
uvicorn app:app --host 0.0.0.0 --port 8000
```

Open your browser and visit **http://localhost:8000**.

---

## 🚀 Usage

### Web UI

The interface has two tabs:

#### Encode (hide a secret)
1. Open the **Encode** tab.
2. Upload or drag-and-drop a **cover image** (PNG, JPEG, BMP, or TIFF).
3. Enter a strong **password**.
4. Choose **Text** and type a message, *or* choose **File** and upload the file you want to hide.
5. Click **Encode & Download** — a `stego-drop-output.png` file will be downloaded.

#### Decode (reveal a secret)
1. Open the **Decode** tab.
2. Upload the **stego image** (the PNG you received from the encode step).
3. Enter the **same password** used during encoding.
4. Click **Decode** — the hidden text is displayed on-screen, or the hidden file is downloaded automatically.

---

### REST API

#### `POST /encode`

Hide a secret inside a cover image.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cover_image` | file | ✅ | The image to use as a carrier (PNG / JPEG / BMP / TIFF) |
| `password` | string | ✅ | Encryption password |
| `secret_text` | string | ⬜ | Text message to hide |
| `secret_file` | file | ⬜ | File to hide (use *either* `secret_text` or `secret_file`) |

**Response**: JSON object containing the stego image as a Base64 string and encoding metrics.

```json
{
  "image_base64": "<base64-encoded PNG>",
  "metrics": {
    "payload_type": "text",
    "payload_filename": "message.txt",
    "original_payload_size_bytes": 42,
    "key_derivation_time_ms": 312.5,
    "encryption_time_ms": 0.8,
    "encrypted_payload_size_bytes": 87,
    "image_width": 1920,
    "image_height": 1080,
    "image_capacity_bytes": 24000,
    "capacity_used_percent": 0.4,
    "cover_image_size_bytes": 524288,
    "steganographic_encoding_time_ms": 95.3,
    "stego_image_size_bytes": 612345,
    "total_time_ms": 412.1,
    "stego_sha256": "a1b2c3d4e5f6a7b8"
  }
}
```

```bash
# Embed a text message (save the stego image from the JSON response)
curl -X POST http://localhost:8000/encode \
  -F "cover_image=@photo.jpg" \
  -F "password=MyStr0ng!Pass" \
  -F "secret_text=Hello, world!" \
  | python3 -c "import sys,json,base64; d=json.load(sys.stdin); open('stego.png','wb').write(base64.b64decode(d['image_base64']))"

# Embed a file
curl -X POST http://localhost:8000/encode \
  -F "cover_image=@photo.jpg" \
  -F "password=MyStr0ng!Pass" \
  -F "secret_file=@secret.pdf" \
  | python3 -c "import sys,json,base64; d=json.load(sys.stdin); open('stego.png','wb').write(base64.b64decode(d['image_base64']))"
```

---

#### `POST /decode`

Extract a secret from a stego image.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stego_image` | file | ✅ | The stego PNG produced by `/encode` |
| `password` | string | ✅ | Password used during encoding |

**Response (text payload)**:
```json
{
  "type": "text",
  "filename": "message.txt",
  "content": "Hello, world!",
  "alerts": [
    {
      "level": "success",
      "title": "✅ Integrity Verified",
      "message": "AES-256-GCM authentication tag verified successfully. Data has NOT been tampered with since encoding."
    }
  ],
  "metrics": {
    "stego_image_size_bytes": 612345,
    "stego_sha256": "a1b2c3d4e5f6a7b8",
    "steganographic_decoding_time_ms": 88.2,
    "extracted_data_size_bytes": 87,
    "key_derivation_time_ms": 310.1,
    "decryption_time_ms": 0.5,
    "decrypted_payload_size_bytes": 42,
    "total_time_ms": 401.3
  }
}
```

**Response (file payload)**:
```json
{
  "type": "file",
  "filename": "secret.pdf",
  "mime_type": "application/pdf",
  "file_base64": "<base64-encoded file content>",
  "alerts": [...],
  "metrics": {...}
}
```

> **Note:** If decryption fails (wrong password or tampered image), the response has `"error": true` and the `alerts` array will contain a critical interception alert.

```bash
curl -X POST http://localhost:8000/decode \
  -F "stego_image=@stego.png" \
  -F "password=MyStr0ng!Pass"
```

---

## 🗂️ Project Structure

```
Steg-Drop/
├── app.py               # FastAPI application & API endpoints
├── crypto.py            # AES-256-GCM encryption / PBKDF2 key derivation
├── stego.py             # Edge-adaptive LSB steganography
├── test_roundtrip.py    # Integration test: encode → decode round-trip
├── requirements.txt     # Python dependencies
└── static/
    ├── index.html       # Single-page application
    ├── script.js        # Frontend logic (tab switching, API calls)
    └── style.css        # Dark-theme stylesheet
```

---

## 🔒 Security Notes

- **Passwords are never transmitted or stored** — the server derives a key from the password in memory and discards it immediately.
- **Each encode operation uses a fresh random 16-byte salt**, so the same password produces a different ciphertext every time.
- **AES-256-GCM** provides authenticated encryption: decoding with a wrong password or a tampered image will fail with an authentication error.
- **Edge-adaptive embedding** concentrates changes in visually complex regions, reducing the statistical signature of the hidden data.
- The output is always **PNG** to avoid lossy re-compression destroying the hidden bits.

---

## 🧪 Running Tests

```bash
# The round-trip test requires the server to be running first
uvicorn app:app --port 8000 &

# Provide a cover image named test_cover.png
python test_roundtrip.py
```

> **Note:** `test_roundtrip.py` uses the `/encode` and `/decode` JSON API. The encode response returns `image_base64` (Base64-encoded PNG), and the decode response returns the payload as JSON. Make sure `test_cover.png` is present in the project root before running.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request.

Please keep pull requests focused and include tests where applicable.

---

## 📄 License

This project is open-source. See the repository for licensing details.
