/**
 * Steg-Drop — Frontend Logic
 * Tab switching, form handling, drag-and-drop, encode/decode API calls
 */

document.addEventListener('DOMContentLoaded', () => {
    // ===== Tab Switching =====
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // ===== Payload Toggle (Text / File) =====
    const payloadTextBtn = document.getElementById('payload-text-btn');
    const payloadFileBtn = document.getElementById('payload-file-btn');
    const textInputArea = document.getElementById('text-input-area');
    const fileInputArea = document.getElementById('file-input-area');

    payloadTextBtn.addEventListener('click', () => {
        payloadTextBtn.classList.add('active');
        payloadFileBtn.classList.remove('active');
        textInputArea.style.display = 'block';
        fileInputArea.style.display = 'none';
    });

    payloadFileBtn.addEventListener('click', () => {
        payloadFileBtn.classList.add('active');
        payloadTextBtn.classList.remove('active');
        fileInputArea.style.display = 'block';
        textInputArea.style.display = 'none';
    });

    // ===== Password Visibility Toggle =====
    setupEyeToggle('encode-eye', 'encode-password');
    setupEyeToggle('decode-eye', 'decode-password');

    function setupEyeToggle(eyeId, inputId) {
        const eyeBtn = document.getElementById(eyeId);
        const input = document.getElementById(inputId);
        eyeBtn.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            eyeBtn.style.color = isPassword ? 'var(--accent-indigo)' : 'var(--text-muted)';
        });
    }

    // ===== Drag & Drop — Cover Image =====
    setupImageDrop('cover-drop-zone', 'cover-image', 'cover-preview', 'cover-preview-img', 'cover-remove');

    function setupImageDrop(zoneId, inputId, previewId, imgId, removeId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const previewImg = document.getElementById(imgId);
        const removeBtn = document.getElementById(removeId);
        const content = zone.querySelector('.drop-zone-content');

        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                showImagePreview(input.files[0]);
            }
        });

        input.addEventListener('change', () => {
            if (input.files.length) showImagePreview(input.files[0]);
        });

        function showImagePreview(file) {
            const reader = new FileReader();
            reader.onload = e => {
                previewImg.src = e.target.result;
                preview.style.display = 'block';
                content.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }

        removeBtn.addEventListener('click', e => {
            e.stopPropagation();
            input.value = '';
            preview.style.display = 'none';
            content.style.display = 'flex';
        });
    }

    // ===== Drag & Drop — Secret File =====
    setupFileDrop('secret-drop-zone', 'secret-file', 'secret-file-preview', 'secret-file-name', 'secret-file-size', 'secret-remove');

    function setupFileDrop(zoneId, inputId, previewId, nameId, sizeId, removeId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const nameEl = document.getElementById(nameId);
        const sizeEl = document.getElementById(sizeId);
        const removeBtn = document.getElementById(removeId);
        const content = zone.querySelector('.drop-zone-content');

        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                showFilePreview(input.files[0]);
            }
        });

        input.addEventListener('change', () => {
            if (input.files.length) showFilePreview(input.files[0]);
        });

        function showFilePreview(file) {
            nameEl.textContent = file.name;
            sizeEl.textContent = formatSize(file.size);
            preview.style.display = 'flex';
            content.style.display = 'none';
        }

        removeBtn.addEventListener('click', e => {
            e.stopPropagation();
            input.value = '';
            preview.style.display = 'none';
            content.style.display = 'flex';
        });
    }

    // ===== Stego Image Drop (Decode tab) =====
    setupImageDrop('stego-drop-zone', 'stego-image', 'stego-preview', 'stego-preview-img', 'stego-remove');

    // ===== Encode Form =====
    const encodeForm = document.getElementById('encode-form');
    encodeForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('encode-btn');
        const statusEl = document.getElementById('encode-status');
        const spinner = btn.querySelector('.spinner');
        const btnText = btn.querySelector('span');

        const coverFile = document.getElementById('cover-image').files[0];
        if (!coverFile) return showStatus(statusEl, 'Please select a cover image.', 'error');

        const password = document.getElementById('encode-password').value;
        if (!password) return showStatus(statusEl, 'Please enter a password.', 'error');

        const isTextMode = payloadTextBtn.classList.contains('active');
        const secretText = document.getElementById('secret-text').value;
        const secretFile = document.getElementById('secret-file').files[0];

        if (isTextMode && !secretText) return showStatus(statusEl, 'Please enter secret text.', 'error');
        if (!isTextMode && !secretFile) return showStatus(statusEl, 'Please select a secret file.', 'error');

        // Build form data
        const formData = new FormData();
        formData.append('cover_image', coverFile);
        formData.append('password', password);

        if (isTextMode) {
            formData.append('secret_text', secretText);
        } else {
            formData.append('secret_file', secretFile);
        }

        try {
            setLoading(btn, spinner, btnText, true);
            showStatus(statusEl, 'Encrypting and embedding — this may take a moment...', 'info');

            const response = await fetch('/encode', { method: 'POST', body: formData });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Encoding failed');
            }

            // Download the stego image
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'steg-drop-output.png';
            a.click();
            URL.revokeObjectURL(url);

            showStatus(statusEl, '✅ Success! Stego image downloaded. Your secret is hidden inside.', 'success');
        } catch (err) {
            showStatus(statusEl, `❌ ${err.message}`, 'error');
        } finally {
            setLoading(btn, spinner, btnText, false);
        }
    });

    // ===== Decode Form =====
    const decodeForm = document.getElementById('decode-form');
    decodeForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('decode-btn');
        const statusEl = document.getElementById('decode-status');
        const resultCard = document.getElementById('decode-result');
        const resultContent = document.getElementById('result-content');
        const spinner = btn.querySelector('.spinner');
        const btnText = btn.querySelector('span');

        const stegoFile = document.getElementById('stego-image').files[0];
        if (!stegoFile) return showStatus(statusEl, 'Please select a stego image.', 'error');

        const password = document.getElementById('decode-password').value;
        if (!password) return showStatus(statusEl, 'Please enter the password.', 'error');

        const formData = new FormData();
        formData.append('stego_image', stegoFile);
        formData.append('password', password);

        try {
            setLoading(btn, spinner, btnText, true);
            showStatus(statusEl, 'Extracting and decrypting — please wait...', 'info');
            resultCard.style.display = 'none';

            const response = await fetch('/decode', { method: 'POST', body: formData });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Decoding failed');
            }

            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                // Text payload
                const data = await response.json();
                resultContent.textContent = data.content;
                resultCard.style.display = 'block';
                showStatus(statusEl, '✅ Text secret decoded successfully!', 'success');
            } else {
                // File payload — trigger download
                const blob = await response.blob();
                const disposition = response.headers.get('content-disposition') || '';
                let filename = 'decoded-file';
                const match = disposition.match(/filename=(.+)/);
                if (match) filename = match[1];

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);

                resultContent.innerHTML = `<a href="#" class="download-link" onclick="return false;">📎 ${escapeHtml(filename)} (${formatSize(blob.size)}) — Downloaded</a>`;
                resultCard.style.display = 'block';
                showStatus(statusEl, '✅ File secret decoded and downloaded!', 'success');
            }
        } catch (err) {
            showStatus(statusEl, `❌ ${err.message}`, 'error');
            resultCard.style.display = 'none';
        } finally {
            setLoading(btn, spinner, btnText, false);
        }
    });

    // ===== Helpers =====
    function showStatus(el, message, type) {
        el.textContent = message;
        el.className = `status-message ${type}`;
        el.style.display = 'block';
    }

    function setLoading(btn, spinner, text, loading) {
        btn.disabled = loading;
        spinner.style.display = loading ? 'inline-block' : 'none';
        text.style.opacity = loading ? '0.5' : '1';
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
