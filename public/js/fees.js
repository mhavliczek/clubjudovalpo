/* ===================================
   CLUB DE JUDO - FEES MODULE
   =================================== */

// Show fees form
function showFeesForm() {
  const currentYear = new Date().getFullYear();
  document.getElementById('feesYear').value = currentYear;
  document.getElementById('enrollmentAmount').value = '';
  document.getElementById('monthlyAmount').value = '';
  document.getElementById('licenseAmount').value = '';
  showForm('feesForm');
}

// Load fees
async function loadFees() {
  try {
    const res = await fetch(`${API}/api/fees`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const fees = await res.json();
    const container = document.getElementById('feesList');

    if (!Array.isArray(fees) || fees.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No hay montos registrados</p>';
      return;
    }

    container.innerHTML = `
      <table>
        <tr><th>Año</th><th>Matrícula</th><th>Mensualidad</th><th>Licencia</th><th>Acciones</th></tr>
        ${fees.map(f => `
          <tr>
            <td><strong>${f.year}</strong></td>
            <td>$${f.enrollment_amount.toLocaleString('es-CL')}</td>
            <td>$${f.monthly_amount.toLocaleString('es-CL')}</td>
            <td>$${f.license_amount.toLocaleString('es-CL')}</td>
            <td>
              <button class="btn" onclick="editFees(${f.year}, ${f.enrollment_amount}, ${f.monthly_amount}, ${f.license_amount})" style="font-size: 12px; padding: 5px 10px;">✏️</button>
              <button class="btn btn-danger" onclick="deleteFees(${f.year})" style="font-size: 12px; padding: 5px 10px;">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  } catch (e) {
    document.getElementById('feesList').innerHTML = '<p style="color: red; text-align: center;">Error: ' + e.message + '</p>';
  }
}

// Save fees
async function saveFees() {
  const year = parseInt(document.getElementById('feesYear').value);
  const enrollment_amount = parseFloat(document.getElementById('enrollmentAmount').value) || 0;
  const monthly_amount = parseFloat(document.getElementById('monthlyAmount').value) || 0;
  const license_amount = parseFloat(document.getElementById('licenseAmount').value) || 0;

  if (!year || year < 2020) { alert('Año inválido'); return; }

  try {
    const res = await fetch(`${API}/api/fees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ year, enrollment_amount, monthly_amount, license_amount })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Montos guardados');
    hideForm('feesForm');
    loadFees();
  } catch (e) { alert('Error: ' + e.message); }
}

// Edit fees
function editFees(year, enrollment_amount, monthly_amount, license_amount) {
  document.getElementById('feesYear').value = year;
  document.getElementById('enrollmentAmount').value = enrollment_amount;
  document.getElementById('monthlyAmount').value = monthly_amount;
  document.getElementById('licenseAmount').value = license_amount;
  showForm('feesForm');
}

// Delete fees
async function deleteFees(year) {
  if (!confirm(`¿Eliminar montos del año ${year}?`)) return;
  try {
    const res = await fetch(`${API}/api/fees/${year}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Montos eliminados');
    loadFees();
  } catch (e) { alert('Error: ' + e.message); }
}
