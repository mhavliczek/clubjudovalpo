/* ===================================
   CLUB DE JUDO - ATTENDANCE, NEWS, STATS MODULE
   =================================== */

// Load stats
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const stats = await res.json();
    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><h3>${stats.totalMembers || 0}</h3><p>Miembros Activos</p></div>
      <div class="stat-card"><h3>${(stats.totalPayments || 0).toFixed(0)}$</h3><p>Total Pagos</p></div>
      <div class="stat-card"><h3>${stats.attendanceToday || 0}</h3><p>Asistencia Hoy</p></div>
    `;
  } catch (e) { document.getElementById('stats').innerHTML = '<p>Error: ' + e.message + '</p>'; }
}

// Load attendance
async function loadAttendance() {
  try {
    const res = await fetch(`${API}/api/attendance`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const records = await res.json();
    if (records.length === 0) {
      document.getElementById('attendanceList').innerHTML = '<p>No hay registros de asistencia</p>';
      return;
    }
    document.getElementById('attendanceList').innerHTML = `
      <table>
        <tr><th>Fecha</th><th>Miembro</th><th>RUT</th><th>Tipo</th><th>Notas</th><th>Acciones</th></tr>
        ${records.map(r => `
          <tr style="${r.notes === 'Registrado vía QR' ? 'background: #e8f5e9;' : ''}">
            <td>${formatDateChile(r.class_date)}</td>
            <td><strong>${r.first_name} ${r.last_name}</strong></td>
            <td>${r.rut || 'Sin RUT'}</td>
            <td>${r.class_type === 'regular' ? '📅 Regular' : r.class_type}</td>
            <td>${r.notes || '-'}</td>
            <td><button class="btn btn-danger" onclick="deleteAttendance(${r.id})">🗑️ Eliminar</button></td>
          </tr>
        `).join('')}
      </table>
    `;
  } catch (e) { document.getElementById('attendanceList').innerHTML = '<p>Error: ' + e.message + '</p>'; }
}

// Save attendance
async function saveAttendance() {
  const data = {
    member_id: parseInt(document.getElementById('attMemberId').value),
    class_date: document.getElementById('classDate').value,
    class_type: document.getElementById('classType').value,
    notes: document.getElementById('attNotes').value
  };
  try {
    const res = await fetch(`${API}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Asistencia registrada');
    hideForm('attendanceForm');
    loadAttendance();
  } catch (e) { alert('Error: ' + e.message); }
}

// Delete attendance
async function deleteAttendance(id) {
  if (!confirm('¿Eliminar registro?')) return;
  await fetch(`${API}/api/attendance/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  loadAttendance();
}

// Export attendance report
async function exportAttendanceReport() {
  const filtersDiv = document.getElementById('attendanceFilters');
  if (filtersDiv.classList.contains('hidden')) {
    filtersDiv.classList.remove('hidden');
    return;
  }

  const startDate = document.getElementById('reportStartDate').value;
  const endDate = document.getElementById('reportEndDate').value;

  let url = `${API}/api/attendance/report/excel`;
  const params = new URLSearchParams();

  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const queryString = params.toString();
  if (queryString) {
    url += '?' + queryString;
  }

  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al exportar');
    }

    // Get blob and download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    
    // Generate filename with date range
    const today = new Date().toISOString().split('T')[0];
    const filename = `asistencias_${startDate || 'inicio'}_${endDate || 'fin'}_${today}.xlsx`;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting attendance:', error);
    alert('❌ Error al exportar: ' + error.message);
  }
}

// Load news
async function loadNews() {
  try {
    const res = await fetch(`${API}/api/news`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const news = await res.json();
    const newsHTML = news.length === 0 ? '<p>No hay noticias publicadas</p>' : news.map(n => `
      <div class="news-card">
        <h3>${n.title}</h3>
        <div class="meta">
          <span>📅 ${n.created_at}</span> • <span>✍️ ${n.author_email || 'Admin'}</span>
          ${currentUser?.role === 'admin' ? `<button class="btn btn-danger" style="float: right; padding: 2px 10px; font-size: 12px;" onclick="deleteNews(${n.id})">Eliminar</button>` : ''}
        </div>
        <div class="content">${n.content}</div>
        ${n.file_path ? `
          <div class="attachment">
            ${n.file_type?.startsWith('image/') ? `<a href="${n.file_path}" target="_blank"><img src="${n.file_path}" alt="${n.file_name}"></a>` : `<a href="${n.file_path}" target="_blank">📎 ${n.file_name}</a>`}
          </div>
        ` : ''}
      </div>
    `).join('');
    
    document.getElementById('newsList').innerHTML = newsHTML;
    document.getElementById('memberNewsList').innerHTML = newsHTML;
  } catch (e) { 
    document.getElementById('newsList').innerHTML = '<p>Error: ' + e.message + '</p>';
    document.getElementById('memberNewsList').innerHTML = '<p>Error: ' + e.message + '</p>';
  }
}

// Save news
async function saveNews() {
  const title = document.getElementById('newsTitle').value;
  const content = document.getElementById('newsContent').value;
  const fileInput = document.getElementById('newsFile');
  
  if (!title || !content) { alert('Título y contenido son requeridos'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', content);
  if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

  try {
    const res = await fetch(`${API}/api/news`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Noticia publicada');
    hideForm('newsForm');
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsFile').value = '';
    loadNews();
  } catch (e) { alert('Error: ' + e.message); }
}

// Delete news
async function deleteNews(id) {
  if (!confirm('¿Eliminar noticia?')) return;
  await fetch(`${API}/api/news/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  loadNews();
}

// Member Portal Functions
async function loadMyInfo() {
  if (!currentUser?.member_id) {
    document.getElementById('myInfo').innerHTML = '<p>No tienes información de miembro asociada</p>';
    return;
  }
  try {
    const res = await fetch(`${API}/api/members/${currentUser.member_id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const member = await res.json();
    document.getElementById('myInfo').innerHTML = `
      <p><strong>Nombre:</strong> ${member.first_name} ${member.last_name}</p>
      <p><strong>Email:</strong> ${member.email || '-'}</p>
      <p><strong>Teléfono:</strong> ${member.phone || '-'}</p>
      <p><strong>Estado:</strong> <span class="status-badge status-${member.status}">${member.status}</span></p>
    `;
    loadMyGrade();
    loadMyAttendance();
    loadMyPayments();

    // Initialize curriculum
    if (window.CurriculumModule) {
      CurriculumModule.init(currentUser.member_id);
    }
    
    // Initialize QR module
    if (window.QRModule) {
      QRModule.init(currentUser.member_id, false);
    }
  } catch (e) { document.getElementById('myInfo').innerHTML = '<p>Error: ' + e.message + '</p>'; }
}

// Toggle curriculum form
function toggleCurriculumForm() {
  document.getElementById('curriculumForm').classList.toggle('hidden');
}

async function loadMyGrade() {
  if (!currentUser?.member_id) return;
  try {
    const res = await fetch(`${API}/api/grades/member/${currentUser.member_id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const grades = await res.json();
    if (grades.length === 0) {
      document.getElementById('myGrade').innerHTML = '<p>Sin grados registrados</p>';
      return;
    }
    const currentGrade = grades[0];
    document.getElementById('myGrade').innerHTML = `
      <p><strong>Grado:</strong> ${getBeltName(currentGrade.belt_color)}</p>
      <p><strong>Fecha:</strong> ${formatDateChile(currentGrade.grade_date)}</p>
      <p><strong>Instructor:</strong> ${currentGrade.instructor || '-'}</p>
      ${currentGrade.score ? `<p><strong>Nota:</strong> ${currentGrade.score}</p>` : ''}
      ${currentGrade.notes ? `<p><strong>Comentarios:</strong> ${currentGrade.notes}</p>` : ''}
    `;
  } catch (e) { document.getElementById('myGrade').innerHTML = '<p>Error: ' + e.message + '</p>'; }
}

async function loadMyAttendance() {
  if (!currentUser?.member_id) return;
  try {
    const res = await fetch(`${API}/api/attendance?member_id=${currentUser.member_id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const records = await res.json();
    if (records.length === 0) {
      document.getElementById('myAttendance').innerHTML = '<p>Sin registros de asistencia</p>';
      return;
    }
    document.getElementById('myAttendance').innerHTML = `
      <table>
        <tr><th>Fecha</th><th>Tipo</th><th>Notas</th></tr>
        ${records.map(r => `
          <tr style="${r.notes === 'Registrado vía QR' ? 'background: #e8f5e9;' : ''}">
            <td>${formatDateChile(r.class_date)}</td>
            <td>${r.class_type === 'regular' ? '📅 Regular' : r.class_type}</td>
            <td>${r.notes === 'Registrado vía QR' ? '✅ Registrado vía QR' : (r.notes || '-')}</td>
          </tr>
        `).join('')}
      </table>
    `;
  } catch (e) { document.getElementById('myAttendance').innerHTML = '<p>Error: ' + e.message + '</p>'; }
}

async function loadMyPayments() {
  if (!currentUser?.member_id) return;
  try {
    const res = await fetch(`${API}/api/payments?member_id=${currentUser.member_id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const payments = await res.json();
    if (payments.length === 0) {
      document.getElementById('myPayments').innerHTML = '<p>Sin pagos registrados</p>';
      return;
    }
    document.getElementById('myPayments').innerHTML = `
      <table>
        <tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Descripción</th></tr>
        ${payments.map(p => `<tr><td>${formatDateChile(p.payment_date)}</td><td>${getPaymentTypeName(p.payment_type)}</td><td>$${p.amount.toFixed(0)}</td><td>${p.description || '-'}</td></tr>`).join('')}
      </table>
    `;
  } catch (e) { document.getElementById('myPayments').innerHTML = '<p>Error: ' + e.message + '</p>'; }
}

// ===================================
// ATTENDANCE STATISTICS FUNCTIONS
// ===================================

// Get attendance percentage color class
function getAttendanceColorClass(percentage) {
  if (percentage < 75) return 'bg-danger';
  if (percentage < 85) return 'bg-warning';
  return 'bg-success';
}

// Get attendance color based on percentage
function getAttendanceColor(percentage) {
  if (percentage < 75) return '#dc3545';
  if (percentage < 85) return '#ffc107';
  return '#28a745';
}

// Load attendance statistics
async function loadAttendanceStatistics() {
  const year = document.getElementById('statsYear')?.value || new Date().getFullYear();
  const month = document.getElementById('statsMonth')?.value || (new Date().getMonth() + 1);

  try {
    const res = await fetch(`${API}/api/attendance/statistics?year=${year}&month=${month}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const stats = await res.json();
    renderAttendanceStatistics(stats, year, month);
  } catch (e) {
    document.getElementById('attendanceStatsTable').innerHTML = '<p>Error: ' + e.message + '</p>';
  }
}

// Render attendance statistics table
function renderAttendanceStatistics(stats, year, month) {
  const container = document.getElementById('attendanceStatsTable');
  if (!container) return;

  if (stats.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay deportistas registrados</p>';
    return;
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  let html = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <thead>
          <tr style="background: #0066cc; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Judoka</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Cinturón</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">RUT</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;" colspan="2">Mensual (${monthNames[parseInt(month) - 1]})</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;" colspan="2">Semestral</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;" colspan="2">Anual</th>
            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Acción</th>
          </tr>
          <tr style="background: #0052a3; color: white;">
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;" colspan="3"></th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">Asist.</th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">%</th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">Asist.</th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">%</th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">Asist.</th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;">%</th>
            <th style="padding: 6px; text-align: center; border: 1px solid #ddd;"></th>
          </tr>
        </thead>
        <tbody>
  `;

  stats.forEach(stat => {
    const monthlyColor = getAttendanceColor(stat.monthly.percentage);
    const semesterColor = getAttendanceColor(stat.semester.percentage);
    const yearlyColor = getAttendanceColor(stat.yearly.percentage);

    html += `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; border: 1px solid #ddd;">
          <strong>${stat.first_name} ${stat.last_name}</strong>
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
          ${stat.belt_color ? getBeltName(stat.belt_color) : '-'}
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
          ${stat.rut || '-'}
        </td>
        <!-- Monthly -->
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
          ${stat.monthly.attendance} / ${stat.monthly.total}
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background: ${monthlyColor}20; font-weight: bold; color: ${stat.monthly.percentage < 75 ? '#dc3545' : stat.monthly.percentage < 85 ? '#856404' : '#155724'};">
          ${stat.monthly.percentage.toFixed(1)}%
        </td>
        <!-- Semester -->
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
          ${stat.semester.attendance} / ${stat.semester.total}
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background: ${semesterColor}20; font-weight: bold; color: ${stat.semester.percentage < 75 ? '#dc3545' : stat.semester.percentage < 85 ? '#856404' : '#155724'};">
          ${stat.semester.percentage.toFixed(1)}%
        </td>
        <!-- Yearly -->
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
          ${stat.yearly.attendance} / ${stat.yearly.total}
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background: ${yearlyColor}20; font-weight: bold; color: ${stat.yearly.percentage < 75 ? '#dc3545' : stat.yearly.percentage < 85 ? '#856404' : '#155724'};">
          ${stat.yearly.percentage.toFixed(1)}%
        </td>
        <!-- Actions -->
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
          <button class="btn btn-sm" onclick="viewMemberMonthlyDetail(${stat.id}, '${year}')" style="font-size: 11px; padding: 3px 8px;">📅 Ver Detalle</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// View member monthly detail
async function viewMemberMonthlyDetail(memberId, year) {
  try {
    const res = await fetch(`${API}/api/attendance/member-stats?member_id=${memberId}&year=${year}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const monthlyStats = await res.json();
    renderMonthlyDetail(monthlyStats, memberId, year);
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Render monthly detail
function renderMonthlyDetail(monthlyStats, memberId, year) {
  const container = document.getElementById('monthlyDetailView');
  const contentContainer = document.getElementById('monthlyDetailContent');
  
  if (!container || !contentContainer) return;

  container.classList.remove('hidden');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  let html = `
    <div style="overflow-x: auto; margin-top: 15px;">
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <thead>
          <tr style="background: #0066cc; color: white;">
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Mes</th>
            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Asistencias</th>
            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Esperadas</th>
            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Porcentaje</th>
            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  monthlyStats.forEach(stat => {
    const color = getAttendanceColor(stat.percentage);
    const statusText = stat.percentage < 75 ? 'Bajo' : stat.percentage < 85 ? 'Regular' : 'Excelente';
    const statusColor = stat.percentage < 75 ? '#dc3545' : stat.percentage < 85 ? '#856404' : '#155724';

    html += `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${stat.month_name}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${stat.attendance}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${stat.expected}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; color: ${statusColor};">
          ${stat.percentage}%
        </td>
        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background: ${color}20; color: ${statusColor}; font-weight: bold;">
          ${statusText}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  html += `<div style="margin-top: 15px; text-align: center;">
    <button class="btn" onclick="document.getElementById('monthlyDetailView').classList.add('hidden')">Cerrar</button>
  </div>`;

  contentContainer.innerHTML = html;
}

// ===================================
// BULK ATTENDANCE FUNCTIONS
// ===================================

// Show bulk attendance form
async function showBulkAttendanceForm() {
  const form = document.getElementById('bulkAttendanceForm');
  if (!form) return;

  form.classList.remove('hidden');
  
  // Load all judokas for checkboxes
  try {
    const res = await fetch(`${API}/api/members`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const members = await res.json();
    
    // Filter only active deportistas/judocas
    const judokas = members.filter(m => m.status === 'active' && (m.member_type === 'deportista' || m.member_type === 'judoca' || !m.member_type));
    
    renderBulkMemberCheckboxes(judokas);
  } catch (e) {
    alert('Error loading members: ' + e.message);
  }
}

// Render bulk member checkboxes
function renderBulkMemberCheckboxes(judokas) {
  const container = document.getElementById('bulkMemberCheckboxes');
  if (!container) return;

  if (judokas.length === 0) {
    container.innerHTML = '<p style="color: #999;">No hay judokas disponibles</p>';
    return;
  }

  let html = judokas.map(j => `
    <label style="display: flex; align-items: center; gap: 8px; padding: 5px; background: #f8f9fa; border-radius: 3px; cursor: pointer;">
      <input type="checkbox" class="bulk-member-checkbox" value="${j.id}" style="width: auto;">
      <span>${j.first_name} ${j.last_name}</span>
    </label>
  `).join('');

  container.innerHTML = html;
}

// Select/deselect all members
function selectAllMembers(selectAll) {
  const checkboxes = document.querySelectorAll('.bulk-member-checkbox');
  checkboxes.forEach(cb => cb.checked = selectAll);
}

// Hide bulk attendance form
function hideBulkAttendanceForm() {
  const form = document.getElementById('bulkAttendanceForm');
  if (form) form.classList.add('hidden');
}

// Save bulk attendance
async function saveBulkAttendance() {
  const year = document.getElementById('bulkYear')?.value;
  const month = document.getElementById('bulkMonth')?.value;
  const classType = document.getElementById('bulkClassType')?.value || 'regular';
  
  if (!year || !month) {
    alert('Por favor seleccione año y mes');
    return;
  }

  const checkboxes = document.querySelectorAll('.bulk-member-checkbox:checked');
  const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  if (memberIds.length === 0) {
    alert('Por favor seleccione al menos un judoka');
    return;
  }

  if (!confirm(`¿Está seguro que desea llenar la asistencia para ${memberIds.length} judokas durante todo el mes seleccionado? Esto creará registros para todos los martes y jueves del mes.`)) {
    return;
  }

  try {
    const res = await fetch(`${API}/api/attendance/bulk-month`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({
        year: parseInt(year),
        month: parseInt(month),
        member_ids: memberIds,
        class_type: classType
      })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert(`✅ ${result.message}`);
    hideBulkAttendanceForm();
    loadAttendanceStatistics();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
