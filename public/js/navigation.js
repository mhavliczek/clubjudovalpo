/* ===================================
   CLUB DE JUDO - NAVIGATION MODULE
   =================================== */

// Toggle mobile sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar && overlay) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  }
}

// Show section in right panel
function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  // Show selected section
  const section = document.getElementById(sectionName + 'Section');
  if (section) {
    section.classList.remove('hidden');
  }

  // Load data based on section
  const loaders = {
    'dashboard': () => loadStats(),
    'members': () => loadMembers(),
    'instructors': () => loadInstructorsSection(),
    'schools': () => loadSchools(),
    'fees': () => loadFees(),
    'attendance': () => loadAttendance(),
    'news': () => loadNews(),
    'settings': () => window.SettingsModule?.init()
  };

  if (loaders[sectionName]) {
    loaders[sectionName]();
  }
}

// Toggle guardian form visibility
function toggleGuardianForm() {
  const isGuardian = document.getElementById('isGuardian').checked;
  const guardianForm = document.getElementById('guardianForm');
  guardianForm.classList.toggle('hidden', !isGuardian);
}

// Toggle user creation form visibility
function toggleUserForm() {
  const createUser = document.getElementById('createUser').checked;
  const createUserForm = document.getElementById('createUserForm');
  createUserForm.classList.toggle('hidden', !createUser);
}

// Toggle commission form visibility
function toggleCommissionForm() {
  const isCommission = document.getElementById('isCommissionMember').checked;
  const commissionForm = document.getElementById('commissionForm');
  commissionForm.classList.toggle('hidden', !isCommission);
}

// Filter members by search
function filterMembers() {
  const search = document.getElementById('memberSearch').value.toLowerCase();
  const memberItems = document.querySelectorAll('#membersList > .member-item');
  memberItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(search) ? 'block' : 'none';
  });
}
