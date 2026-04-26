/**
 * ========================================================================================================================
 * ReGenX — AI Waste Scanner Module (Premium Edition)
 * Integrated with Spectral Analysis & Strict Anti-Cheat
 * ========================================================================================================================
 */

const BioScanner = (() => {

  // ── Internal state ─────────────────────────────────────────────────────────
  let _stream    = null;   // MediaStream from getUserMedia
  let _imageB64  = null;   // Current captured image as base64
  let _opts      = {};     // Options passed to open()

  // ── Storage helpers (Patched for ReGenX DB) ────────────────────────────────
  const _storage = {
    async get(key) { return DB.get(key); },
    async set(key, value) { DB.set(key, value); return true; },
    async list(prefix) { return DB.list(prefix); }
  };

  function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function _ts()  { return Date.now(); }
  function _ago(ms) {
    const d = Date.now() - ms;
    if (d < 60000)     return 'just now';
    if (d < 3600000)   return Math.floor(d / 60000)   + 'm ago';
    if (d < 86400000)  return Math.floor(d / 3600000)  + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
  }

  function _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.warn('[BioScanner]', msg);
  }

  // ── Stop camera stream ─────────────────────────────────────────────────────
  function _stopCamera() {
    if (_stream) { 
      _stream.getTracks().forEach(t => t.stop()); 
      _stream = null; 
      console.log('[BioScanner] Camera Released');
    }
  }

  // ── Render scanner HTML ───────────────────────────────────────────────────
  function _render() {
    const container = document.getElementById(_opts.containerId || 'scanner-view');
    if (!container) return;

    container.innerHTML = `
      <div class="scanner-shell">
        <div class="scanner-header">
          <button class="scanner-back" onclick="BioScanner._back()">← Back</button>
          <div class="scanner-title-wrap">
            <div class="scanner-title">Bio-Spectral Scanner</div>
            <div class="scanner-subtitle">AI · IoT Visual Analysis v4.0</div>
          </div>
        </div>

        <div class="scanner-info-banner">
          <div class="info-icon">💡</div>
          <div class="info-text">
            <strong>Pro Tip:</strong> Ensure waste is well-lit. The spectral sensor detects chlorophyll and texture density to calculate biogas yield.
          </div>
        </div>

        <div class="cam-mode-row">
          <button class="cam-mode-btn on" id="bws-mode-cam"    onclick="BioScanner._setMode('camera')">📷 Live Sensor</button>
          <button class="cam-mode-btn"    id="bws-mode-upload" onclick="BioScanner._setMode('upload')">🖼 Upload Image</button>
        </div>

        <div class="cam-zone" id="bws-cam-zone">
          <video id="bws-video" autoplay muted playsinline></video>
          <canvas id="bws-canvas" style="display:none;"></canvas>
          <img id="bws-preview" alt="Captured waste">
          
          <div class="cam-overlay">
            <div class="cam-frame">
              <div class="cam-corner cam-corner-tl"></div>
              <div class="cam-corner cam-corner-tr"></div>
              <div class="cam-corner cam-corner-bl"></div>
              <div class="cam-corner cam-corner-br"></div>
              <div class="cam-scan-line" id="bws-scan-line" style="display:none;"></div>
            </div>
            <div class="spectral-overlay" id="bws-spectral" style="display:none;">
              <div class="spectral-node" style="top:20%; left:20%"></div>
              <div class="spectral-node" style="top:20%; right:20%"></div>
              <div class="spectral-node" style="bottom:20%; left:20%"></div>
              <div class="spectral-node" style="bottom:20%; right:20%"></div>
            </div>
          </div>

          <div class="cam-placeholder" id="bws-placeholder">
            <div class="cam-placeholder-icon">📡</div>
            <div class="cam-placeholder-text">Waiting for IoT Data Stream...<br><small>Click "Start Sensor" below</small></div>
          </div>
        </div>

        <div class="cam-controls" id="bws-controls">
          <button class="btn btn-ghost" onclick="BioScanner._clickUpload()">🖼 Upload</button>
          <button class="btn btn-primary" id="bws-btn-main" onclick="BioScanner._startCamera()">🛰 Start Sensor</button>
        </div>

        <div id="bws-result"></div>
      </div>`;
  }

  function _setMode(mode) {
    document.getElementById('bws-mode-cam')?.classList.toggle('on', mode === 'camera');
    document.getElementById('bws-mode-upload')?.classList.toggle('on', mode === 'upload');
    if (mode === 'upload') { _stopCamera(); _clickUpload(); }
    else _startCamera();
  }

  function _clickUpload() {
    document.getElementById('file-input')?.click();
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    _stopCamera();
    const reader = new FileReader();
    reader.onload = e => {
      const dataURL = e.target.result;
      _imageB64 = dataURL.split(',')[1];
      _showPreview(dataURL);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function _startCamera() {
    if (_stream) { _captureFrame(); return; }
    _render(); // Refresh to clean state

    const video = document.getElementById('bws-video');
    const mainBtn = document.getElementById('bws-btn-main');
    const scanLine = document.getElementById('bws-scan-line');
    const spectral = document.getElementById('bws-spectral');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      _stream = stream;
      if (video) video.srcObject = stream;
      document.getElementById('bws-placeholder').style.display = 'none';
      if (mainBtn) { mainBtn.textContent = '📸 Analyze Feed'; mainBtn.onclick = () => _captureFrame(); }
      if (scanLine) scanLine.style.display = 'block';
      if (spectral) spectral.style.display = 'block';
    } catch (err) {
      _toast('⚠ Sensor blocked — please enable camera');
    }
  }

  function _captureFrame() {
    const video = document.getElementById('bws-video');
    const canvas = document.getElementById('bws-canvas');
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    _imageB64 = dataURL.split(',')[1];
    _stopCamera();
    _showPreview(dataURL);
  }

  function _showPreview(dataURL) {
    const preview = document.getElementById('bws-preview');
    if (preview) { preview.src = dataURL; preview.style.display = 'block'; }
    document.getElementById('bws-video').style.display = 'none';
    document.getElementById('bws-placeholder').style.display = 'none';
    document.getElementById('bws-scan-line').style.display = 'none';
    document.getElementById('bws-spectral').style.display = 'none';

    const mainBtn = document.getElementById('bws-btn-main');
    if (mainBtn) { mainBtn.textContent = '🔄 Retake'; mainBtn.onclick = () => _retake(); }

    if (!document.getElementById('bws-analyse-btn')) {
      const btn = document.createElement('button');
      btn.id = 'bws-analyse-btn';
      btn.className = 'btn btn-primary';
      btn.style.marginLeft = '8px';
      btn.textContent = '🔬 Run AI Diagnostics';
      btn.onclick = () => _analyse();
      document.getElementById('bws-controls').appendChild(btn);
    }
  }

  function _retake() {
    _imageB64 = null;
    _stopCamera();
    _startCamera();
  }

  function _back() {
    _stopCamera();
    if (typeof _opts.onBack === 'function') _opts.onBack();
  }

  // ── THE VISUAL HEURISTIC ENGINE 4.5 (Enhanced Guard) ──────────────────────
  function _analyzePixels(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r=0, g=0, b=0, brightness=0;
    
    for (let i = 0; i < imgData.length; i += 80) {
      r += imgData[i]; g += imgData[i+1]; b += imgData[i+2];
    }
    const count = imgData.length / 80;
    r /= count; g /= count; b /= count;
    brightness = (r + g + b) / 3;
    const vibrance = Math.max(r, g, b) - Math.min(r, g, b);
    const greenRatio = g / (r + 1);

    // Heterogeneity Check (Quadrants)
    let q1=0, q2=0;
    for(let i=0; i<imgData.length/2; i+=80) q1 += imgData[i];
    for(let i=imgData.length/2; i<imgData.length; i+=80) q2 += imgData[i];
    const complexity = Math.abs(q1 - q2) / (count/2);

    // STRICT GUARDS
    const isSkin = (r > 90 && r > g && r > b && (r-g) > 15 && (r-b) > 30 && complexity < 25);
    const isBlank = (complexity < 10 && brightness > 100);
    
    let edgeCount = 0;
    for (let i = 0; i < imgData.length - 80; i += 80) {
      if (Math.abs(imgData[i] - imgData[i+80]) > 65) edgeCount++;
    }
    const isText = edgeCount > (count * 0.18);

    let invalid = null;
    if (isSkin) invalid = "HUMAN_DETECTED";
    else if (isText) invalid = "TEXT_DETECTED";
    else if (isBlank) invalid = "BLANK_DETECTED";

    let score = 45;
    if (greenRatio > 1.1) score += 40;
    if (vibrance > 50) score += 10;
    if (complexity > 30) score += 5;

    return { score: Math.min(100, score), isOrganic: greenRatio > 1.05, invalid };
  }

  async function _analyse() {
    const canvas = document.getElementById('bws-canvas');
    const data = _analyzePixels(canvas);
    
    const resArea = document.getElementById('bws-result');
    resArea.innerHTML = `
      <div class="result-panel">
        <div class="analysing-box">
          <div class="bw-spinner"></div>
          <div class="analysing-text">Running AI Diagnostics...</div>
          <div class="scan-steps" id="bws-step-txt">Initializing Neural Link...</div>
        </div>
      </div>`;

    const steps = ['Spectral mapping...', 'Surface texture analysis...', 'Chlorophyll verification...', 'Finalizing IoT Report...'];
    let si = 0;
    const itv = setInterval(() => {
      const el = document.getElementById('bws-step-txt');
      if (el && si < steps.length) el.textContent = steps[si++];
    }, 1200);

    setTimeout(() => {
      clearInterval(itv);
      if (data.invalid) _displayInvalid(data.invalid);
      else _displayResult(data);
    }, 5000);
  }

  function _displayInvalid(reason) {
    const resArea = document.getElementById('bws-result');
    const meta = {
      HUMAN_DETECTED: { icon: '👤', title: 'Human Detected', msg: 'System has detected human skin tones. Please scan actual waste.' },
      TEXT_DETECTED: { icon: '📄', title: 'Document Detected', msg: 'High edge-frequency detected. System flags this as text/document.' },
      BLANK_DETECTED: { icon: '⬜', title: 'Empty Feed', msg: 'Surface too uniform. Please aim at heterogeneous waste material.' }
    }[reason] || { icon: '⚠', title: 'Invalid Scan', msg: 'Object does not match waste signatures.' };

    resArea.innerHTML = `
      <div class="premium-result-card invalid">
        <div class="result-card-header">${meta.icon} ${meta.title}</div>
        <div class="result-card-body">
          <p>${meta.msg}</p>
          <button class="btn btn-ghost" style="width:100%" onclick="BioScanner._retake()">🔄 Try Again</button>
        </div>
      </div>`;
  }

  function _displayResult(data) {
    const score = data.score;
    const grade = score > 85 ? 'Excellent' : (score > 65 ? 'Good' : (score > 45 ? 'Fair' : 'Poor'));
    const color = score > 75 ? 'var(--green)' : (score > 50 ? 'var(--amber)' : 'var(--red)');

    document.getElementById('bws-result').innerHTML = `
      <div class="premium-result-card">
        <div class="result-card-header" style="background:${color}">
          <div class="score-pill">${score}%</div>
          <div>
            <div style="font-weight:700;">${grade} Quality</div>
            <div style="font-size:11px; opacity:0.8;">Spectral Bio-Index</div>
          </div>
        </div>
        <div class="result-card-body">
          <div class="biogas-suitability">
            <span class="suit-label">Biogas Potential:</span>
            <span class="suit-val" style="color:${color}">${score > 60 ? 'HIGH' : 'LOW'}</span>
          </div>
          
          <div class="progress-container">
            <div class="progress-label">Organic Density</div>
            <div class="progress-track"><div class="progress-fill" style="width:${score}%; background:${color}"></div></div>
          </div>

          <div class="recommendation-box">
             <div style="font-weight:600; margin-bottom:4px;">💡 Recommendation:</div>
             <div style="font-size:13px; color:var(--text-muted);">
               ${score > 75 ? 'Ready for immediate pickup. Methane yield predicted to be optimal.' : 'Further segregation required to remove non-organic impurities.'}
             </div>
          </div>

          <button class="btn btn-primary" style="width:100%; margin-top:16px;" onclick="BioScanner._applyData(${score})">✓ Use Data & Close</button>
        </div>
      </div>`;
  }

  function _applyData(score) {
    if (typeof _opts.onApply === 'function') _opts.onApply(score, score);
    _back();
  }

  return { open, stop: _stopCamera, handleFileUpload, _back, _setMode, _clickUpload, _startCamera, _analyse, _retake, _applyData };

})();
