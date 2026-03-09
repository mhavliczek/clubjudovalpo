/* ===================================
   CLUB DE JUDO - NAVIGATION MODULE
   =================================== */

// Show section in right panel
function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  // Show selected section
  document.getElementById(sectionName + 'Section').classList.remove('hidden');
  
  // Load data based on section
  if (sectionName === 'dashboard') loadStats();
  if (sectionName === 'members') loadMembers();
  if (sectionName === 'instructors') loadInstructorsSection();
  if (sectionName === 'attendance') loadAttendance();
  if (sectionName === 'news') loadNews();
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

// Filter members by search
function filterMembers() {
  const search = document.getElementById('memberSearch').value.toLowerCase();
  const memberItems = document.querySelectorAll('#membersList > .member-item');
  memberItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(search) ? 'block' : 'none';
  });
}
