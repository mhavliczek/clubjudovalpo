/* ===================================
   CLUB DE JUDO - API & UTILS
   =================================== */

// Make API global - use empty string for same origin
window.API = window.location.origin;
let currentUser = null;
let clubName = 'Judo Club';

// Utility Functions
function showForm(id) {
  document.getElementById(id).classList.remove('hidden');
  
  // Initialize member type listener if it's the member form
  if (id === 'memberForm') {
    const memberTypeSelect = document.getElementById('memberType');
    if (memberTypeSelect) {
      // Remove existing listeners to avoid duplicates
      memberTypeSelect.replaceWith(memberTypeSelect.cloneNode(true));
      
      // Re-get the reference after replacement
      const newMemberTypeSelect = document.getElementById('memberType');
      newMemberTypeSelect.addEventListener('change', function() {
        toggleHonoraryInfo();
        checkAgeAndToggleGuardian();
      });
      toggleHonoraryInfo(); // Initial check
    }
    
    // Load guardians list
    if (typeof loadGuardiansSelect === 'function') {
      loadGuardiansSelect();
    }
  }
}
function hideForm(id) { document.getElementById(id).classList.add('hidden'); }

// Format RUT without dots, only with dash (for login field - only if not email)
function formatLoginInput(input) {
  // Si contiene @, es email, no formatear
  if (input.value.includes('@')) {
    return;
  }
  // Si no, formatear como RUT
  formatRut(input);
}

// Format RUT without dots, only with dash
function formatRut(input) {
  let valor = input.value.replace(/[.\-]/g, '').toUpperCase();
  valor = valor.replace(/[^0-9K]/g, '');
  if (valor.length > 1) {
    valor = valor.slice(0, -1) + '-' + valor.slice(-1);
  }
  input.value = valor;
}

// Validate Chilean RUT
function validarRut(rut) {
  if (!rut) return true;
  const rutLimpio = rut.replace(/[.\-]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(rutLimpio)) return false;
  
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);
  let suma = 0, multiplo = 2;
  
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  
  const dvEsperado = 11 - (suma % 11);
  const dvCalculado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
  return dv === dvCalculado;
}

// Check RUT validity
function checkRutValidity(input) {
  const statusSpan = document.getElementById('rutStatus');
  if (!input.value) { statusSpan.textContent = ''; return; }
  statusSpan.textContent = validarRut(input.value) ? '✅' : '❌ RUT inválido';
}

// Format date to Chilean format (DD-MM-AAAA)
function formatDateChile(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}-${month}-${year}`;
}

// Get belt/grade name in Spanish
function getBeltName(grade) {
  if (!grade) return '-';
  const beltMap = {
    'white': '9no Kyu', 'yellow': '8vo Kyu', 'orange': '7mo Kyu',
    'green': '6to Kyu', 'blue': '5to Kyu', 'brown': '4to-1er Kyu', 'black': 'Dan'
  };
  if (beltMap[grade.toLowerCase()]) return beltMap[grade.toLowerCase()];
  return grade.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Get payment type name in Spanish
function getPaymentTypeName(type) {
  const types = {
    'monthly': 'Mensualidad', 'quarterly': 'Trimestral', 'annual': 'Anual',
    'grading': 'Examen', 'competition': 'Competición', 'other': 'Otro'
  };
  return types[type] || type;
}

// Convert date from DD-MM-YYYY to YYYY-MM-DD
function convertDateToISO(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('-') && dateStr.length === 10 && dateStr.indexOf('-') === 4) return dateStr;
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
}
