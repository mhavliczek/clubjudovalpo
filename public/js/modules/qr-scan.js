/**
 * Módulo de Escáner QR para Administrador
 */

const QRSCAN_API_BASE = (typeof API_BASE !== 'undefined') ? API_BASE : '';
const QRSCAN_getToken = (typeof getToken !== 'undefined') ? getToken : () => localStorage.getItem('token');

const QRScanModule = {
  stream: null,
  scanInterval: null,
  isScanning: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('scanQRBtn')?.addEventListener('click', () => this.showScanModal());
    document.getElementById('qrManualInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.processManualQR();
      }
    });
  },

  async startCamera() {
    const video = document.getElementById('qrCamera');
    const canvas = document.getElementById('qrCanvas');
    const statusDiv = document.getElementById('cameraStatus');
    const startBtn = document.getElementById('startCameraBtn');
    const stopBtn = document.getElementById('stopCameraBtn');

    if (!video || !canvas) return;

    try {
      statusDiv.textContent = '⏳ Solicitando permiso de cámara...';
      startBtn.disabled = true;

      // Request camera with rear camera preference for mobile
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use rear camera on mobile
      });

      video.srcObject = this.stream;
      video.style.display = 'block';
      startBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';
      statusDiv.textContent = '✅ Cámara activa. Apunta al QR...';

      // Start scanning
      this.isScanning = true;
      this.scanFromCamera(video, canvas);

    } catch (error) {
      console.error('Error accessing camera:', error);
      statusDiv.textContent = '❌ Error: ' + error.message;
      startBtn.disabled = false;
    }
  },

  stopCamera() {
    const video = document.getElementById('qrCamera');
    const statusDiv = document.getElementById('cameraStatus');
    const startBtn = document.getElementById('startCameraBtn');
    const stopBtn = document.getElementById('stopCameraBtn');

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.isScanning = false;

    if (video) {
      video.style.display = 'none';
      video.srcObject = null;
    }

    if (statusDiv) {
      statusDiv.textContent = 'Cámara detenida';
    }

    if (startBtn) {
      startBtn.style.display = 'inline-block';
      startBtn.disabled = false;
    }

    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
  },

  scanFromCamera(video, canvas) {
    const ctx = canvas.getContext('2d');

    this.scanInterval = setInterval(() => {
      if (!this.isScanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        console.log('QR Code found:', code.data);
        
        // Try to parse QR data
        try {
          const qrData = JSON.parse(code.data);
          if (qrData.type === 'judo_member') {
            this.scanQR(qrData);
            this.stopCamera();
          }
        } catch (e) {
          console.log('QR data is not valid JSON');
        }
      }
    }, 500); // Scan every 500ms
  },

  showScanModal() {
    const modal = document.createElement('div');
    modal.id = 'qrScanModal';
    modal.className = 'qr-scan-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = 'white';
    modal.style.padding = '20px';
    modal.style.borderRadius = '15px';
    modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    modal.style.zIndex = '10000';
    modal.style.width = '90%';
    modal.style.maxWidth = '500px';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #1976d2; font-size: 18px;">📱 Escanear QR</h3>
        <button class="btn" onclick="document.getElementById('qrScanModal').remove()" style="padding: 5px 10px; font-size: 20px; line-height: 1;">×</button>
      </div>

      <!-- Camera Section -->
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 10px; text-align: center;">
        <p style="color: #666; margin-bottom: 10px; font-weight: bold;">📷 Opción 1: Escanear con cámara</p>
        <video id="qrCamera" autoplay playsinline style="width: 100%; max-width: 100%; border-radius: 10px; display: none; margin: 0 auto 10px; background: #000;"></video>
        <canvas id="qrCanvas" style="display: none;"></canvas>
        <div id="cameraStatus" style="margin: 10px 0; color: #666; font-size: 14px;"></div>
        <button class="btn btn-success" id="startCameraBtn" onclick="QRScanModule.startCamera()" style="margin-bottom: 10px; min-height: 44px;">📷 Activar Cámara</button>
        <button class="btn" id="stopCameraBtn" onclick="QRScanModule.stopCamera()" style="display: none; margin-bottom: 10px; min-height: 44px;">⏹️ Detener Cámara</button>
        <p style="font-size: 12px; color: #999; margin: 5px 0 0 0;">Apunta la cámara al QR del miembro</p>
      </div>

      <!-- Divider -->
      <div style="text-align: center; margin: 15px 0; color: #999; font-size: 14px;">
        <span>─ O ─</span>
      </div>

      <!-- Manual Input -->
      <div style="margin-bottom: 20px;">
        <p style="color: #666; margin-bottom: 10px; font-weight: bold;">📝 Opción 2: Ingreso manual</p>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333; font-size: 14px;">Member ID:</label>
        <input type="number" id="manualMemberId" placeholder="Ej: 123" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px; font-size: 16px;" inputmode="numeric">

        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333; font-size: 14px;">RUT:</label>
        <input type="text" id="manualRut" placeholder="Ej: 12.345.678-9" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;" inputmode="text">
      </div>

      <!-- Result Display -->
      <div id="scanResult" style="display: none; margin-top: 20px; padding: 15px; border-radius: 10px;"></div>

      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn" onclick="document.getElementById('qrScanModal').remove()" style="flex: 1; min-height: 44px; padding: 12px 20px;">
          ❌ Cerrar
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  },

  async processManualQR() {
    const memberId = document.getElementById('manualMemberId').value;
    const rut = document.getElementById('manualRut').value;

    if (!memberId || !rut) {
      alert('⚠️ Ingresa Member ID y RUT');
      return;
    }

    const qrData = {
      type: 'judo_member',
      member_id: parseInt(memberId),
      rut: rut,
      timestamp: new Date().toISOString()
    };

    await this.scanQR(qrData);
  },

  async scanQR(qrData) {
    const resultDiv = document.getElementById('scanResult');
    if (!resultDiv) return;

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="text-align: center; color: #666;">⏳ Validando...</p>';

    try {
      const res = await fetch(`${QRSCAN_API_BASE}/api/qr/scan-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + QRSCAN_getToken()
        },
        body: JSON.stringify({ qr_data: qrData })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al validar QR');
      }

      // Mostrar resultado
      this.showScanResult(result);

    } catch (error) {
      console.error('Error scanning QR:', error);
      resultDiv.innerHTML = `
        <div style="background: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #f44336;">
          <p style="margin: 0; color: #c62828;"><strong>❌ Error:</strong> ${error.message}</p>
        </div>
      `;
    }
  },

  showScanResult(result) {
    const resultDiv = document.getElementById('scanResult');
    if (!resultDiv) return;

    const member = result.member;
    const attendance = result.attendance || {};

    let statusHtml = '';
    
    if (attendance.registered) {
      statusHtml = `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50; margin-bottom: 15px;">
          <p style="margin: 0; color: #2e7d32; font-size: 16px;"><strong>✅ Asistencia Registrada</strong></p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Fecha: ${attendance.date}</p>
        </div>
      `;
    } else if (attendance.already_registered) {
      statusHtml = `
        <div style="background: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; margin-bottom: 15px;">
          <p style="margin: 0; color: #f57c00; font-size: 16px;"><strong>⚠️ Ya registrado hoy</strong></p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Fecha: ${attendance.date}</p>
        </div>
      `;
    } else if (attendance.error) {
      statusHtml = `
        <div style="background: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; margin-bottom: 15px;">
          <p style="margin: 0; color: #f57c00; font-size: 16px;"><strong>⚠️ Miembro válido, pero error en asistencia</strong></p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${attendance.error}</p>
        </div>
      `;
    }

    const photoHtml = member.photo ?
      `<img src="${member.photo}" alt="${member.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 3px solid #4caf50; margin-bottom: 10px;">` :
      `<div style="width: 100px; height: 100px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; border: 3px solid #4caf50;">
        <span style="font-size: 40px;">👤</span>
      </div>`;

    resultDiv.innerHTML = `
      ${statusHtml}
      <div style="text-align: center; padding: 15px; background: #fff; border-radius: 5px;">
        ${photoHtml}
        <h4 style="margin: 10px 0; color: #333;">${member.name}</h4>
        <p style="margin: 5px 0; color: #666;"><strong>RUT:</strong> ${member.rut}</p>
        <p style="margin: 5px 0; color: #666;"><strong>Estado:</strong> ${member.status === 'active' ? '✅ Activo' : '❌ Inactivo'}</p>
        ${member.guardian ? `<p style="margin: 5px 0; color: #666;"><strong>Apoderado:</strong> ${member.guardian}</p>` : ''}
      </div>
    `;

    // Auto-close after 5 seconds if successful
    if (attendance.registered || attendance.already_registered) {
      setTimeout(() => {
        document.getElementById('qrScanModal')?.remove();
      }, 5000);
    }
  }
};

window.QRScanModule = QRScanModule;
