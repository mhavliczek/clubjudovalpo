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
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    document.getElementById('loginError').textContent = 'Ingresa email y contraseña';
    document.getElementById('loginError').classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
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
function initApp() {
  const stored = localStorage.getItem('user');
  if (stored) {
    currentUser = JSON.parse(stored);
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Miembro';

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
