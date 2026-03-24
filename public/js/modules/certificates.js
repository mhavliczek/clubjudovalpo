/* ===================================
   CLUB DE JUDO - CERTIFICATES MODULE
   =================================== */

let certificates = [];

// Initialize CKEditor for certificate content
let certificateEditor = null;

function initCertificateEditor() {
  ClassicEditor
    .create(document.querySelector('#certificateContent'), {
      toolbar: [
        'heading', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'fontSize', 'fontColor', 'fontBackgroundColor', '|',
        'alignment', '|',
        'bulletedList', 'numberedList', '|',
        'indent', 'outdent', '|',
        'link', 'blockQuote', '|',
        'insertTable', '|',
        'undo', 'redo'
      ],
      language: 'es'
    })
    .then(editor => {
      certificateEditor = editor;
    })
    .catch(error => {
      console.error(error);
    });
}

// Load certificates list
async function loadCertificates() {
  try {
    const res = await fetch(`${API}/api/certificates`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });

    if (res.status === 403) {
      document.getElementById('certificatesList').innerHTML = '<p style="color: #666;">No tienes permisos para ver certificados.</p>';
      return;
    }

    if (!res.ok) throw new Error('Error al cargar certificados');

    certificates = await res.json();
    renderCertificates();
  } catch (error) {
    console.error('Error loading certificates:', error);
    document.getElementById('certificatesList').innerHTML = '<p style="color: #f44336;">Error al cargar certificados.</p>';
  }
}

// Render certificates list
function renderCertificates() {
  const container = document.getElementById('certificatesList');

  if (certificates.length === 0) {
    container.innerHTML = '<p style="color: #666;">No hay certificados creados aún.</p>';
    return;
  }

  container.innerHTML = certificates.map(cert => `
    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fafafa;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${cert.title}</h3>
      <div style="color: #666; margin-bottom: 10px;">
        Creado por: ${cert.creator_email} | ${new Date(cert.created_at).toLocaleDateString('es-ES')}
      </div>
      <div style="margin-bottom: 15px; max-height: 100px; overflow: hidden; color: #555;">
        ${cert.content.substring(0, 200)}${cert.content.length > 200 ? '...' : ''}
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-primary" onclick="downloadCertificate(${cert.id})">📄 Descargar PDF</button>
        <button class="btn" onclick="editCertificate(${cert.id})">✏️ Editar</button>
        <button class="btn btn-warning" onclick="deleteCertificate(${cert.id})">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');
}

// Show certificate form
function showCertificateForm(certificateId = null) {
  const form = document.getElementById('certificateForm');
  const titleInput = document.getElementById('certificateTitle');
  const contentTextarea = document.getElementById('certificateContent');
  const idInput = document.getElementById('certificateId');

  if (certificateId) {
    const cert = certificates.find(c => c.id === certificateId);
    if (cert) {
      titleInput.value = cert.title;
      contentTextarea.value = cert.content;
      idInput.value = certificateId;
      form.querySelector('h3').textContent = '📜 Editar Certificado Especial';
    }
  } else {
    titleInput.value = '';
    contentTextarea.value = '';
    idInput.value = '';
    form.querySelector('h3').textContent = '📜 Crear Certificado Especial';
  }

  // Initialize CKEditor if not already
  if (!certificateEditor) {
    initCertificateEditor();
  } else {
    certificateEditor.setData(contentTextarea.value);
  }

  form.classList.remove('hidden');
}

// Save certificate
async function saveCertificate() {
  const title = document.getElementById('certificateTitle').value.trim();
  const content = certificateEditor ? certificateEditor.getData() : document.getElementById('certificateContent').value;
  const id = document.getElementById('certificateId').value;

  if (!title || !content) {
    alert('Por favor, ingresa título y contenido.');
    return;
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API}/api/certificates/${id}` : `${API}/api/certificates`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ title, content })
    });

    if (!res.ok) throw new Error('Error al guardar certificado');

    hideForm('certificateForm');
    loadCertificates();
  } catch (error) {
    console.error('Error saving certificate:', error);
    alert('Error al guardar certificado: ' + error.message);
  }
}

// Download certificate PDF
async function downloadCertificate(id) {
  try {
    const res = await fetch(`${API}/api/certificates/${id}/pdf`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });

    if (!res.ok) throw new Error('Error al generar PDF');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificado_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading certificate:', error);
    alert('Error al descargar PDF: ' + error.message);
  }
}

// Edit certificate
function editCertificate(id) {
  showCertificateForm(id);
}

// Delete certificate
async function deleteCertificate(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este certificado?')) {
    return;
  }

  try {
    const res = await fetch(`${API}/api/certificates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });

    if (!res.ok) throw new Error('Error al eliminar certificado');

    loadCertificates();
  } catch (error) {
    console.error('Error deleting certificate:', error);
    alert('Error al eliminar certificado: ' + error.message);
  }
}

// Hide form
function hideForm(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.classList.add('hidden');
    if (formId === 'certificateForm') {
      // Reset form
      document.getElementById('certificateTitle').value = '';
      document.getElementById('certificateContent').value = '';
      document.getElementById('certificateId').value = '';
      if (certificateEditor) {
        certificateEditor.destroy();
        certificateEditor = null;
      }
    }
  }
}

// Initialize module
function initCertificates() {
  loadCertificates();
}