/* ===================================
   CLUB DE JUDO - GRADES & PAYMENTS MODULE
   =================================== */

// Toggle payment fields based on type
function togglePaymentFields() {
  const paymentType = document.getElementById('paymentType').value;
  const monthlyFields = document.getElementById('monthlyFields');
  const licenseGradeFields = document.getElementById('licenseGradeFields');
  const amountInput = document.getElementById('amount');

  // Reset fields
  licenseGradeFields.classList.add('hidden');
  document.getElementById('licenseGrade').value = '';
  document.getElementById('licenseAmountDisplay').textContent = '';

  // Show month selector only for monthly payments
  if (paymentType === 'monthly') {
    monthlyFields.classList.remove('hidden');
    // Reload paid months when switching to monthly
    const memberId = document.getElementById('payMemberId').value;
    if (memberId) {
      const currentYear = new Date().getFullYear();
      loadPaidMonths(memberId, currentYear);
    }
  } else {
    monthlyFields.classList.add('hidden');
  }

  // Show license grade selector for license payments
  if (paymentType === 'license') {
    licenseGradeFields.classList.remove('hidden');
  }

  // Auto-fill amount based on fees
  loadFeesForPayment();
}

// Calculate license amount based on grade
async function calculateLicenseAmount() {
  const grade = document.getElementById('licenseGrade').value;
  const display = document.getElementById('licenseAmountDisplay');
  const amountInput = document.getElementById('amount');

  if (!grade) {
    display.textContent = '';
    amountInput.value = '';
    return;
  }

  try {
    const res = await fetch(`${API}/api/uf/valor`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const ufData = await res.json();

    if (!ufData.success) return;

    const ufValue = ufData.uf_value;

    const licenseValues = {
      '6_kyu': 0.31,
      '5_kyu': 0.35,
      '4_kyu': 0.44,
      '3_kyu': 0.50,
      '2_kyu': 0.56,
      '1_kyu': 0.60,
      '1_dan': 0.73,
      '2_dan': 0.94,
      '3_dan': 1.13,
      '4_dan': 1.26,
      '5_dan': 1.89,
      '6_dan': 2.51
    };

    const ufAmount = licenseValues[grade] || 0;
    const clpAmount = Math.round(ufAmount * ufValue);

    amountInput.value = clpAmount;
    display.textContent = `${ufAmount} UF = $${clpAmount.toLocaleString('es-CL')}`;
  } catch (e) {
    console.error('Error calculating license amount:', e);
  }
}

// Load fees for auto-fill amount
async function loadFeesForPayment() {
  const memberId = document.getElementById('payMemberId').value;
  const paymentType = document.getElementById('paymentType').value;
  
  if (!memberId || !paymentType) return;
  
  try {
    const currentYear = new Date().getFullYear();
    const res = await fetch(`${API}/api/fees/current`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const fees = await res.json();
    
    const amountInput = document.getElementById('amount');
    if (paymentType === 'enrollment') {
      amountInput.value = fees.enrollment_amount || '';
    } else if (paymentType === 'license') {
      amountInput.value = fees.license_amount || '';
    } else if (paymentType === 'monthly') {
      amountInput.value = fees.monthly_amount || '';
    }
  } catch (e) {
    console.error('Error loading fees:', e);
  }
}

// Show grade form for member
function showGradeForm(memberId) {
  document.getElementById('gradeMemberId').value = memberId;
  document.getElementById('gradeDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('examDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('gradeScore').value = '';
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

  const score = parseFloat(document.getElementById('gradeScore').value);
  
  // Validar nota (1.0 a 7.0)
  if (document.getElementById('gradeScore').value && (isNaN(score) || score < 1.0 || score > 7.0)) {
    alert('La nota debe estar entre 1.0 y 7.0');
    return;
  }

  const data = {
    member_id: parseInt(document.getElementById('gradeMemberId').value),
    belt_color: document.getElementById('beltColor').value,
    grade_date: document.getElementById('gradeDate').value,
    exam_date: document.getElementById('examDate').value,
    score: document.getElementById('gradeScore').value ? score : null,
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
    
    const statusMsg = result.status === 'approved' ? '✅ Aprobado' : result.status === 'failed' ? '❌ Reprobado' : '⏳ Pendiente';
    alert('Grado registrado\nEstado: ' + statusMsg);
    
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
async function showPaymentForm(memberId) {
  const currentYear = new Date().getFullYear();
  document.getElementById('payMemberId').value = memberId;
  document.getElementById('paymentType').value = '';
  document.getElementById('paymentYear').value = currentYear;
  document.getElementById('paymentMonth').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('payDescription').value = '';
  document.getElementById('monthlyFields').classList.add('hidden');
  
  // Load paid months for current year
  await loadPaidMonths(memberId, currentYear);
  
  showForm('paymentFormModal');
}

// Load paid months for a member and year
async function loadPaidMonths(memberId, year) {
  try {
    const res = await fetch(`${API}/api/members/${memberId}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const member = await res.json();

    const paidMonths = [];
    const monthNamesFull = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    if (member.payments) {
      member.payments
        .filter(p => p.payment_type === 'monthly' && new Date(p.payment_date).getFullYear() === year)
        .forEach(p => {
          // Get month from description
          const descLower = (p.description || '').toLowerCase();
          let month = -1;
          
          for (let i = 0; i < monthNamesFull.length; i++) {
            if (descLower.includes(monthNamesFull[i])) {
              month = i; // 0-11
              break;
            }
          }
          
          // If no month in description, use payment date
          if (month === -1) {
            month = new Date(p.payment_date).getMonth();
          }
          
          paidMonths.push(month);
        });
    }

    // Store paid months for later use
    document.getElementById('paymentMonth').setAttribute('data-paid-months', JSON.stringify(paidMonths));

    // Update month select to disable paid months
    updateMonthSelect(paidMonths);
  } catch (e) {
    console.error('Error loading paid months:', e);
  }
}

// Update month select to disable paid months
function updateMonthSelect(paidMonths) {
  const monthSelect = document.getElementById('paymentMonth');
  const options = monthSelect.querySelectorAll('option');

  options.forEach(opt => {
    const value = parseInt(opt.value);
    
    // Remove any existing " (Pagado)" text
    opt.textContent = opt.textContent.replace(' (Pagado)', '');
    
    if (opt.value === '') {
      opt.disabled = false;
    } else if (paidMonths.includes(value)) {
      opt.disabled = true;
      opt.textContent = opt.textContent + ' (Pagado)';
    } else {
      opt.disabled = false;
    }
  });
}

// Reload paid months when year changes
async function reloadPaidMonths() {
  const memberId = document.getElementById('payMemberId').value;
  const year = parseInt(document.getElementById('paymentYear').value);
  
  if (memberId && year) {
    await loadPaidMonths(memberId, year);
  }
}

// Save payment from modal
async function savePaymentFromModal() {
  const memberId = parseInt(document.getElementById('payMemberId').value);
  const paymentType = document.getElementById('paymentType').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const year = parseInt(document.getElementById('paymentYear').value) || new Date().getFullYear();
  const month = parseInt(document.getElementById('paymentMonth').value);
  const description = document.getElementById('payDescription').value;
  const licenseGrade = document.getElementById('licenseGrade').value;

  if (!memberId) {
    alert('Debe seleccionar un miembro');
    return;
  }

  if (!paymentType) {
    alert('Debe seleccionar un tipo de pago');
    return;
  }

  if (!amount) {
    alert('Debe ingresar un monto');
    return;
  }

  // For monthly payments, month is required
  if (paymentType === 'monthly' && (month === undefined || month === null)) {
    alert('Debe seleccionar un mes para la mensualidad');
    return;
  }

  // For license payments, grade is required
  if (paymentType === 'license' && !licenseGrade) {
    alert('Debe seleccionar el grado para la licencia');
    return;
  }

  // Calculate payment date based on type
  let paymentDate;
  let finalDescription = description;

  if (paymentType === 'monthly') {
    // Monthly: use selected month and year
    paymentDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    finalDescription = description || monthNames[month];
  } else if (paymentType === 'enrollment') {
    // Annual payments: January 1st of selected year
    paymentDate = `${year}-01-01`;
    finalDescription = description || `Matrícula ${year}`;
  } else if (paymentType === 'license') {
    // License: January 1st of selected year with grade
    paymentDate = `${year}-01-01`;
    const gradeNames = {
      '6_kyu': '6 KYU', '5_kyu': '5 KYU', '4_kyu': '4 KYU', '3_kyu': '3 KYU',
      '2_kyu': '2 KYU', '1_kyu': '1 KYU', '1_dan': '1 DAN', '2_dan': '2 DAN',
      '3_dan': '3 DAN', '4_dan': '4 DAN', '5_dan': '5 DAN', '6_dan': '6 DAN'
    };
    finalDescription = description || `Licencia ${gradeNames[licenseGrade]} ${year}`;
  } else {
    // Other payments: today
    paymentDate = new Date().toISOString().split('T')[0];
  }

  const data = {
    member_id: memberId,
    amount: amount,
    payment_type: paymentType,
    payment_date: paymentDate,
    description: finalDescription
  };

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
    
    // SUCCESS - Now reload and refresh the member detail
    hideForm('paymentFormModal');
    
    // Reload members list and refresh the member detail with fresh data
    loadMembers().then(() => {
      // After members are loaded, refresh the member detail
      console.log('Members reloaded, now showing detail for member:', memberId);
      showMemberDetail(memberId);
    }).catch(err => {
      console.error('Error reloading members:', err);
      // Even if loadMembers fails, try to show member detail
      showMemberDetail(memberId);
    });
    
    alert('Pago registrado exitosamente');
    
  } catch (e) { 
    alert('Error: ' + e.message); 
  }
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
