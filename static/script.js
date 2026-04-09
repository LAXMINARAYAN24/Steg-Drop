/**
 * Steg-Drop — Frontend Logic
 * Tab switching, form handling, drag-and-drop, encode/decode API calls,
 * metrics dashboard, and interception alert system.
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
        const metricsPanel = document.getElementById('encode-metrics');
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
            metricsPanel.style.display = 'none';

            const response = await fetch('/encode', { method: 'POST', body: formData });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Encoding failed');
            }

            // Download the stego image from base64
            const byteChars = atob(data.image_base64);
            const byteNumbers = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteNumbers], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'steg-drop-output.png';
            a.click();
            URL.revokeObjectURL(url);

            showStatus(statusEl, '✅ Success! Stego image downloaded. Your secret is hidden inside.', 'success');

            // Render metrics
            if (data.metrics) {
                renderEncodeMetrics(metricsPanel, data.metrics);
            }
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
        const alertsPanel = document.getElementById('decode-alerts');
        const metricsPanel = document.getElementById('decode-metrics');
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
            alertsPanel.innerHTML = '';
            alertsPanel.style.display = 'none';
            metricsPanel.style.display = 'none';

            const response = await fetch('/decode', { method: 'POST', body: formData });
            const data = await response.json();

            // Render alerts (always, even on error)
            if (data.alerts && data.alerts.length > 0) {
                renderAlerts(alertsPanel, data.alerts);
            }

            // Render metrics (always, even on error)
            if (data.metrics) {
                renderDecodeMetrics(metricsPanel, data.metrics);
            }

            if (!response.ok || data.error) {
                // Error with interception alert
                showStatus(statusEl, '', 'error');
                statusEl.style.display = 'none';
                resultCard.style.display = 'none';
                return;
            }

            if (data.type === 'text') {
                resultContent.textContent = data.content;
                resultCard.style.display = 'block';
                showStatus(statusEl, '✅ Text secret decoded successfully!', 'success');
            } else if (data.type === 'file') {
                // Decode base64 file and trigger download
                const byteChars = atob(data.file_base64);
                const byteNumbers = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteNumbers[i] = byteChars.charCodeAt(i);
                }
                const blob = new Blob([byteNumbers], { type: data.mime_type || 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = data.filename || 'decoded-file';
                a.click();
                URL.revokeObjectURL(url);

                resultContent.innerHTML = `<a href="#" class="download-link" onclick="return false;">📎 ${escapeHtml(data.filename)} (${formatSize(blob.size)}) — Downloaded</a>`;
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

    // ===== Render Encode Metrics =====
    function renderEncodeMetrics(panel, m) {
        const timingItems = [
            { label: 'Key Derivation (PBKDF2)', value: m.key_derivation_time_ms, unit: 'ms', icon: '🔑' },
            { label: 'AES-256-GCM Encryption', value: m.encryption_time_ms, unit: 'ms', icon: '🔒' },
            { label: 'Capacity Analysis', value: m.capacity_analysis_time_ms, unit: 'ms', icon: '📊' },
            { label: 'Steganographic Encoding', value: m.steganographic_encoding_time_ms, unit: 'ms', icon: '🖼️' },
            { label: 'Total Processing Time', value: m.total_time_ms, unit: 'ms', icon: '⏱️', highlight: true },
        ];

        const dataItems = [
            { label: 'Image Dimensions', value: `${m.image_width} × ${m.image_height}`, icon: '📐' },
            { label: 'Cover Image Size', value: formatSize(m.cover_image_size_bytes), icon: '🖼️' },
            { label: 'Original Payload', value: formatSize(m.original_payload_size_bytes), icon: '📦' },
            { label: 'Encrypted Payload', value: formatSize(m.encrypted_payload_size_bytes), icon: '🔐' },
            { label: 'Image Capacity', value: formatSize(m.image_capacity_bytes), icon: '💾' },
            { label: 'Capacity Used', value: `${m.capacity_used_percent}%`, icon: '📈', highlight: m.capacity_used_percent > 75 },
            { label: 'Stego Image Size', value: formatSize(m.stego_image_size_bytes), icon: '📁' },
            { label: 'Integrity Hash', value: m.stego_sha256, icon: '🛡️', mono: true },
        ];

        panel.innerHTML = `
            <div class="metrics-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                <span>Performance Metrics</span>
            </div>
            <div class="metrics-section">
                <div class="metrics-section-title">⏱️ Timing Breakdown</div>
                <div class="metrics-grid">
                    ${timingItems.map(item => renderMetricItem(item)).join('')}
                </div>
            </div>
            <div class="metrics-section">
                <div class="metrics-section-title">📊 Data Metrics</div>
                <div class="metrics-grid">
                    ${dataItems.map(item => renderMetricItem(item)).join('')}
                </div>
            </div>
            ${renderCapacityBar(m.capacity_used_percent)}
        `;
        panel.style.display = 'block';
    }

    // ===== Render Decode Metrics =====
    function renderDecodeMetrics(panel, m) {
        const timingItems = [];
        if (m.steganographic_decoding_time_ms !== undefined) {
            timingItems.push({ label: 'Steganographic Extraction', value: m.steganographic_decoding_time_ms, unit: 'ms', icon: '🖼️' });
        }
        if (m.key_derivation_time_ms !== undefined) {
            timingItems.push({ label: 'Key Derivation (PBKDF2)', value: m.key_derivation_time_ms, unit: 'ms', icon: '🔑' });
        }
        if (m.decryption_time_ms !== undefined) {
            timingItems.push({ label: 'AES-256-GCM Decryption', value: m.decryption_time_ms, unit: 'ms', icon: '🔓' });
        }
        if (m.total_time_ms !== undefined) {
            timingItems.push({ label: 'Total Processing Time', value: m.total_time_ms, unit: 'ms', icon: '⏱️', highlight: true });
        }

        const dataItems = [
            { label: 'Stego Image Size', value: formatSize(m.stego_image_size_bytes), icon: '📁' },
        ];
        if (m.extracted_data_size_bytes !== undefined) {
            dataItems.push({ label: 'Extracted Data', value: formatSize(m.extracted_data_size_bytes), icon: '📦' });
        }
        if (m.decrypted_payload_size_bytes !== undefined) {
            dataItems.push({ label: 'Decrypted Payload', value: formatSize(m.decrypted_payload_size_bytes), icon: '🔐' });
        }
        if (m.stego_sha256) {
            dataItems.push({ label: 'Image Hash', value: m.stego_sha256, icon: '🛡️', mono: true });
        }

        panel.innerHTML = `
            <div class="metrics-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                <span>Performance Metrics</span>
            </div>
            ${timingItems.length > 0 ? `
            <div class="metrics-section">
                <div class="metrics-section-title">⏱️ Timing Breakdown</div>
                <div class="metrics-grid">
                    ${timingItems.map(item => renderMetricItem(item)).join('')}
                </div>
            </div>` : ''}
            <div class="metrics-section">
                <div class="metrics-section-title">📊 Data Metrics</div>
                <div class="metrics-grid">
                    ${dataItems.map(item => renderMetricItem(item)).join('')}
                </div>
            </div>
        `;
        panel.style.display = 'block';
    }

    // ===== Render Individual Metric Item =====
    function renderMetricItem(item) {
        const valueClass = item.highlight ? 'metric-value highlight' : 'metric-value';
        const monoClass = item.mono ? ' mono' : '';
        const displayValue = item.unit ? `${item.value} ${item.unit}` : item.value;
        return `
            <div class="metric-item">
                <div class="metric-icon">${item.icon}</div>
                <div class="metric-details">
                    <div class="metric-label">${item.label}</div>
                    <div class="${valueClass}${monoClass}">${displayValue}</div>
                </div>
            </div>
        `;
    }

    // ===== Render Capacity Bar =====
    function renderCapacityBar(percent) {
        const barColor = percent > 90 ? 'var(--accent-rose)' :
                         percent > 75 ? '#f59e0b' :
                         'var(--accent-emerald)';
        return `
            <div class="capacity-bar-container">
                <div class="capacity-bar-label">
                    <span>Image Capacity Usage</span>
                    <span class="capacity-percent" style="color: ${barColor}">${percent}%</span>
                </div>
                <div class="capacity-bar-track">
                    <div class="capacity-bar-fill" style="width: ${Math.min(percent, 100)}%; background: ${barColor};"></div>
                </div>
            </div>
        `;
    }

    // ===== Render Alerts (Interception Detection) =====
    function renderAlerts(panel, alerts) {
        panel.innerHTML = alerts.map(alert => {
            const levelClass = `alert-${alert.level}`;
            const icon = alert.level === 'critical' ? `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>` :
                alert.level === 'warning' ? `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                </svg>` : `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>`;

            return `
                <div class="alert-card ${levelClass}">
                    <div class="alert-icon">${icon}</div>
                    <div class="alert-body">
                        <div class="alert-title">${escapeHtml(alert.title)}</div>
                        <div class="alert-message">${escapeHtml(alert.message).replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `;
        }).join('');
        panel.style.display = 'block';
    }

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
        if (bytes === undefined || bytes === null) return '—';
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
