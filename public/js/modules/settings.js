/**
 * Módulo de Configuración del Club
 */

// Use existing API_BASE or define empty string
const SETTINGS_API_BASE = (typeof API_BASE !== 'undefined') ? API_BASE : '';

// Use existing getToken or create new one
const SETTINGS_getToken = (typeof getToken !== 'undefined') ? getToken : () => localStorage.getItem('token');

const SettingsModule = {
  init() {
    this.loadLogo();
    this.loadDirector();
    this.loadSignature();
  },

  async loadLogo() {
    try {
      const res = await fetch(`${SETTINGS_API_BASE}/api/settings/logo`);
      const data = await res.json();

      const img = document.getElementById('currentLogo');
      const noLogoText = document.getElementById('noLogoText');

      if (data.url) {
        img.src = data.url;
        img.style.display = 'block';
        noLogoText.style.display = 'none';
      } else {
        img.style.display = 'none';
        noLogoText.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  },

  async loadDirector() {
    try {
      const res = await fetch(`${SETTINGS_API_BASE}/api/settings/director`);
      const data = await res.json();

      const input = document.getElementById('clubDirectorInput');
      if (input && data.value) {
        input.value = data.value;
      }
    } catch (error) {
      console.error('Error loading director:', error);
    }
  },

  async loadSignature() {
    try {
      const res = await fetch(`${SETTINGS_API_BASE}/api/settings/director-signature`);
      const data = await res.json();

      const img = document.getElementById('currentSignature');
      const noSignatureText = document.getElementById('noSignatureText');

      if (data.url) {
        img.src = data.url;
        img.style.display = 'block';
        noSignatureText.style.display = 'none';
      } else {
        img.style.display = 'none';
        noSignatureText.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading signature:', error);
    }
  },

  async saveDirector() {
    const input = document.getElementById('clubDirectorInput');
    const directorName = input.value.trim();

    if (!directorName) {
      alert('⚠️ Ingresa el nombre del Director');
      return;
    }

    try {
      const res = await fetch(`${SETTINGS_API_BASE}/api/settings/director`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SETTINGS_getToken()
        },
        body: JSON.stringify({ value: directorName })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al guardar');
      }

      alert('✅ Nombre del Director guardado exitosamente\n\nEl nombre aparecerá en los certificados PDF');
    } catch (error) {
      console.error('Error saving director:', error);
      alert('❌ Error al guardar: ' + error.message);
    }
  },

  previewLogo() {
    const fileInput = document.getElementById('clubLogoInput');
    const file = fileInput.files[0];

    if (!file) {
      alert('⚠️ Primero selecciona un archivo');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('⚠️ El archivo es muy grande. El tamaño máximo es 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.maxWidth = '400px';
      img.style.maxHeight = '200px';
      img.style.border = '1px solid #ddd';
      img.style.borderRadius = '5px';
      img.style.display = 'block';
      img.style.margin = '10px auto';

      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.background = 'white';
      modal.style.padding = '20px';
      modal.style.borderRadius = '10px';
      modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      modal.style.zIndex = '10000';
      modal.innerHTML = `
        <h3 style="margin: 0 0 15px 0;">👁️ Vista Previa</h3>
        ${img.outerHTML}
        <p style="text-align: center; color: #666; margin: 10px 0;">
          ${file.name} - ${(file.size / 1024).toFixed(2)} KB
        </p>
        <div style="text-align: center; margin-top: 15px;">
          <button class="btn" onclick="this.closest('div[style*=fixed]').remove()">❌ Cerrar</button>
        </div>
      `;

      document.body.appendChild(modal);
    };
    reader.readAsDataURL(file);
  },

  async uploadClubLogo() {
    const fileInput = document.getElementById('clubLogoInput');
    const file = fileInput.files[0];

    console.log('📤 Starting upload...', file);

    if (!file) {
      alert('⚠️ Selecciona un archivo primero');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('⚠️ El archivo debe ser una imagen');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('⚠️ El archivo es muy grande. El tamaño máximo es 10 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    const uploadBtn = document.querySelector('button[onclick="uploadClubLogo()"]');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = '⏳ Procesando...';
    uploadBtn.disabled = true;

    try {
      console.log('📡 Sending request...');
      console.log('Token:', SETTINGS_getToken() ? 'Presente' : 'AUSENTE');

      const res = await fetch(`${SETTINGS_API_BASE}/api/settings/logo`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + SETTINGS_getToken()
        },
        body: formData
      });

      console.log('📥 Response status:', res.status);

      const result = await res.json();
      console.log('📄 Response:', result);

      if (!res.ok) {
        throw new Error(result.error || 'Error en la respuesta');
      }

      alert('✅ Logo procesado y subido exitosamente\n\nEl sistema ha redimensionado tu imagen a 400x200px\n\nEl logo ahora se usará en:\n• Certificados PDF\n• Documentos oficiales del club');
      fileInput.value = '';
      this.loadLogo();
    } catch (error) {
      console.error('❌ Upload error:', error);
      alert('❌ Error al subir: ' + error.message + '\n\nRevisa la consola (F12) para más detalles.');
    } finally {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
    }
  },

  previewSignature() {
    const fileInput = document.getElementById('directorSignatureInput');
    const file = fileInput.files[0];

    if (!file) {
      alert('⚠️ Primero selecciona un archivo');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ El archivo es muy grande. El tamaño máximo es 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.maxWidth = '300px';
      img.style.maxHeight = '150px';
      img.style.border = '1px solid #ddd';
      img.style.borderRadius = '5px';
      img.style.display = 'block';
      img.style.margin = '10px auto';

      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.background = 'white';
      modal.style.padding = '20px';
      modal.style.borderRadius = '10px';
      modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      modal.style.zIndex = '10000';
      modal.innerHTML = `
        <h3 style="margin: 0 0 15px 0;">👁️ Vista Previa de la Firma</h3>
        ${img.outerHTML}
        <p style="text-align: center; color: #666; margin: 10px 0;">
          ${file.name} - ${(file.size / 1024).toFixed(2)} KB
        </p>
        <div style="text-align: center; margin-top: 15px;">
          <button class="btn" onclick="this.closest('div[style*=fixed]').remove()">❌ Cerrar</button>
        </div>
      `;

      document.body.appendChild(modal);
    };
    reader.readAsDataURL(file);
  },

  async uploadDirectorSignature() {
    const fileInput = document.getElementById('directorSignatureInput');
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
      alert('⚠️ El archivo es muy grande. El tamaño máximo es 5 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('signature', file);

    const uploadBtn = document.querySelector('button[onclick="uploadDirectorSignature()"]');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = '⏳ Subiendo...';
    uploadBtn.disabled = true;

    try {
      const res = await fetch(`${SETTINGS_API_BASE}/api/settings/director-signature`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + SETTINGS_getToken()
        },
        body: formData
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al subir');
      }

      alert('✅ Firma subida exitosamente\n\nLa firma ahora aparecerá en:\n• Certificados de justificación\n• Curriculum deportivo PDF');
      fileInput.value = '';
      this.loadSignature();
    } catch (error) {
      console.error('Error uploading signature:', error);
      alert('❌ Error al subir: ' + error.message);
    } finally {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
    }
  }
};

window.SettingsModule = SettingsModule;

// Global wrapper functions for HTML onclick
window.uploadClubLogo = () => SettingsModule.uploadClubLogo();
window.previewLogo = () => SettingsModule.previewLogo();
window.saveClubDirector = () => SettingsModule.saveDirector();
window.uploadDirectorSignature = () => SettingsModule.uploadDirectorSignature();
window.previewSignature = () => SettingsModule.previewSignature();
