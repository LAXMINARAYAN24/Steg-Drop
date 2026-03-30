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

**Response**: PNG image streamed as `stego-drop-output.png`

```bash
# Embed a text message
curl -X POST http://localhost:8000/encode \
  -F "cover_image=@photo.jpg" \
  -F "password=MyStr0ng!Pass" \
  -F "secret_text=Hello, world!" \
  -o stego.png

# Embed a file
curl -X POST http://localhost:8000/encode \
  -F "cover_image=@photo.jpg" \
  -F "password=MyStr0ng!Pass" \
  -F "secret_file=@secret.pdf" \
  -o stego.png
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
  "content": "Hello, world!"
}
```

**Response (file payload)**: Binary stream with the original filename and MIME type.

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
├── make_ppt.py          # Utility: generate a project presentation (PPTX)
├── test_roundtrip.py    # Integration test: encode → decode round-trip
├── requirements.txt     # Python dependencies
├── original_image.jpg   # Sample cover image
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
python test_roundtrip.py
```

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
