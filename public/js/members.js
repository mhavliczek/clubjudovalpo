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
    // Force reload from server with cache busting and no-cache headers
    const res = await fetch(`${API}/api/members/${memberId}?t=${Date.now()}`, {
      headers: { 
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!res.ok) {
      throw new Error('Error al cargar datos del miembro');
    }
    
    const m = await res.json();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Calculate which months are paid
    const paidMonths = {};
    const payments = m.payments || [];
    const hasEnrollment = payments.some(p => p.payment_type === 'enrollment' && new Date(p.payment_date).getFullYear() === currentYear);
    const hasLicense = payments.some(p => p.payment_type === 'license' && new Date(p.payment_date).getFullYear() === currentYear);
    
    const monthNamesFull = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    payments.filter(p => p.payment_type === 'monthly' && new Date(p.payment_date).getFullYear() === currentYear)
      .forEach(p => {
        // Try to get month from description first
        const descLower = (p.description || '').toLowerCase();
        let month = -1;
        
        // Find month in description
        for (let i = 0; i < monthNamesFull.length; i++) {
          if (descLower.includes(monthNamesFull[i])) {
            month = i + 1; // 1-12
            break;
          }
        }
        
        // If no month in description, use payment date
        if (month === -1) {
          month = new Date(p.payment_date).getMonth() + 1;
        }
        
        paidMonths[month] = true;
      });

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    document.getElementById('memberDetail').innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #0066cc;">
          <div>
            <h2 style="margin: 0; color: #0066cc;">🥋 ${m.first_name} ${m.last_name}</h2>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">RUT: ${m.rut || 'Sin RUT'}</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end;">
            <span class="status-badge" style="background: ${m.status === 'active' ? '#d4edda' : '#f8d7da'};">${m.status === 'active' ? '✅ Activo' : '❌ Inactivo'}</span>
            <span class="status-badge" style="background: #0066cc; color: white;">
              ${m.member_type === 'deportista' ? '🥋 Deportista' : 
                m.member_type === 'apoderado' ? '👨‍👧‍👦 Apoderado' : 
                m.member_type === 'honorifico' ? '🏅 Honorífico' : '👤 Socio Común'}
            </span>
            ${m.is_board_member ? `<span class="status-badge" style="background: #ffc107; color: #333;">🏛️ Directiva</span>` : ''}
            ${m.is_commission_member ? `<span class="status-badge" style="background: #e91e63; color: white;">📋 ${getCommissionName(m.commission_type)}</span>` : ''}
            ${m.condition === 'student' && m.school_info ? `<span class="status-badge" style="background: #17a2b8; color: white;">🎓 ${m.school_info.name}</span>` : ''}
          </div>
        </div>

        <!-- Quick Actions -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
          <button class="btn" onclick="editMember(${m.id})">✏️ Editar</button>
          <button class="btn btn-warning" onclick="toggleMemberStatus(${m.id}, '${m.status}')">${m.status === 'active' ? '🔒 Desactivar' : '🔓 Activar'}</button>
          <button class="btn btn-warning" onclick="resetMemberPassword(${m.id}, '${m.email || ''}')">🔑 Resetear Password</button>
          <button class="btn btn-danger" onclick="deleteMember(${m.id})">🗑️ Eliminar</button>
        </div>

        <details open style="background: #fff3cd; border-color: #ffc107;">
          <summary style="color: #856404;">🎗️ Historial de Cinturón</summary>
          <div style="margin-top: 15px;">
            ${m.belt_grades && m.belt_grades.length > 0 ? `
              <table style="width: 100%; font-size: 13px;">
                ${m.belt_grades.map(g => `
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
          <summary style="color: #155724;">💰 Pagos (${currentYear})</summary>
          <div style="margin-top: 15px;">
            <!-- Annual Payments Status -->
            <div style="margin-bottom: 15px; padding: 10px; background: #fff; border-radius: 5px;">
              <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #155724;">📊 Estado Anual</h4>
              <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <div style="text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #666;">Matrícula</p>
                  <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: ${hasEnrollment ? '#28a745' : '#dc3545'};">
                    ${hasEnrollment ? '✅ Pagada' : '❌ No Pagada'}
                  </p>
                </div>
                <div style="text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #666;">Licencia</p>
                  <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: ${hasLicense ? '#28a745' : '#dc3545'};">
                    ${hasLicense ? '✅ Pagada' : '❌ No Pagada'}
                  </p>
                </div>
                <div style="text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #666;">Mensualidades</p>
                  <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: ${Object.keys(paidMonths).length >= currentMonth ? '#28a745' : '#dc3545'};">
                    ${Object.keys(paidMonths).length}/12
                  </p>
                </div>
              </div>
            </div>

            <!-- Monthly Payment Grid -->
            <div style="margin-bottom: 15px; padding: 10px; background: #fff; border-radius: 5px;">
              <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #155724;">📅 Mensualidades</h4>
              <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
                ${monthNames.map((name, i) => `
                  <div style="text-align: center; padding: 8px; border-radius: 5px; background: ${paidMonths[i + 1] ? '#d4edda' : '#f8d7da'}; border: 1px solid ${paidMonths[i + 1] ? '#28a745' : '#dc3545'};">
                    <p style="margin: 0; font-size: 11px; color: #666;">${name}</p>
                    <p style="margin: 3px 0 0 0; font-size: 16px; font-weight: bold; color: ${paidMonths[i + 1] ? '#28a745' : '#dc3545'};">
                      ${paidMonths[i + 1] ? '✅' : '❌'}
                    </p>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Payment History List -->
            <div style="margin-bottom: 15px;">
              <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #155724;">📋 Historial de Pagos</h4>
              ${m.payments && m.payments.length > 0 ? `
                <table style="width: 100%; font-size: 13px;">
                  <thead>
                    <tr style="background: #28a745; color: white;">
                      <th style="padding: 8px; text-align: left;">Fecha</th>
                      <th style="padding: 8px;">Tipo</th>
                      <th style="padding: 8px;">Descripción</th>
                      <th style="padding: 8px; text-align: right;">Monto</th>
                      <th style="padding: 8px;">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${m.payments.map(p => `
                      <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 8px;">${formatDateChile(p.payment_date)}</td>
                        <td style="padding: 8px;">${getPaymentTypeName(p.payment_type)}</td>
                        <td style="padding: 8px;">${p.description || '-'}</td>
                        <td style="padding: 8px; text-align: right; font-weight: bold;">$${p.amount.toLocaleString('es-CL')}</td>
                        <td style="padding: 8px; text-align: center;">
                          <button class="btn btn-danger" onclick="deletePaymentFromMember(${p.id}, ${m.id})" style="font-size: 11px; padding: 3px 6px;">Eliminar</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p style="color: #999; text-align: center;">Sin pagos registrados</p>'}
            </div>

            <!-- Payment Status Alert -->
            ${m.payment_status ? `
              <div style="padding: 12px; border-radius: 8px; border-left: 4px solid; ${
                m.payment_status.status === 'al_dia' ? 'background: #d4edda; border-color: #28a745;' :
                m.payment_status.status === 'al_dia_con_obs' ? 'background: #fff3cd; border-color: #ffc107;' :
                'background: #f8d7da; border-color: #dc3545;'
              }">
                <p style="margin: 0; font-weight: bold; ${
                  m.payment_status.status === 'al_dia' ? 'color: #155724;' :
                  m.payment_status.status === 'al_dia_con_obs' ? 'color: #856404;' :
                  'color: #721c24;'
                }">
                  ${m.payment_status.status === 'al_dia' ? '✅ Al día' :
                    m.payment_status.status === 'al_dia_con_obs' ? '⚠️ Al día con Obs' :
                    '❌ En mora'}
                </p>
                <p style="margin: 5px 0 0 0; font-size: 13px;">${m.payment_status.reason || ''}</p>
                ${m.payment_status.isOverride ? '<p style="font-size: 11px; color: #666;">(Estado manual)</p>' : ''}
              </div>
            ` : ''}

            <button class="btn btn-success" onclick="showPaymentForm(${m.id})" style="margin-top: 15px; font-size: 12px;">+ Registrar Pago</button>
          </div>
        </details>

        ${m.condition === 'student' && m.school_info ? `
        <details style="background: #e9ecef; border-color: #6c757d;">
          <summary style="color: #495057;">🎓 Información Escolar</summary>
          <div style="margin-top: 15px;">
            <p style="margin: 5px 0;"><strong>Colegio:</strong> ${m.school_info.name}</p>
            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${m.school_info.school_type === 'municipal' ? 'Municipal' : m.school_info.school_type === 'subvencionado' ? 'Subvencionado' : 'Particular'}</p>
            ${m.school_info.commune ? `<p style="margin: 5px 0;"><strong>Comuna:</strong> ${m.school_info.commune}</p>` : ''}
            ${m.education_level ? `<p style="margin: 5px 0;"><strong>Nivel:</strong> ${m.education_level === 'basica' ? 'Básica' : 'Media'}</p>` : ''}
            ${m.grade_course ? `<p style="margin: 5px 0;"><strong>Curso:</strong> ${m.grade_course.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>` : ''}
          </div>
        </details>
        ` : ''}

        <!-- Curriculum Deportivo -->
        <details style="background: #f3e5f5; border-color: #9c27b0;">
          <summary style="color: #7b1fa2;">🏆 Curriculum Deportivo</summary>
          <div style="margin-top: 15px;">
            <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
              <button class="btn btn-success" onclick="document.getElementById('curriculumForm').classList.toggle('hidden')">+ Agregar Torneo</button>
              <button class="btn" onclick="CurriculumModule.exportExcel()">📊 Exportar Excel</button>
              <button class="btn" onclick="CurriculumModule.generateCertificate()">📄 Certificado PDF</button>
              <button class="btn" onclick="CurriculumModule.generateCurriculum()">📋 Curriculum Deportivo PDF</button>
            </div>

            <div id="curriculumForm" class="hidden" style="padding: 15px; background: #fff; border-radius: 5px; margin-bottom: 15px;">
              <h4 style="margin-top: 0;">Agregar Torneo</h4>
              <div class="form-row" style="flex-direction: column; gap: 10px;">
                <input type="text" id="tournamentName" placeholder="Nombre del torneo" style="width: 100%;">
                <input type="date" id="tournamentDate" placeholder="Fecha" style="width: 100%;">
                <input type="text" id="tournamentLocation" placeholder="Lugar de realización" style="width: 100%;">
                <select id="tournamentType" style="width: 100%;">
                  <option value="abierto">Abierto (sin puntaje)</option>
                  <option value="federado">Federado (con puntaje)</option>
                </select>
                <input type="text" id="tournamentCategory" placeholder="Categoría" style="width: 100%;">
                <input type="text" id="tournamentWeight" placeholder="Peso" style="width: 100%;">
                <input type="text" id="tournamentBelt" placeholder="Grado con que compite" style="width: 100%;">
                <input type="text" id="tournamentPlace" placeholder="Lugar obtenido (ej: 1er, 2do, 3ro)" style="width: 100%;">
                <button class="btn btn-success" id="saveCurriculumBtn">Guardar Torneo</button>
              </div>
            </div>

            <div id="curriculumList">
              <p style="color: #999; text-align: center;">Cargando torneos...</p>
            </div>
          </div>
        </details>
      </div>
    `;
  } catch (e) {
    document.getElementById('memberDetail').innerHTML = '<p style="color: red;">Error: ' + e.message + '</p>';
  }
}

// Save member
async function saveMember() {
  const documentType = document.getElementById('documentType').value;
  const rut = document.getElementById('rut').value;
  
  // Validar solo si es RUT
  if (documentType === 'rut' && rut && !validarRut(rut)) {
    alert('RUT inválido. Verifique el formato y dígito verificador.');
    return;
  }
  
  // Validar pasaporte (solo que no esté vacío si se seleccionó pasaporte)
  if (documentType === 'passport' && !rut) {
    alert('El número de pasaporte no puede estar vacío.');
    return;
  }

  const id = document.getElementById('memberId').value;
  const createUser = document.getElementById('createUser').checked;

  const condition = document.getElementById('memberCondition').value;
  const memberType = document.getElementById('memberType').value;

  // Obtener datos del apoderado
  const guardianDocumentType = document.getElementById('guardianDocumentType')?.value || 'rut';
  const guardianRut = document.getElementById('guardianRut')?.value || '';
  const guardianMemberSelect = document.getElementById('guardianMemberSelect');

  // Validar RUT del apoderado si se está creando uno nuevo
  const isNewGuardian = guardianMemberSelect && guardianMemberSelect.value === 'new';
  
  if (isNewGuardian && guardianDocumentType === 'rut' && guardianRut && !validarRut(guardianRut)) {
    alert('RUT del apoderado inválido.');
    return;
  }
  if (isNewGuardian && guardianDocumentType === 'passport' && !guardianRut) {
    alert('El número de pasaporte del apoderado no puede estar vacío.');
    return;
  }

  // Calcular edad para determinar si es obligatorio el apoderado
  const dob = document.getElementById('dob').value;
  let isMinor = false;
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    isMinor = age < 18;
  }

  // Verificar si se seleccionó un apoderado existente
  const selectedGuardianId = guardianMemberSelect && guardianMemberSelect.value !== 'new' ? guardianMemberSelect.value : null;

  // Si es menor y no hay apoderado seleccionado, guardar información del nuevo apoderado
  const saveGuardianInfo = isMinor && !selectedGuardianId && document.getElementById('guardianName').value.trim() !== '';

  const data = {
    document_type: documentType,
    rut,
    first_name: document.getElementById('firstName').value,
    last_name: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    date_of_birth: convertDateToISO(document.getElementById('dob').value),
    address: document.getElementById('address').value,
    association: document.getElementById('association').value || null,
    profession: condition === 'profession' ? document.getElementById('profession').value : null,
    weight: document.getElementById('weight').value || null,
    emergency_contact: document.getElementById('emergencyContact').value,
    medical_info: document.getElementById('medicalInfo').value,
    medical_conditions: document.getElementById('medicalConditions').value,
    member_type: memberType,
    is_honorary: memberType === 'honorifico' ? 1 : 0,
    is_board_member: document.getElementById('isBoardMember').checked ? 1 : 0,
    board_position: document.getElementById('boardPosition').value,
    is_commission_member: document.getElementById('isCommissionMember').checked ? 1 : 0,
    commission_type: document.getElementById('isCommissionMember').checked ? (document.getElementById('commissionType').value || null) : null,
    guardian_id: selectedGuardianId || (isMinor ? null : null),
    condition: condition,
    school_id: condition === 'student' ? (document.getElementById('memberSchoolId').value || null) : null,
    education_level: condition === 'student' ? (document.getElementById('educationLevel').value || null) : null,
    grade_course: condition === 'student' ? (document.getElementById('gradeCourse').value || null) : null,
    guardian_info: saveGuardianInfo ? {
      full_name: document.getElementById('guardianName').value,
      document_type: guardianDocumentType,
      rut: guardianRut,
      date_of_birth: convertDateToISO(document.getElementById('guardianDob').value),
      profession: document.getElementById('guardianProfession').value || null,
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
    
    if (!res.ok) {
      throw new Error(result.error || 'Error al guardar miembro');
    }
    
    alert(id ? 'Miembro actualizado' : 'Miembro creado exitosamente');
    hideForm('memberForm');
    
    // Recargar datos
    await loadMembers();
    await loadStats();
    await loadMembersSelect();
    
    // Si se creó un nuevo miembro, seleccionarlo para mostrar su detalle
    if (!id && result.id) {
      setTimeout(() => showMemberDetail(result.id), 100);
    }
  } catch (e) { 
    alert('Error: ' + e.message); 
    console.error('Error saving member:', e);
  }
}

// Edit member
async function editMember(id) {
  console.log('✏️ Editing member ID:', id);
  
  try {
    const res = await fetch(`${API}/api/members/${id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    
    console.log('📡 Response status:', res.status);
    
    if (!res.ok) {
      const error = await res.json();
      console.error('❌ API error:', error);
      alert('Error al cargar miembro: ' + (error.error || 'Error desconocido'));
      return;
    }
    
    const m = await res.json();
    console.log('📄 Member data:', m);

  document.getElementById('memberId').value = m.id;
  document.getElementById('documentType').value = m.document_type || 'rut';
  document.getElementById('rut').value = m.rut || '';
  document.getElementById('firstName').value = m.first_name;
  document.getElementById('lastName').value = m.last_name;
  document.getElementById('email').value = m.email;
  document.getElementById('phone').value = m.phone;
  document.getElementById('dob').value = m.date_of_birth ? m.date_of_birth.split('-').reverse().join('-') : '';
  document.getElementById('address').value = m.address;
  document.getElementById('association').value = m.association || '';
  document.getElementById('profession').value = m.profession || '';
  
  // Verificar edad y mostrar/ocultar apoderado
  checkAgeAndToggleGuardian();
  document.getElementById('weight').value = m.weight || '';
  document.getElementById('emergencyContact').value = m.emergency_contact;
  document.getElementById('medicalInfo').value = m.medical_info;
  document.getElementById('medicalConditions').value = m.medical_conditions || '';
  document.getElementById('memberType').value = m.member_type || 'deportista';
  document.getElementById('isBoardMember').checked = m.is_board_member === 1;
  document.getElementById('boardPosition').value = m.board_position || '';
  document.getElementById('isCommissionMember').checked = m.is_commission_member === 1;
  document.getElementById('commissionType').value = m.commission_type || '';
  if (m.is_commission_member) {
    toggleCommissionForm();
  }
  toggleDocumentType();

  if (m.guardian_info) {
    document.getElementById('guardianName').value = m.guardian_info.full_name || '';
    document.getElementById('guardianDocumentType').value = m.guardian_info.document_type || 'rut';
    document.getElementById('guardianRut').value = m.guardian_info.rut || '';
    document.getElementById('guardianDob').value = m.guardian_info.date_of_birth ? m.guardian_info.date_of_birth.split('-').reverse().join('-') : '';
    document.getElementById('guardianProfession').value = m.guardian_info.profession || '';
    document.getElementById('guardianAddress').value = m.guardian_info.address || '';
    document.getElementById('guardianEmail').value = m.guardian_info.email || '';
    document.getElementById('guardianPhone').value = m.guardian_info.phone || '';
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
  } catch (e) {
    console.error('❌ Error editing member:', e);
    alert('Error al cargar miembro: ' + e.message);
  }
}

// Toggle member status (active/inactive)
async function toggleMemberStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const action = newStatus === 'active' ? 'activar' : 'desactivar';
  
  if (!confirm(`¿Estás seguro de ${action} a este miembro?`)) return;
  
  try {
    const res = await fetch(`${API}/api/members/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert(`Miembro ${newStatus === 'active' ? 'activado' : 'desactivado'} exitosamente`);
    loadMembers();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Reset member password
async function resetMemberPassword(memberId, email) {
  if (!email) {
    alert('El miembro no tiene email registrado. No se puede resetear la contraseña.');
    return;
  }
  
  if (!confirm(`¿Resetear contraseña para ${email}?\n\nLa nueva contraseña será los últimos 4 dígitos del RUT.`)) return;
  
  try {
    // First, get the member's RUT
    const memberRes = await fetch(`${API}/api/members/${memberId}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const member = await memberRes.json();
    
    // Calculate password from RUT
    let password = '1234';
    if (member.rut) {
      const cuerpoRut = member.rut.replace(/[.\-]/g, '').toUpperCase().slice(0, -1);
      password = cuerpoRut.slice(-4);
    }
    
    // Check if user exists
    const userRes = await fetch(`${API}/api/auth/users`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const users = await userRes.json();
    const user = users.find(u => u.member_id === memberId);
    
    if (!user) {
      alert('El miembro no tiene usuario creado. Crea un usuario primero.');
      return;
    }
    
    // Reset password
    const res = await fetch(`${API}/api/auth/reset-password/${user.id}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    
    alert(`Contraseña reseteada exitosamente.\n\nNueva contraseña: ${password}\n\nIndícale al miembro que la cambie al ingresar.`);
  } catch (e) {
    alert('Error: ' + e.message);
  }
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

// Toggle condition fields (profession/student)
function toggleConditionFields() {
  const condition = document.getElementById('memberCondition').value;
  const professionFields = document.getElementById('professionFields');
  const studentFields = document.getElementById('studentFields');
  
  if (condition === 'student') {
    professionFields.classList.add('hidden');
    studentFields.classList.remove('hidden');
    loadSchoolsForSelect();
  } else {
    professionFields.classList.remove('hidden');
    studentFields.classList.add('hidden');
  }
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

// Toggle document type (RUT/Pasaporte)
function toggleDocumentType() {
  const documentType = document.getElementById('documentType').value;
  const rutInput = document.getElementById('rut');
  const rutStatus = document.getElementById('rutStatus');
  
  if (documentType === 'passport') {
    rutInput.placeholder = 'Número de Pasaporte';
    rutInput.removeAttribute('oninput');
    rutInput.removeAttribute('onchange');
    rutStatus.textContent = '';
  } else {
    rutInput.placeholder = 'RUT';
    rutInput.setAttribute('oninput', 'formatRut(this)');
    rutInput.setAttribute('onchange', 'checkRutValidity(this)');
  }
}

// Calcular edad y mostrar/ocultar formulario de apoderado
function checkAgeAndToggleGuardian() {
  const dob = document.getElementById('dob').value;
  if (!dob) return;

  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  const guardianSection = document.getElementById('guardianSection');
  const guardianSectionTitle = document.getElementById('guardianSectionTitle');
  const memberTypeSelect = document.getElementById('memberType');

  if (age < 18) {
    // Menor de edad - mostrar formulario de apoderado
    guardianSection.classList.remove('hidden');
    guardianSectionTitle.classList.remove('hidden');
    
    // Forzar tipo de socio a "Deportista" para menores
    memberTypeSelect.value = 'deportista';
    memberTypeSelect.disabled = true;
    
    // Mostrar mensaje informativo
    const typeInfo = document.getElementById('memberTypeInfo');
    if (typeInfo) {
      typeInfo.innerHTML = '<p style="color: #1976d2; font-size: 13px; margin-top: 5px;">ℹ️ Los menores de edad solo pueden registrarse como <strong>Deportistas</strong>. El tipo de socio se habilitará al cumplir 18 años.</p>';
    }
  } else {
    // Mayor de edad - ocultar formulario de apoderado
    guardianSection.classList.add('hidden');
    guardianSectionTitle.classList.add('hidden');
    
    // Habilitar selección de tipo de socio
    memberTypeSelect.disabled = false;
    
    // Limpiar campos de apoderado
    document.getElementById('guardianName').value = '';
    document.getElementById('guardianRut').value = '';
    document.getElementById('guardianDob').value = '';
    document.getElementById('guardianProfession').value = '';
    document.getElementById('guardianAddress').value = '';
    document.getElementById('guardianEmail').value = '';
    document.getElementById('guardianPhone').value = '';
    document.getElementById('guardianMemberSelect').value = '';
    
    // Ocultar mensaje informativo
    const typeInfo = document.getElementById('memberTypeInfo');
    if (typeInfo) {
      typeInfo.innerHTML = '';
    }
  }
}

// Toggle guardian document type (RUT/Pasaporte)
function toggleGuardianDocumentType() {
  const guardianDocumentType = document.getElementById('guardianDocumentType').value;
  const guardianRutInput = document.getElementById('guardianRut');

  if (guardianDocumentType === 'passport') {
    guardianRutInput.placeholder = 'Número de Pasaporte';
    guardianRutInput.removeAttribute('oninput');
  } else {
    guardianRutInput.placeholder = 'RUT';
    guardianRutInput.setAttribute('oninput', 'formatRut(this)');
  }
}

// Toggle guardian form type (existing guardian vs new guardian)
function toggleGuardianFormType() {
  const select = document.getElementById('guardianMemberSelect');
  const newGuardianForm = document.getElementById('newGuardianForm');
  
  if (select.value === 'new' || select.value === '') {
    newGuardianForm.classList.remove('hidden');
  } else {
    // Guardian existente seleccionado
    newGuardianForm.classList.add('hidden');
  }
}

// Load guardians select for dropdown
async function loadGuardiansSelect() {
  try {
    const res = await fetch(`${API}/api/members`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const members = await res.json();
    
    const guardians = members.filter(m => m.member_type === 'apoderado' || m.is_guardian);
    
    const select = document.getElementById('guardianMemberSelect');
    if (select) {
      const options = '<option value="">-- Seleccionar --</option>' +
        '<option value="new">Crear nuevo apoderado</option>' +
        guardians.map(g => `<option value="${g.id}">${g.first_name} ${g.last_name} (${g.rut || 'Sin RUT'})</option>`).join('');
      select.innerHTML = options;
    }
  } catch (e) {
    console.error('Error loading guardians:', e);
  }
}

// Toggle honorary member info
function toggleHonoraryInfo() {
  const memberType = document.getElementById('memberType').value;
  const honoraryInfo = document.getElementById('honoraryInfo');
  const dob = document.getElementById('dob').value;
  
  // Verificar si es menor de edad
  let isMinor = false;
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    isMinor = age < 18;
  }
  
  // Si es menor y trata de seleccionar Apoderado, revertir a Deportista
  if (isMinor && memberType === 'apoderado') {
    alert('⚠️ Un menor de edad no puede ser Apoderado.\n\nEl tipo de socio se ha cambiado automáticamente a "Deportista".');
    document.getElementById('memberType').value = 'deportista';
  }
  
  // Si es menor y trata de seleccionar Socio Común u Honorífico, también revertir
  if (isMinor && (memberType === 'comun' || memberType === 'honorifico')) {
    alert('⚠️ Un menor de edad solo puede registrarse como Deportista.\n\nEl tipo de socio se ha cambiado automáticamente a "Deportista".');
    document.getElementById('memberType').value = 'deportista';
  }
  
  if (memberType === 'honorifico') {
    honoraryInfo.classList.remove('hidden');
  } else {
    honoraryInfo.classList.add('hidden');
  }
}

// Get commission name from type
function getCommissionName(type) {
  const commissions = {
    'apoderados': 'Com. Apoderados',
    'tecnica': 'Com. Técnica',
    'etica': 'Com. Ética',
    'revisora': 'Com. Revisora',
    'delegado': 'Delegado DS22'
  };
  return commissions[type] || 'Comisión';
}
