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
        <tr><th>ID</th><th>Miembro</th><th>Fecha</th><th>Tipo</th><th>Notas</th><th>Acciones</th></tr>
        ${records.map(r => `
          <tr>
            <td>${r.id}</td>
            <td>${r.member_name}</td>
            <td>${r.class_date}</td>
            <td>${r.class_type}</td>
            <td>${r.notes || '-'}</td>
            <td><button class="btn btn-danger" onclick="deleteAttendance(${r.id})">Eliminar</button></td>
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
        ${records.map(r => `<tr><td>${r.class_date}</td><td>${r.class_type}</td><td>${r.notes || '-'}</td></tr>`).join('')}
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
