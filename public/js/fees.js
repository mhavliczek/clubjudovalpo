/* ===================================
   CLUB DE JUDO - FEES MODULE
   =================================== */

// Show fees form
function showFeesForm() {
  const currentYear = new Date().getFullYear();
  document.getElementById('feesYear').value = currentYear;
  document.getElementById('enrollmentAmount').value = '';
  document.getElementById('monthlyAmount').value = '';
  
  const form = document.getElementById('feesForm');
  if (form) {
    form.classList.remove('hidden');
  }
}

// Load UF value from Central Bank
async function loadUFValue() {
  try {
    const res = await fetch(`${API}/api/uf/valor`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const data = await res.json();

    if (data.success) {
      const ufDisplay = document.getElementById('ufValueDisplay');
      if (ufDisplay) {
        ufDisplay.innerHTML = `
          <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <strong>Valor UF Actual:</strong> $${data.uf_value.toLocaleString('es-CL')}
            <span style="color: #666; font-size: 12px;">(actualizado ${data.date})</span>
          </div>
        `;
      }
      return data.uf_value;
    }
  } catch (e) {
    console.error('Error loading UF:', e);
  }
  return null;
}

// Load license values table for 2026
async function loadLicenseTable2026() {
  try {
    const res = await fetch(`${API}/api/uf/valor`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    
    if (!res.ok) {
      throw new Error('Error al obtener UF');
    }
    
    const ufData = await res.json();
    
    if (!ufData.success) {
      throw new Error(ufData.error || 'Error al obtener UF');
    }
    
    const ufValue = ufData.uf_value;
    
    // Valores UF 2026 por grado
    const licenseValues2026 = [
      { grado: '6 KYU', uf: 0.31 },
      { grado: '5 KYU', uf: 0.35 },
      { grado: '4 KYU', uf: 0.44 },
      { grado: '3 KYU', uf: 0.50 },
      { grado: '2 KYU', uf: 0.56 },
      { grado: '1 KYU', uf: 0.60 },
      { grado: '1 DAN', uf: 0.73 },
      { grado: '2 DAN', uf: 0.94 },
      { grado: '3 DAN', uf: 1.13 },
      { grado: '4 DAN', uf: 1.26 },
      { grado: '5 DAN', uf: 1.89 },
      { grado: '6 DAN', uf: 2.51 }
    ];
    
    const container = document.getElementById('licenseTableContainer');
    if (!container) {
      console.error('No se encontró el contenedor licenseTableContainer');
      return;
    }
    
    container.innerHTML = `
      <div style="margin-top: 20px; background: #f5f5f5; padding: 20px; border-radius: 5px;">
        <h3 style="margin-bottom: 15px;">🥋 Valores Licencias Federación de Judo 2026</h3>
        <table style="width: 100%; font-size: 14px;">
          <thead>
            <tr style="background: #1976d2; color: white;">
              <th style="padding: 10px; text-align: left;">Grado</th>
              <th style="padding: 10px; text-align: right;">UF</th>
              <th style="padding: 10px; text-align: right;">Valor 2026 (CLP)</th>
            </tr>
          </thead>
          <tbody>
            ${licenseValues2026.map(row => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px;"><strong>${row.grado}</strong></td>
                <td style="padding: 10px; text-align: right;">${row.uf.toFixed(2)} UF</td>
                <td style="padding: 10px; text-align: right; color: #1976d2;"><strong>$${Math.round(row.uf * ufValue).toLocaleString('es-CL')}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 15px; text-align: right;">
          <em>* UF actual: $${ufValue.toLocaleString('es-CL')} (actualizado ${ufData.date})</em>
        </p>
      </div>
    `;
  } catch (e) {
    console.error('Error loading license table 2026:', e);
    const container = document.getElementById('licenseTableContainer');
    if (container) {
      container.innerHTML = `<p style="color: red; text-align: center;">Error al cargar valores de licencias: ${e.message}</p>`;
    }
  }
}

// Load fees
async function loadFees() {
  try {
    // Load UF value first
    await loadUFValue();

    const res = await fetch(`${API}/api/fees`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const fees = await res.json();
    const container = document.getElementById('feesList');

    if (!Array.isArray(fees) || fees.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No hay montos registrados</p>';
    } else {
      container.innerHTML = `
        <table>
          <tr><th>Año</th><th>Matrícula</th><th>Mensualidad</th><th>Acciones</th></tr>
          ${fees.map(f => `
            <tr>
              <td><strong>${f.year}</strong></td>
              <td>$${f.enrollment_amount.toLocaleString('es-CL')}</td>
              <td>$${f.monthly_amount.toLocaleString('es-CL')}</td>
              <td>
                <button class="btn" onclick="editFees(${f.year}, ${f.enrollment_amount}, ${f.monthly_amount}, ${f.license_amount})" style="font-size: 12px; padding: 5px 10px;">✏️</button>
                <button class="btn btn-danger" onclick="deleteFees(${f.year})" style="font-size: 12px; padding: 5px 10px;">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    // Load license values table for 2026
    loadLicenseTable2026();
  } catch (e) {
    document.getElementById('feesList').innerHTML = '<p style="color: red; text-align: center;">Error: ' + e.message + '</p>';
  }
}

// Save fees
async function saveFees() {
  const year = parseInt(document.getElementById('feesYear').value);
  const enrollment_amount = parseFloat(document.getElementById('enrollmentAmount').value) || 0;
  const monthly_amount = parseFloat(document.getElementById('monthlyAmount').value) || 0;
  
  // Calculate license amount automatically (using 6 KYU = 0.31 UF)
  let license_amount = 0;
  try {
    const res = await fetch(`${API}/api/uf/valor`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const ufData = await res.json();
    if (ufData.success) {
      license_amount = Math.round(0.31 * ufData.uf_value);
    }
  } catch (e) {
    console.error('Error calculating license amount:', e);
  }

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
    alert('Montos guardados. Licencia calculada automáticamente: $' + license_amount.toLocaleString('es-CL'));
    hideForm('feesForm');
    loadFees();
  } catch (e) { alert('Error: ' + e.message); }
}

// Edit fees
function editFees(year, enrollment_amount, monthly_amount, license_amount) {
  document.getElementById('feesYear').value = year;
  document.getElementById('enrollmentAmount').value = enrollment_amount;
  document.getElementById('monthlyAmount').value = monthly_amount;
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
