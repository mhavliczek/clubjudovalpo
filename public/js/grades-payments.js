/* ===================================
   CLUB DE JUDO - GRADES & PAYMENTS MODULE
   =================================== */

// Show grade form for member
function showGradeForm(memberId) {
  document.getElementById('gradeMemberId').value = memberId;
  document.getElementById('gradeDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('gradeNotes').value = '';
  loadInstructorsForSelect();
  showForm('gradeFormModal');
}

// Load instructors for grade form
async function loadInstructorsForSelect() {
  try {
    const res = await fetch(`${API}/api/instructors?active=true`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const instructors = await res.json();
    const select = document.getElementById('instructorSelect');
    
    if (!Array.isArray(instructors) || instructors.length === 0) {
      select.innerHTML = '<option value="">No hay instructores</option>';
      return;
    }
    select.innerHTML = instructors.map(i => `<option value="${i.name}">${i.name}${i.rank ? ' (' + i.rank + ')' : ''}</option>`).join('');
  } catch (e) {
    document.getElementById('instructorSelect').innerHTML = '<option value="">Error al cargar</option>';
  }
}

// Save grade from modal
async function saveGradeFromModal() {
  const instructorSelect = document.getElementById('instructorSelect');
  const selectedOptions = Array.from(instructorSelect.selectedOptions).map(opt => opt.value).filter(n => n !== '');
  const otorgadoPor = selectedOptions.join(', ');

  const data = {
    member_id: parseInt(document.getElementById('gradeMemberId').value),
    belt_color: document.getElementById('beltColor').value,
    grade_date: document.getElementById('gradeDate').value,
    otorgado_por: otorgadoPor,
    notes: document.getElementById('gradeNotes').value
  };

  if (!data.member_id || !data.belt_color) {
    alert('Debe seleccionar un miembro y un grado');
    return;
  }

  try {
    const res = await fetch(`${API}/api/grades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Grado registrado');
    hideForm('gradeFormModal');
    instructorSelect.value = '';
    document.getElementById('gradeNotes').value = '';
    loadMembers();
  } catch (e) { alert('Error: ' + e.message); }
}

// Delete grade from member
async function deleteGradeFromMember(gradeId, memberId) {
  if (!confirm('¿Eliminar grado?')) return;
  const token = localStorage.getItem('token');
  if (!token) { alert('Tu sesión ha expirado.'); window.location.reload(); return; }
  
  try {
    const res = await fetch(`${API}/api/grades/${gradeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar grado');
    alert('Grado eliminado exitosamente');
    loadMembers();
  } catch (e) { alert('Error: ' + e.message); }
}

// Show payment form for member
function showPaymentForm(memberId) {
  document.getElementById('payMemberId').value = memberId;
  document.getElementById('amount').value = '';
  document.getElementById('paymentType').value = 'monthly';
  document.getElementById('payDescription').value = '';
  showForm('paymentFormModal');
}

// Save payment from modal
async function savePaymentFromModal() {
  const data = {
    member_id: parseInt(document.getElementById('payMemberId').value),
    amount: parseFloat(document.getElementById('amount').value),
    payment_type: document.getElementById('paymentType').value,
    description: document.getElementById('payDescription').value
  };

  if (!data.member_id || !data.amount) {
    alert('Debe seleccionar un miembro y un monto');
    return;
  }

  try {
    const res = await fetch(`${API}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Pago registrado');
    hideForm('paymentFormModal');
    loadMembers();
  } catch (e) { alert('Error: ' + e.message); }
}

// Delete payment from member
async function deletePaymentFromMember(paymentId, memberId) {
  if (!confirm('¿Eliminar pago?')) return;
  const token = localStorage.getItem('token');
  if (!token) { alert('Tu sesión ha expirado.'); window.location.reload(); return; }
  
  try {
    const res = await fetch(`${API}/api/payments/${paymentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar pago');
    alert('Pago eliminado exitosamente');
    loadMembers();
  } catch (e) { alert('Error: ' + e.message); }
}
