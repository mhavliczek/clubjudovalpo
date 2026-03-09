/* ===================================
   CLUB DE JUDO - INSTRUCTORS MODULE
   =================================== */

// Show instructor form
function showInstructorForm() {
  document.getElementById('editInstructorIdSection').value = '';
  document.getElementById('instructorName').value = '';
  document.getElementById('instructorRank').value = '';
  document.getElementById('instructorOrganization').value = '';
  showForm('instructorForm');
}

// Load instructors
async function loadInstructorsSection() {
  try {
    const res = await fetch(`${API}/api/instructors`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const instructors = await res.json();
    const container = document.getElementById('instructorsListSection');

    if (!Array.isArray(instructors) || instructors.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No hay instructores registrados</p>';
      return;
    }

    container.innerHTML = `
      <table>
        <tr><th>Nombre</th><th>Grado</th><th>Organización</th><th>Estado</th><th>Acciones</th></tr>
        ${instructors.map(i => `
          <tr>
            <td>${i.name}</td>
            <td>${i.rank || '-'}</td>
            <td>${i.organization || '-'}</td>
            <td><span class="status-badge ${i.is_active === 1 ? 'status-active' : 'status-inactive'}">${i.is_active === 1 ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <button class="btn" onclick="editInstructorSection(${i.id}, '${i.name.replace(/'/g, "\\'")}', '${i.rank || ''}', '${i.organization || ''}')" style="font-size: 12px; padding: 5px 10px;">✏️</button>
              <button class="btn ${i.is_active === 1 ? 'btn-warning' : 'btn-success'}" onclick="toggleInstructorStatusSection(${i.id})" style="font-size: 12px; padding: 5px 10px;">${i.is_active === 1 ? '🔓' : '🔒'}</button>
              <button class="btn btn-danger" onclick="deleteInstructorSection(${i.id})" style="font-size: 12px; padding: 5px 10px;">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  } catch (e) {
    document.getElementById('instructorsListSection').innerHTML = '<p style="color: red; text-align: center;">Error: ' + e.message + '</p>';
  }
}

// Save instructor
async function saveInstructorFromSection() {
  const id = document.getElementById('editInstructorIdSection').value;
  const name = document.getElementById('instructorName').value.trim();
  const rank = document.getElementById('instructorRank').value.trim();
  const organization = document.getElementById('instructorOrganization').value.trim();

  if (!name) { alert('El nombre es requerido'); return; }

  try {
    const res = await fetch(`${API}/api/instructors${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ name, rank, organization })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert(id ? 'Instructor actualizado' : 'Instructor creado');
    hideForm('instructorForm');
    loadInstructorsSection();
  } catch (e) { alert('Error: ' + e.message); }
}

// Edit instructor
function editInstructorSection(id, name, rank, organization) {
  document.getElementById('editInstructorIdSection').value = id;
  document.getElementById('instructorName').value = name;
  document.getElementById('instructorRank').value = rank;
  document.getElementById('instructorOrganization').value = organization;
  showForm('instructorForm');
}

// Toggle instructor status
async function toggleInstructorStatusSection(id) {
  try {
    const res = await fetch(`${API}/api/instructors/${id}/toggle-status`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    loadInstructorsSection();
  } catch (e) { alert('Error: ' + e.message); }
}

// Delete instructor
async function deleteInstructorSection(id) {
  if (!confirm('¿Eliminar instructor?')) return;
  try {
    const res = await fetch(`${API}/api/instructors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Instructor eliminado');
    loadInstructorsSection();
  } catch (e) { alert('Error: ' + e.message); }
}
