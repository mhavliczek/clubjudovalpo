/**
 * Módulo de Escáner QR para Administrador
 */

const QRSCAN_API_BASE = (typeof API_BASE !== 'undefined') ? API_BASE : '';
const QRSCAN_getToken = (typeof getToken !== 'undefined') ? getToken : () => localStorage.getItem('token');

const QRScanModule = {
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

  showScanModal() {
    const modal = document.createElement('div');
    modal.id = 'qrScanModal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = 'white';
    modal.style.padding = '30px';
    modal.style.borderRadius = '15px';
    modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    modal.style.zIndex = '10000';
    modal.style.minWidth = '400px';
    modal.style.maxWidth = '90%';
    
    modal.innerHTML = `
      <h3 style="margin: 0 0 20px 0; text-align: center; color: #1976d2;">📱 Escanear QR de Asistencia</h3>
      
      <!-- Camera Section (Future) -->
      <div style="margin-bottom: 20px; padding: 20px; background: #f5f5f5; border-radius: 10px; text-align: center;">
        <p style="color: #666; margin-bottom: 15px;">📷 Opción 1: Escanear con cámara (próximamente)</p>
        <button class="btn" disabled style="opacity: 0.5; cursor: not-allowed;">📷 Activar Cámara</button>
      </div>
      
      <!-- Manual Input -->
      <div style="margin-bottom: 20px;">
        <p style="color: #666; margin-bottom: 10px;">📝 Opción 2: Ingresar datos manualmente</p>
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Member ID:</label>
        <input type="number" id="manualMemberId" placeholder="Ej: 123" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
        
        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">RUT:</label>
        <input type="text" id="manualRut" placeholder="Ej: 12.345.678-9" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
      </div>
      
      <!-- Result Display -->
      <div id="scanResult" style="display: none; margin-top: 20px; padding: 15px; border-radius: 10px;"></div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-success" onclick="QRScanModule.processManualQR()" style="flex: 1;">
          ✅ Validar y Registrar
        </button>
        <button class="btn" onclick="document.getElementById('qrScanModal').remove()" style="flex: 1;">
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
