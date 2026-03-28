/* ===================================
   CLUB DE JUDO - DOCUMENTS MODULE
   =================================== */

// ==========================================
// DOCUMENTOS ADMINISTRATIVOS (ESTATUTOS)
// ==========================================

// Cargar documentos administrativos
async function loadDocuments() {
  try {
    const res = await fetch(`${API}/api/documents`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const documents = await res.json();
    renderDocuments(documents);
  } catch (e) {
    document.getElementById('documentsList').innerHTML = '<p>Error: ' + e.message + '</p>';
  }
}

// Renderizar lista de documentos
function renderDocuments(documents) {
  const container = document.getElementById('documentsList');
  if (!container) return;

  if (documents.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay documentos administrativos subidos</p>';
    return;
  }

  const categoryNames = {
    'estatuto': '📜 Estatuto',
    'reglamento': '📋 Reglamento',
    'acta': '📝 Acta',
    'circulares': '📢 Circular',
    'otro': '📄 Otro'
  };

  let html = `
    <div style="display: grid; gap: 15px;">
      ${documents.map(doc => `
        <div style="padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #0066cc;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="font-size: 20px;">📄</span>
                <strong style="font-size: 16px;">${doc.title}</strong>
                <span style="background: #0066cc; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">${categoryNames[doc.category] || doc.category}</span>
              </div>
              ${doc.description ? `<p style="color: #666; margin: 5px 0 10px 30px;">${doc.description}</p>` : ''}
              <div style="margin-left: 30px; display: flex; gap: 15px; font-size: 12px; color: #999;">
                <span>📅 ${formatDateChile(doc.created_at?.split('T')[0])}</span>
                <span>📁 ${doc.file_name}</span>
                ${doc.created_by_email ? `<span>✍️ ${doc.created_by_email}</span>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button onclick="downloadDocument('${doc.file_path}', '${doc.file_name || 'documento'}')" class="btn btn-sm" style="background: #28a745; color: white;">📥 Descargar</button>
              <button class="btn btn-sm" onclick="editDocument(${doc.id})">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="deleteDocument(${doc.id})">🗑️</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = html;
}

// Mostrar formulario de documento
function showDocumentForm() {
  document.getElementById('documentForm').classList.remove('hidden');
  document.getElementById('documentFormTitle').textContent = 'Subir Nuevo Documento';
  document.getElementById('editDocumentId').value = '';
  document.getElementById('docTitle').value = '';
  document.getElementById('docDescription').value = '';
  document.getElementById('docCategory').value = 'estatuto';
  document.getElementById('docFile').value = '';
}

// Ocultar formulario de documento
function hideDocumentForm() {
  document.getElementById('documentForm').classList.add('hidden');
}

// Guardar documento
async function saveDocument() {
  const title = document.getElementById('docTitle').value;
  const description = document.getElementById('docDescription').value;
  const category = document.getElementById('docCategory').value;
  const fileInput = document.getElementById('docFile');
  const editId = document.getElementById('editDocumentId').value;

  if (!title) {
    alert('El título es requerido');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description || '');
  formData.append('category', category);

  if (fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }

  try {
    const url = editId ? `${API}/api/documents/${editId}` : `${API}/api/documents`;
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: formData
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert(editId ? 'Documento actualizado' : 'Documento subido exitosamente');
    hideDocumentForm();
    loadDocuments();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Editar documento
async function editDocument(id) {
  try {
    const res = await fetch(`${API}/api/documents/${id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const doc = await res.json();

    document.getElementById('documentForm').classList.remove('hidden');
    document.getElementById('documentFormTitle').textContent = 'Editar Documento';
    document.getElementById('editDocumentId').value = doc.id;
    document.getElementById('docTitle').value = doc.title;
    document.getElementById('docDescription').value = doc.description || '';
    document.getElementById('docCategory').value = doc.category;
    document.getElementById('docFile').value = '';
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Eliminar documento
async function deleteDocument(id) {
  if (!confirm('¿Está seguro que desea eliminar este documento?')) return;

  try {
    const res = await fetch(`${API}/api/documents/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert('Documento eliminado');
    loadDocuments();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ==========================================
// DOCUMENTOS DE TORNEOS
// ==========================================

// Cargar documentos de torneos
async function loadTournamentDocuments() {
  try {
    const res = await fetch(`${API}/api/documents/tournaments`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const documents = await res.json();
    renderTournamentDocuments(documents);
  } catch (e) {
    document.getElementById('tournamentDocumentsList').innerHTML = '<p>Error: ' + e.message + '</p>';
  }
}

// Renderizar lista de documentos de torneos
function renderTournamentDocuments(documents) {
  const container = document.getElementById('tournamentDocumentsList');
  if (!container) return;

  if (documents.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay documentos de torneos subidos</p>';
    return;
  }

  const categoryNames = {
    'bases': '📋 Bases',
    'inscripcion': '📝 Inscripción',
    'resultado': '🏆 Resultados',
    'otro': '📄 Otro'
  };

  let html = `
    <div style="display: grid; gap: 15px;">
      ${documents.map(doc => `
        <div style="padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #ffc107;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="font-size: 20px;">🏆</span>
                <strong style="font-size: 16px;">${doc.title}</strong>
                <span style="background: #ffc107; color: black; padding: 2px 8px; border-radius: 3px; font-size: 11px;">${categoryNames[doc.category] || doc.category}</span>
              </div>
              ${doc.tournament_name ? `<p style="color: #0066cc; margin: 5px 0 5px 30px; font-weight: 500;">🏅 Torneo: ${doc.tournament_name}</p>` : ''}
              ${doc.description ? `<p style="color: #666; margin: 5px 0 10px 30px;">${doc.description}</p>` : ''}
              <div style="margin-left: 30px; display: flex; gap: 15px; font-size: 12px; color: #999;">
                ${doc.tournament_date ? `<span>📅 ${formatDateChile(doc.tournament_date)}</span>` : ''}
                <span>📁 ${doc.file_name}</span>
                ${doc.created_by_email ? `<span>✍️ ${doc.created_by_email}</span>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button onclick="downloadDocument('${doc.file_path}', '${doc.file_name || 'documento'}')" class="btn btn-sm" style="background: #28a745; color: white;">📥 Descargar</button>
              <button class="btn btn-sm" onclick="editTournamentDocument(${doc.id})">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="deleteTournamentDocument(${doc.id})">🗑️</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = html;
}

// Mostrar formulario de documento de torneo
function showTournamentDocumentForm() {
  document.getElementById('tournamentDocumentForm').classList.remove('hidden');
  document.getElementById('tournamentDocumentFormTitle').textContent = 'Subir Nuevo Documento de Torneo';
  document.getElementById('editTournamentDocumentId').value = '';
  document.getElementById('tournamentDocTitle').value = '';
  document.getElementById('tournamentDocDescription').value = '';
  document.getElementById('tournamentDocName').value = '';
  document.getElementById('tournamentDocDate').value = '';
  document.getElementById('tournamentDocCategory').value = 'bases';
  document.getElementById('tournamentDocFile').value = '';
}

// Ocultar formulario de documento de torneo
function hideTournamentDocumentForm() {
  document.getElementById('tournamentDocumentForm').classList.add('hidden');
}

// Guardar documento de torneo
async function saveTournamentDocument() {
  const title = document.getElementById('tournamentDocTitle').value;
  const description = document.getElementById('tournamentDocDescription').value;
  const tournamentName = document.getElementById('tournamentDocName').value;
  const tournamentDate = document.getElementById('tournamentDocDate').value;
  const category = document.getElementById('tournamentDocCategory').value;
  const fileInput = document.getElementById('tournamentDocFile');
  const editId = document.getElementById('editTournamentDocumentId').value;

  if (!title) {
    alert('El título es requerido');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description || '');
  formData.append('tournament_name', tournamentName || '');
  formData.append('tournament_date', tournamentDate || '');
  formData.append('category', category);

  if (fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }

  try {
    const url = editId ? `${API}/api/documents/tournaments/${editId}` : `${API}/api/documents/tournaments`;
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: formData
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert(editId ? 'Documento de torneo actualizado' : 'Documento de torneo subido exitosamente');
    hideTournamentDocumentForm();
    loadTournamentDocuments();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Editar documento de torneo
async function editTournamentDocument(id) {
  try {
    const res = await fetch(`${API}/api/documents/tournaments/${id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const doc = await res.json();

    document.getElementById('tournamentDocumentForm').classList.remove('hidden');
    document.getElementById('tournamentDocumentFormTitle').textContent = 'Editar Documento de Torneo';
    document.getElementById('editTournamentDocumentId').value = doc.id;
    document.getElementById('tournamentDocTitle').value = doc.title;
    document.getElementById('tournamentDocDescription').value = doc.description || '';
    document.getElementById('tournamentDocName').value = doc.tournament_name || '';
    document.getElementById('tournamentDocDate').value = doc.tournament_date || '';
    document.getElementById('tournamentDocCategory').value = doc.category;
    document.getElementById('tournamentDocFile').value = '';
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Eliminar documento de torneo
async function deleteTournamentDocument(id) {
  if (!confirm('¿Está seguro que desea eliminar este documento?')) return;

  try {
    const res = await fetch(`${API}/api/documents/tournaments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert('Documento eliminado');
    loadTournamentDocuments();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ==========================================
// VISTA DE MIEMBROS - DOCUMENTOS
// ==========================================

// Cargar documentos para el perfil del miembro
async function loadMemberDocuments() {
  try {
    // Cargar documentos administrativos
    const resDocs = await fetch(`${API}/api/documents`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const documents = await resDocs.json();
    renderMemberDocuments(Array.isArray(documents) ? documents : [], 'memberDocumentsList');

    // Cargar documentos de torneos
    const resTournamentDocs = await fetch(`${API}/api/documents/tournaments`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const tournamentDocuments = await resTournamentDocs.json();
    renderMemberDocuments(Array.isArray(tournamentDocuments) ? tournamentDocuments : [], 'memberTournamentDocumentsList', true);
  } catch (e) {
    console.error('Error loading member documents:', e);
    // Mostrar mensajes de error amigables
    document.getElementById('memberDocumentsList').innerHTML = '<p style="color: #999; text-align: center; padding: 15px;">No hay documentos disponibles</p>';
    document.getElementById('memberTournamentDocumentsList').innerHTML = '<p style="color: #999; text-align: center; padding: 15px;">No hay documentos de torneos disponibles</p>';
  }
}

// Renderizar documentos para miembros
function renderMemberDocuments(documents, containerId, isTournament = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (documents.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 15px;">No hay documentos disponibles</p>';
    return;
  }

  const categoryNames = {
    'estatuto': '📜 Estatuto',
    'reglamento': '📋 Reglamento',
    'acta': '📝 Acta',
    'circulares': '📢 Circular',
    'otro': '📄 Otro',
    'bases': '📋 Bases',
    'inscripcion': '📝 Inscripción',
    'resultado': '🏆 Resultados'
  };

  let html = `
    <div style="display: grid; gap: 10px;">
      ${documents.map(doc => `
        <div style="padding: 12px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${isTournament ? '#ffc107' : '#0066cc'};">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap;">
                <span style="font-size: 18px;">${isTournament ? '🏆' : '📄'}</span>
                <strong>${doc.title}</strong>
                <span style="background: ${isTournament ? '#ffc107' : '#0066cc'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${categoryNames[doc.category] || doc.category}</span>
              </div>
              ${doc.tournament_name ? `<p style="color: #0066cc; margin: 3px 0 0 26px; font-size: 12px;">🏅 ${doc.tournament_name}</p>` : ''}
              ${doc.description ? `<p style="color: #666; margin: 3px 0 0 26px; font-size: 11px;">${doc.description}</p>` : ''}
              <div style="margin-left: 26px; font-size: 11px; color: #999;">
                <span>📅 ${formatDateChile(doc.created_at?.split('T')[0])}</span>
              </div>
            </div>
            <button onclick="downloadDocument('${doc.file_path || ''}', '${doc.file_name || 'documento'}')" class="btn btn-sm" style="background: #28a745; color: white; font-size: 11px; padding: 4px 8px; white-space: nowrap;">📥 Descargar</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = html;
}

// Función para descargar documento
async function downloadDocument(filePath, fileName) {
  if (!filePath) {
    alert('El archivo no está disponible');
    return;
  }
  
  try {
    // Obtener el blob del archivo
    const response = await fetch(filePath);
    if (!response.ok) throw new Error('Error al descargar el archivo');
    
    const blob = await response.blob();
    
    // Crear URL temporal
    const url = window.URL.createObjectURL(blob);
    
    // Crear enlace de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Limpiar
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al descargar:', error);
    // Fallback: abrir en nueva pestaña
    window.open(filePath, '_blank');
  }
}
