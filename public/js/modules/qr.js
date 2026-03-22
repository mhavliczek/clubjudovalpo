/**
 * Módulo de Código QR para Miembros
 */

const QR_API_BASE = (typeof API_BASE !== 'undefined') ? API_BASE : '';
const QR_getToken = (typeof getToken !== 'undefined') ? getToken : () => localStorage.getItem('token');

const QRModule = {
  currentMemberId: null,
  isGuardian: false,
  eventsBound: false,

  init(memberId, isGuardian = false) {
    // Reset previous state
    this.currentMemberId = null;
    this.isGuardian = false;
    
    // Clear QR code container
    const container = document.getElementById('qrCodeContainer');
    if (container) {
      container.innerHTML = '<p style="color: #999; text-align: center;">Cargando QR...</p>';
    }
    
    // Clear photo preview
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
      photoPreview.src = '';
      photoPreview.style.display = 'none';
    }
    
    // Clear file input
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
      photoInput.value = '';
    }
    
    // Set new member ID and initialize
    this.currentMemberId = memberId;
    this.isGuardian = isGuardian;
    
    // Remove previous event listeners to avoid duplicates
    this.unbindEvents();
    
    this.load();
    this.bindEvents();
  },

  unbindEvents() {
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    const generateBtn = document.getElementById('generateQRBtn');
    const photoInput = document.getElementById('photoInput');
    
    if (uploadBtn) uploadBtn.replaceWith(uploadBtn.cloneNode(true));
    if (generateBtn) generateBtn.replaceWith(generateBtn.cloneNode(true));
    if (photoInput) photoInput.replaceWith(photoInput.cloneNode(true));
    
    this.eventsBound = false;
  },

  bindEvents() {
    if (this.eventsBound) return; // Prevent duplicate binding
    
    document.getElementById('uploadPhotoBtn')?.addEventListener('click', () => this.uploadPhoto());
    document.getElementById('generateQRBtn')?.addEventListener('click', () => this.generateQR());
    document.getElementById('photoInput')?.addEventListener('change', () => this.previewPhoto());
    
    this.eventsBound = true;
  },

  async load() {
    if (!this.currentMemberId) return;

    try {
      const res = await fetch(`${QR_API_BASE}/api/qr/generate-qr/${this.currentMemberId}`, {
        headers: { 'Authorization': 'Bearer ' + QR_getToken() }
      });

      if (res.ok) {
        const data = await res.json();
        this.renderQR(data);
      }
    } catch (error) {
      console.error('Error loading QR:', error);
    }

    // Si es apoderado, cargar hijos
    if (this.isGuardian) {
      this.loadChildren();
    }
  },

  async loadChildren() {
    try {
      const res = await fetch(`${QR_API_BASE}/api/qr/my-children`, {
        headers: { 'Authorization': 'Bearer ' + QR_getToken() }
      });

      if (res.ok) {
        const children = await res.json();
        this.renderChildren(children);
      }
    } catch (error) {
      console.error('Error loading children:', error);
    }
  },

  renderQR(data) {
    const container = document.getElementById('qrCodeContainer');
    if (!container) return;

    const photoHtml = data.photo ? 
      `<img src="${data.photo}" alt="Foto" style="width: 120px; height: 120px; object-fit: cover; border-radius: 50%; border: 3px solid #0066cc; margin-bottom: 10px;">` :
      `<div style="width: 120px; height: 120px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; border: 3px solid #0066cc;">
        <span style="font-size: 40px;">👤</span>
      </div>`;

    container.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #fff; border-radius: 10px; border: 2px solid #0066cc;">
        ${photoHtml}
        <h3 style="margin: 10px 0; color: #0066cc;">${data.name}</h3>
        <p style="margin: 5px 0; color: #666;"><strong>RUT:</strong> ${data.rut || 'Sin RUT'}</p>
        
        ${data.qr_code ? `
          <div style="margin: 20px auto; width: fit-content;">
            <img src="${data.qr_code}" alt="QR Code" style="width: 200px; height: 200px;">
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            📱 Muestra este QR para registrar tu asistencia
          </p>
        ` : ''}
      </div>
    `;
  },

  renderChildren(children) {
    const container = document.getElementById('childrenListContainer');
    if (!container) return;

    if (children.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No hay hijos registrados</p>';
      return;
    }

    container.innerHTML = `
      <h4 style="margin: 20px 0 10px; color: #7b1fa2;">👨‍👩‍👧‍👦 Mis Hijos</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
        ${children.map(child => `
          <div style="padding: 15px; background: #f3e5f5; border-radius: 10px; border: 1px solid #9c27b0;">
            <div style="text-align: center;">
              ${child.photo ? 
                `<img src="${child.photo}" alt="${child.first_name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%; border: 2px solid #9c27b0; margin-bottom: 10px;">` :
                `<div style="width: 80px; height: 80px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; border: 2px solid #9c27b0;">
                  <span style="font-size: 30px;">👤</span>
                </div>`
              }
              <h5 style="margin: 10px 0; color: #7b1fa2;">${child.first_name} ${child.last_name}</h5>
              <p style="font-size: 12px; color: #666;">RUT: ${child.rut || 'Sin RUT'}</p>
              <button class="btn" onclick="QRModule.generateChildQR(${child.id})" style="margin-top: 10px; font-size: 12px;">
                📱 Generar QR
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async uploadPhoto() {
    const fileInput = document.getElementById('photoInput');
    const file = fileInput.files[0];

    if (!file) {
      alert('⚠️ Selecciona una imagen primero');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('⚠️ El archivo debe ser una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ El archivo es muy grande. Máximo 5 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('member_id', this.currentMemberId);

    const uploadBtn = document.getElementById('uploadPhotoBtn');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = '⏳ Subiendo...';
    uploadBtn.disabled = true;

    try {
      const res = await fetch(`${QR_API_BASE}/api/qr/upload-photo`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + QR_getToken()
        },
        body: formData
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al subir');
      }

      alert('✅ Foto subida exitosamente');
      fileInput.value = '';
      this.load(); // Recargar QR con nueva foto
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('❌ Error al subir: ' + error.message);
    } finally {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
    }
  },

  previewPhoto() {
    const fileInput = document.getElementById('photoInput');
    const file = fileInput.files[0];
    const preview = document.getElementById('photoPreview');

    if (file && preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  },

  async generateQR() {
    if (!this.currentMemberId) return;

    try {
      const res = await fetch(`${QR_API_BASE}/api/qr/generate-qr/${this.currentMemberId}`, {
        headers: { 'Authorization': 'Bearer ' + QR_getToken() }
      });

      if (res.ok) {
        const data = await res.json();
        this.renderQR(data);
        alert('✅ QR generado exitosamente');
      } else {
        const error = await res.json();
        alert('❌ Error: ' + error.error);
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('❌ Error: ' + error.message);
    }
  },

  async generateChildQR(memberId) {
    try {
      const res = await fetch(`${QR_API_BASE}/api/qr/generate-qr/${memberId}`, {
        headers: { 'Authorization': 'Bearer ' + QR_getToken() }
      });

      if (res.ok) {
        const data = await res.json();
        
        // Mostrar QR en modal
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'white';
        modal.style.padding = '30px';
        modal.style.borderRadius = '15px';
        modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
          <h3 style="margin: 0 0 20px 0; text-align: center; color: #7b1fa2;">📱 QR de ${data.name}</h3>
          <div style="text-align: center;">
            ${data.photo ? 
              `<img src="${data.photo}" alt="Foto" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 3px solid #7b1fa2; margin-bottom: 15px;">` : ''
            }
            <img src="${data.qr_code}" alt="QR Code" style="width: 250px; height: 250px; margin: 0 auto;">
            <p style="margin: 15px 0 5px; font-weight: bold; color: #666;">${data.name}</p>
            <p style="margin: 0; font-size: 12px; color: #999;">RUT: ${data.rut}</p>
          </div>
          <button class="btn" onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 20px; width: 100%;">
            ❌ Cerrar
          </button>
        `;

        document.body.appendChild(modal);
      } else {
        const error = await res.json();
        alert('❌ Error: ' + error.error);
      }
    } catch (error) {
      console.error('Error generating child QR:', error);
      alert('❌ Error: ' + error.message);
    }
  }
};

window.QRModule = QRModule;
