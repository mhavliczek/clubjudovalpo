/* ===================================
   CLUB DE JUDO - SCHOOLS MODULE
   =================================== */

// Show school form
function showSchoolForm() {
  document.getElementById('editSchoolId').value = '';
  document.getElementById('schoolName').value = '';
  document.getElementById('schoolType').value = 'particular';
  document.getElementById('schoolCommune').value = '';
  showForm('schoolForm');
}

// Load schools
async function loadSchools() {
  try {
    const res = await fetch(`${API}/api/schools`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const schools = await res.json();
    const container = document.getElementById('schoolsList');

    if (!Array.isArray(schools) || schools.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No hay colegios registrados</p>';
      return;
    }

    container.innerHTML = `
      <table>
        <tr><th>Nombre</th><th>Tipo</th><th>Comuna</th><th>Estado</th><th>Acciones</th></tr>
        ${schools.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.school_type === 'municipal' ? 'Municipal' : s.school_type === 'subvencionado' ? 'Subvencionado' : 'Particular'}</td>
            <td>${s.commune || '-'}</td>
            <td><span class="status-badge ${s.is_active === 1 ? 'status-active' : 'status-inactive'}">${s.is_active === 1 ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <button class="btn" onclick="editSchool(${s.id}, '${s.name.replace(/'/g, "\\'")}', '${s.school_type}', '${s.commune || ''}')" style="font-size: 12px; padding: 5px 10px;">✏️</button>
              <button class="btn ${s.is_active === 1 ? 'btn-warning' : 'btn-success'}" onclick="toggleSchoolStatus(${s.id})" style="font-size: 12px; padding: 5px 10px;">${s.is_active === 1 ? '🔓' : '🔒'}</button>
              <button class="btn btn-danger" onclick="deleteSchool(${s.id})" style="font-size: 12px; padding: 5px 10px;">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  } catch (e) {
    document.getElementById('schoolsList').innerHTML = '<p style="color: red; text-align: center;">Error: ' + e.message + '</p>';
  }
}

// Load schools for dropdown (active only)
async function loadSchoolsForSelect() {
  try {
    const res = await fetch(`${API}/api/schools/active`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const schools = await res.json();
    const select = document.getElementById('memberSchoolId');
    
    if (!Array.isArray(schools) || schools.length === 0) {
      select.innerHTML = '<option value="">Sin colegios registrados</option>';
      return;
    }
    
    select.innerHTML = '<option value="">Seleccionar colegio</option>' +
      schools.map(s => `<option value="${s.id}">${s.name}${s.commune ? ' (' + s.commune + ')' : ''}</option>`).join('');
  } catch (e) {
    console.error('Error loading schools:', e);
  }
}

// Save school
async function saveSchool() {
  const id = document.getElementById('editSchoolId').value;
  const name = document.getElementById('schoolName').value.trim();
  const school_type = document.getElementById('schoolType').value;
  const commune = document.getElementById('schoolCommune').value.trim();

  if (!name) { alert('El nombre es requerido'); return; }

  try {
    const res = await fetch(`${API}/api/schools${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ name, school_type, commune })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert(id ? 'Colegio actualizado' : 'Colegio creado');
    hideForm('schoolForm');
    loadSchools();
  } catch (e) { alert('Error: ' + e.message); }
}

// Edit school
function editSchool(id, name, school_type, commune) {
  document.getElementById('editSchoolId').value = id;
  document.getElementById('schoolName').value = name;
  document.getElementById('schoolType').value = school_type;
  document.getElementById('schoolCommune').value = commune;
  showForm('schoolForm');
}

// Toggle school status
async function toggleSchoolStatus(id) {
  try {
    const res = await fetch(`${API}/api/schools/${id}/toggle-status`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    loadSchools();
  } catch (e) { alert('Error: ' + e.message); }
}

// Delete school
async function deleteSchool(id) {
  if (!confirm('¿Eliminar colegio? Esta acción no se puede deshacer.')) return;
  try {
    const res = await fetch(`${API}/api/schools/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Colegio eliminado');
    loadSchools();
  } catch (e) { alert('Error: ' + e.message); }
}
