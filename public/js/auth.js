/* ===================================
   CLUB DE JUDO - AUTH MODULE
   =================================== */

// Load club config
async function loadConfig() {
  try {
    const res = await fetch(`${API}/api/config`);
    const config = await res.json();
    clubName = config.clubName;
    document.getElementById('loginTitle').textContent = '🥋 ' + clubName;
    document.getElementById('clubTitle').textContent = '🥋 ' + clubName;
    document.title = clubName;
    
    // Load club logo
    loadClubLogo();
  } catch (e) { console.error('Error loading config:', e); }
}

// Load club logo from settings
async function loadClubLogo() {
  try {
    const res = await fetch(`${API}/api/settings/logo`);
    const data = await res.json();
    
    if (data.url) {
      const headerLogo = document.getElementById('headerLogo');
      if (headerLogo) {
        headerLogo.src = data.url;
        headerLogo.style.display = 'block';
      }
    }
  } catch (e) { 
    console.log('No logo configured'); 
  }
}

// Login
async function login() {
  const rut = document.getElementById('loginRut').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!rut || !password) {
    document.getElementById('loginError').textContent = 'Ingresa RUT o email y contraseña';
    document.getElementById('loginError').classList.remove('hidden');
    return;
  }

  try {
    // Determinar si es email (admin) o RUT
    const isEmail = rut.includes('@');
    
    // Si es RUT, limpiar formato (quitar puntos)
    const cleanRut = isEmail ? rut : rut.replace(/\./g, '').toUpperCase();
    
    const loginData = isEmail ? { email: cleanRut, password } : { rut: cleanRut, password };

    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    initApp();
  } catch (e) {
    document.getElementById('loginError').textContent = e.message;
    document.getElementById('loginError').classList.remove('hidden');
  }
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
}

// Initialize App
async function initApp() {
  const stored = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (!token) {
    logout();
    return;
  }

  if (stored) {
    currentUser = JSON.parse(stored);
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Miembro';

    // Show/hide admin-only features
    const certificatesBtn = document.getElementById('certificatesBtn');
    if (certificatesBtn) {
      certificatesBtn.style.display = currentUser.role === 'admin' ? 'block' : 'none';
    }

    // Show/hide registration requests button (admin only)
    const adminRequestsBtn = document.getElementById('adminRequestsBtn');
    if (adminRequestsBtn) {
      adminRequestsBtn.style.display = currentUser.role === 'admin' ? 'block' : 'none';
    }

    // Validate token by making a test request
    try {
      const res = await fetch(`${API}/api/stats`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.status === 401) {
        throw new Error('Token inválido o expirado');
      }
    } catch (e) {
      console.error('Token validation failed:', e);
      logout();
      alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      return;
    }

    if (currentUser.role === 'admin') {
      document.getElementById('adminPanel').classList.remove('hidden');
      document.getElementById('adminNewsPanel').classList.remove('hidden');
      document.getElementById('memberPortal').classList.add('hidden');
      showSection('dashboard');
      loadMembersSelect();

      // Initialize QR Scan module for admin
      if (window.QRScanModule) {
        QRScanModule.init();
      }
    } else {
      document.getElementById('adminPanel').classList.add('hidden');
      document.getElementById('adminNewsPanel').classList.add('hidden');
      document.getElementById('memberPortal').classList.remove('hidden');
      loadMyInfo();
      loadNews();
    }
  }
}

// Change Password
async function changePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword || !newPassword) {
    alert('Completa todos los campos');
    return;
  }
  if (newPassword !== confirmPassword) {
    alert('Las nuevas contraseñas no coinciden');
    return;
  }
  if (newPassword.length < 4) {
    alert('La contraseña debe tener al menos 4 caracteres');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    alert('Contraseña cambiada exitosamente');
    hideForm('changePasswordForm');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
  } catch (e) { alert('Error: ' + e.message); }
}

// ==========================================
// REGISTRO CON RUT
// ==========================================

function showRegisterForm() {
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('registerMessage').textContent = '';
}

function hideRegisterForm() {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('registerRut').value = '';
  document.getElementById('registerFirstName').value = '';
  document.getElementById('registerLastName').value = '';
  document.getElementById('registerPhone').value = '';
  document.getElementById('registerEmail').value = '';
  document.getElementById('registerMessage').textContent = '';
}

async function register() {
  const rut = document.getElementById('registerRut').value.trim();
  const first_name = document.getElementById('registerFirstName').value.trim();
  const last_name = document.getElementById('registerLastName').value.trim();
  const phone = document.getElementById('registerPhone').value.trim();
  const email = document.getElementById('registerEmail').value.trim();

  if (!rut || !first_name || !last_name) {
    document.getElementById('registerMessage').textContent = '❌ RUT, nombre y apellido son requeridos';
    document.getElementById('registerMessage').style.color = '#dc3545';
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut, first_name, last_name, phone, email })
    });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error);

    document.getElementById('registerMessage').textContent = '✅ ' + result.message;
    document.getElementById('registerMessage').style.color = '#28a745';
    
    setTimeout(() => {
      hideRegisterForm();
    }, 3000);
  } catch (e) {
    document.getElementById('registerMessage').textContent = '❌ ' + e.message;
    document.getElementById('registerMessage').style.color = '#dc3545';
  }
}

// ==========================================
// GESTIÓN DE SOLICITUDES (ADMIN)
// ==========================================

async function loadRegistrationRequests() {
  try {
    const res = await fetch(`${API}/api/auth/registration-requests`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const requests = await res.json();

    const container = document.getElementById('registrationRequestsList');
    
    if (requests.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 30px;">No hay solicitudes pendientes</p>';
      return;
    }

    let html = '<div style="display: grid; gap: 15px;">';
    
    requests.forEach(req => {
      const statusColors = {
        'pending': '#ffc107',
        'approved': '#28a745',
        'rejected': '#dc3545'
      };
      
      const statusLabels = {
        'pending': '⏳ Pendiente',
        'approved': '✅ Aprobado',
        'rejected': '❌ Rechazado'
      };

      html += `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColors[req.status]}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0;">${req.first_name} ${req.last_name}</h4>
            <span style="background: ${statusColors[req.status]}; color: #000; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${statusLabels[req.status]}</span>
          </div>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">🆔 RUT: ${req.rut}</p>
          ${req.phone ? `<p style="margin: 5px 0; color: #666; font-size: 14px;">📱 Teléfono: ${req.phone}</p>` : ''}
          ${req.email ? `<p style="margin: 5px 0; color: #666; font-size: 14px;">📧 Email: ${req.email}</p>` : ''}
          <p style="margin: 5px 0; color: #999; font-size: 13px;">📅 Solicitado: ${new Date(req.created_at).toLocaleDateString('es-CL')}</p>
          ${req.reviewed_at ? `<p style="margin: 5px 0; color: #999; font-size: 13px;">📅 Revisado: ${new Date(req.reviewed_at).toLocaleDateString('es-CL')}</p>` : ''}
          ${req.review_notes ? `<p style="margin: 5px 0; color: #666; font-size: 13px; font-style: italic;">💬 Notas: ${req.review_notes}</p>` : ''}
          ${req.status === 'pending' ? `
            <div style="margin-top: 10px; display: flex; gap: 10px;">
              <button class="btn btn-success" onclick="approveRegistration(${req.id})" style="font-size: 12px; padding: 5px 10px;">✅ Aprobar</button>
              <button class="btn btn-danger" onclick="rejectRegistration(${req.id})" style="font-size: 12px; padding: 5px 10px;">❌ Rechazar</button>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    document.getElementById('registrationRequestsList').innerHTML = `<p style="color: #dc3545;">Error: ${e.message}</p>`;
  }
}

async function approveRegistration(requestId) {
  const notes = prompt('Notas opcionales (se enviarán al miembro):');
  
  try {
    const res = await fetch(`${API}/api/auth/registration-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ notes: notes || null })
    });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error);

    alert(`✅ ${result.message}\n\nContraseña temporal: ${result.temp_password}\nEl miembro debe usar su RUT y esta contraseña para ingresar.`);
    loadRegistrationRequests();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function rejectRegistration(requestId) {
  const notes = prompt('Motivo del rechazo (opcional):') || 'Sin comentarios';
  
  if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;
  
  try {
    const res = await fetch(`${API}/api/auth/registration-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ notes })
    });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error);

    alert('✅ Solicitud rechazada');
    loadRegistrationRequests();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
