/* ===================================
   CLUB DE JUDO - MEMBERS MODULE
   =================================== */

// Load members list
async function loadMembers() {
  try {
    const res = await fetch(`${API}/api/members`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error || 'Error al cargar miembros');
    if (!Array.isArray(data)) throw new Error('Respuesta inválida del servidor');

    const members = data;
    if (members.length === 0) {
      document.getElementById('membersList').innerHTML = '<p style="color: #999; text-align: center;">No hay miembros registrados</p>';
      return;
    }

    document.getElementById('membersList').innerHTML = members.map(m => `
      <div class="member-item" onclick="showMemberDetail(${m.id})">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0; font-weight: bold; color: #333;">🥋 ${m.first_name} ${m.last_name}</p>
            <p style="margin: 3px 0 0 0; font-size: 13px; color: #666;">RUT: ${m.rut || 'Sin RUT'}</p>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #999;">Nacimiento: ${formatDateChile(m.date_of_birth)}</p>
          </div>
          <span class="status-badge" style="background: ${m.status === 'active' ? '#d4edda' : '#f8d7da'};">
            ${m.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    `).join('');

    document.getElementById('memberDetail').innerHTML = `
      <div style="text-align: center; color: #999; padding: 50px;">
        <p style="font-size: 48px; margin-bottom: 10px;">👈</p>
        <p>Selecciona un miembro para ver su información</p>
      </div>
    `;
  } catch (e) {
    document.getElementById('membersList').innerHTML = '<p style="color: red; text-align: center;">Error: ' + e.message + '</p>';
  }
}

// Show member detail
async function showMemberDetail(memberId) {
  try {
    const res = await fetch(`${API}/api/members/${memberId}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const m = await res.json();

    document.getElementById('memberDetail').innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #0066cc;">
          <h2 style="margin: 0; color: #0066cc;">🥋 ${m.first_name} ${m.last_name}</h2>
          <div style="display: flex; gap: 10px;">
            <span class="status-badge" style="background: ${m.status === 'active' ? '#d4edda' : '#f8d7da'};">${m.status === 'active' ? 'Activo' : 'Inactivo'}</span>
            <span class="status-badge" style="background: #0066cc; color: white;">${m.member_type === 'judoca' ? '🥋 Judoca' : '👤 Miembro'}</span>
          </div>
        </div>

        <details open style="background: #fff3cd; border-color: #ffc107;">
          <summary style="color: #856404;">🎗️ Historial de Cinturón</summary>
          <div style="margin-top: 15px;">
            ${m.belt_grade_history && m.belt_grade_history.length > 0 ? `
              <table style="width: 100%; font-size: 13px;">
                ${m.belt_grade_history.map(g => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;">${getBeltName(g.belt_color)}</td>
                    <td style="padding: 8px;">${formatDateChile(g.grade_date)}</td>
                    <td style="padding: 8px;">${g.otorgado_por || g.instructor || '-'}</td>
                    <td style="padding: 8px;">
                      <button class="btn btn-danger" onclick="deleteGradeFromMember(${g.id}, ${m.id})" style="font-size: 11px;">Eliminar</button>
                    </td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p style="color: #999;">Sin grados registrados</p>'}
            <button class="btn btn-success" onclick="showGradeForm(${m.id})" style="margin-top: 10px; font-size: 12px;">+ Agregar Grado</button>
          </div>
        </details>

        <details open style="background: #d4edda; border-color: #28a745;">
          <summary style="color: #155724;">💰 Pagos</summary>
          <div style="margin-top: 15px;">
            ${m.payments && m.payments.length > 0 ? `
              <table style="width: 100%; font-size: 13px;">
                ${m.payments.map(p => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;">${formatDateChile(p.payment_date)}</td>
                    <td style="padding: 8px;">${getPaymentTypeName(p.payment_type)}</td>
                    <td style="padding: 8px;">${p.description || '-'}</td>
                    <td style="padding: 8px; text-align: right; font-weight: bold;">$${p.amount}</td>
                    <td style="padding: 8px;">
                      <button class="btn btn-danger" onclick="deletePaymentFromMember(${p.id}, ${m.id})" style="font-size: 11px;">Eliminar</button>
                    </td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p style="color: #999;">Sin pagos registrados</p>'}
            <button class="btn btn-success" onclick="showPaymentForm(${m.id})" style="margin-top: 10px; font-size: 12px;">+ Registrar Pago</button>
          </div>
        </details>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn" onclick="editMember(${m.id})">✏️ Editar</button>
          <button class="btn btn-danger" onclick="deleteMember(${m.id})">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  } catch (e) {
    document.getElementById('memberDetail').innerHTML = '<p style="color: red;">Error: ' + e.message + '</p>';
  }
}

// Save member
async function saveMember() {
  const rut = document.getElementById('rut').value;
  if (rut && !validarRut(rut)) {
    alert('RUT inválido. Verifique el formato y dígito verificador.');
    return;
  }

  const isGuardian = document.getElementById('isGuardian').checked;
  const guardianRut = document.getElementById('guardianRut').value;
  if (isGuardian && guardianRut && !validarRut(guardianRut)) {
    alert('RUT del apoderado inválido.');
    return;
  }

  const id = document.getElementById('memberId').value;
  const createUser = document.getElementById('createUser').checked;
  
  const data = {
    rut, first_name: document.getElementById('firstName').value,
    last_name: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    date_of_birth: convertDateToISO(document.getElementById('dob').value),
    address: document.getElementById('address').value,
    profession: document.getElementById('profession').value,
    weight: document.getElementById('weight').value || null,
    emergency_contact: document.getElementById('emergencyContact').value,
    medical_info: document.getElementById('medicalInfo').value,
    medical_conditions: document.getElementById('medicalConditions').value,
    member_type: document.getElementById('memberType').value,
    is_board_member: document.getElementById('isBoardMember').checked ? 1 : 0,
    board_position: document.getElementById('boardPosition').value,
    is_guardian: isGuardian ? 1 : 0,
    guardian_info: isGuardian ? {
      full_name: document.getElementById('guardianName').value,
      rut: guardianRut,
      date_of_birth: convertDateToISO(document.getElementById('guardianDob').value),
      address: document.getElementById('guardianAddress').value,
      email: document.getElementById('guardianEmail').value,
      phone: document.getElementById('guardianPhone').value
    } : null,
    create_user: createUser,
    user_role: createUser ? document.getElementById('userRole').value : null
  };

  try {
    const res = await fetch(`${API}/api/members${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    alert(id ? 'Miembro actualizado' : 'Miembro creado');
    hideForm('memberForm');
    loadMembers();
    loadStats();
    loadMembersSelect();
  } catch (e) { alert('Error: ' + e.message); }
}

// Edit member
async function editMember(id) {
  const res = await fetch(`${API}/api/members/${id}`, {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  const m = await res.json();
  
  document.getElementById('memberId').value = m.id;
  document.getElementById('rut').value = m.rut || '';
  document.getElementById('firstName').value = m.first_name;
  document.getElementById('lastName').value = m.last_name;
  document.getElementById('email').value = m.email;
  document.getElementById('phone').value = m.phone;
  document.getElementById('dob').value = m.date_of_birth ? m.date_of_birth.split('-').reverse().join('-') : '';
  document.getElementById('address').value = m.address;
  document.getElementById('profession').value = m.profession || '';
  document.getElementById('weight').value = m.weight || '';
  document.getElementById('emergencyContact').value = m.emergency_contact;
  document.getElementById('medicalInfo').value = m.medical_info;
  document.getElementById('medicalConditions').value = m.medical_conditions || '';
  document.getElementById('memberType').value = m.member_type || 'judoca';
  document.getElementById('isBoardMember').checked = m.is_board_member === 1;
  document.getElementById('boardPosition').value = m.board_position || '';
  document.getElementById('isGuardian').checked = m.is_guardian === 1;

  if (m.guardian_info) {
    document.getElementById('guardianName').value = m.guardian_info.full_name || '';
    document.getElementById('guardianRut').value = m.guardian_info.rut || '';
    document.getElementById('guardianDob').value = m.guardian_info.date_of_birth ? m.guardian_info.date_of_birth.split('-').reverse().join('-') : '';
    document.getElementById('guardianAddress').value = m.guardian_info.address || '';
    document.getElementById('guardianEmail').value = m.guardian_info.email || '';
    document.getElementById('guardianPhone').value = m.guardian_info.phone || '';
    toggleGuardianForm();
  }

  const createUserCheckbox = document.getElementById('createUser');
  const createUserForm = document.getElementById('createUserForm');
  if (m.user_info) {
    createUserCheckbox.checked = true;
    createUserCheckbox.disabled = true;
    document.getElementById('userRole').value = m.user_info.role;
    createUserForm.classList.remove('hidden');
  } else {
    createUserCheckbox.checked = false;
    createUserCheckbox.disabled = false;
    createUserForm.classList.add('hidden');
  }

  showForm('memberForm');
}

// Delete member
async function deleteMember(id) {
  if (!confirm('¿Eliminar miembro?')) return;
  await fetch(`${API}/api/members/${id}`, { 
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  loadMembers();
  loadStats();
  loadMembersSelect();
}

// Load members select for dropdowns
async function loadMembersSelect() {
  try {
    const res = await fetch(`${API}/api/members`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();
    if (!res.ok || data.error || !Array.isArray(data)) return;
    
    const members = data;
    const options = '<option value="">Seleccionar miembro</option>' +
      members.map(m => `<option value="${m.id}" data-email="${m.email || ''}" data-rut="${m.rut || ''}">${m.first_name} ${m.last_name}${m.email ? ' (' + m.email + ')' : ''}</option>`).join('');
    
    const selects = ['userMemberSelect', 'gradeMemberId', 'attMemberId', 'payMemberId'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = id === 'userMemberSelect' ? options.replace('Seleccionar miembro', 'Seleccionar miembro (el email y contraseña se completarán automáticamente)') : options;
    });
  } catch (e) { console.error('Error loading members:', e); }
}

// Auto-fill user email from member select
function autoFillUserEmail() {
  const memberSelect = document.getElementById('userMemberSelect');
  const emailInput = document.getElementById('userEmail');
  const passwordInput = document.getElementById('userPassword');
  const selectedOption = memberSelect.options[memberSelect.selectedIndex];
  
  if (selectedOption.value && selectedOption.dataset.email) {
    emailInput.value = selectedOption.dataset.email;
    const rut = selectedOption.dataset.rut || '';
    passwordInput.value = rut ? rut.replace(/[.\-]/g, '').toUpperCase().slice(0, -1).slice(-4) : '1234';
  } else {
    emailInput.value = '';
    passwordInput.value = '';
  }
}
