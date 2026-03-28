/* ===================================
   CLUB DE JUDO - MEMBER PROFILE MODULE
   =================================== */

// Mostrar formulario de edición de perfil
function showEditProfileForm() {
  const form = document.getElementById('editProfileForm');
  if (!form) return;
  
  // Verificar si el usuario tiene member_id
  if (!currentUser?.member_id) {
    alert('⚠️ Solo los miembros con perfil registrado pueden editar sus datos. Los administradores sin perfil de miembro no pueden usar esta función.');
    return;
  }
  
  form.classList.remove('hidden');
  
  // Cargar datos actuales del miembro
  loadProfileData();
}

// Ocultar formulario de edición
function hideEditProfileForm() {
  const form = document.getElementById('editProfileForm');
  if (form) form.classList.add('hidden');
}

// Cargar datos del perfil en el formulario
async function loadProfileData() {
  if (!currentUser?.member_id) return;
  
  try {
    const res = await fetch(`${API}/api/members/${currentUser.member_id}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const member = await res.json();
    
    document.getElementById('editPhone').value = member.phone || '';
    document.getElementById('editAddress').value = member.address || '';
    document.getElementById('editDob').value = member.date_of_birth || '';
    document.getElementById('editGender').value = member.gender || '';
    document.getElementById('editProfession').value = member.profession || '';
    document.getElementById('editWeight').value = member.weight || '';
    document.getElementById('editMedicalInfo').value = member.medical_info || '';
    document.getElementById('editEmergencyContact').value = member.emergency_contact || '';
    document.getElementById('editEmergencyPhone').value = member.emergency_phone || '';
  } catch (e) {
    console.error('Error loading profile:', e);
  }
}

// Guardar cambios del perfil
async function saveProfile() {
  if (!currentUser?.member_id) {
    alert('Error: No se encontró el ID del miembro');
    return;
  }
  
  const data = {
    phone: document.getElementById('editPhone').value,
    address: document.getElementById('editAddress').value,
    date_of_birth: document.getElementById('editDob').value,
    gender: document.getElementById('editGender').value,
    profession: document.getElementById('editProfession').value,
    weight: document.getElementById('editWeight').value,
    medical_info: document.getElementById('editMedicalInfo').value,
    emergency_contact: document.getElementById('editEmergencyContact').value,
    emergency_phone: document.getElementById('editEmergencyPhone').value
  };
  
  try {
    const res = await fetch(`${API}/api/members/profile/${currentUser.member_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    
    alert('✅ Perfil actualizado exitosamente');
    hideEditProfileForm();
    loadMyInfo(); // Recargar información mostrada
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Descargar tarjeta de membresía PDF
function downloadMembershipCard() {
  // Verificar si el usuario tiene member_id
  if (!currentUser?.member_id) {
    alert('⚠️ Solo los miembros con perfil registrado pueden descargar la tarjeta.\n\nSi eres administrador, necesitas tener un perfil de miembro asociado para descargar la tarjeta.');
    return;
  }

  const token = localStorage.getItem('token');
  
  // Usar window.location para descargar el PDF
  const url = `${API}/api/members/${currentUser.member_id}/card/pdf?token=${encodeURIComponent(token)}`;
  window.location.href = url;
}
