// Validar RUT chileno
function validarRut(rut) {
  if (!rut || typeof rut !== 'string') {
    return false;
  }

  // Limpiar RUT (quitar puntos y guión)
  rut = rut.replace(/[.\-]/g, '').toUpperCase();

  // Verificar formato básico (8 o 9 dígitos + K o dígito)
  if (!/^\d{7,8}[0-9K]$/.test(rut)) {
    return false;
  }

  // Separar cuerpo y dígito verificador
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);

  // Calcular dígito verificador
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvCalculado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();

  return dv === dvCalculado;
}

// Obtener solo el cuerpo del RUT (sin dígito verificador)
function obtenerCuerpoRut(rut) {
  if (!rut) return '';
  return rut.replace(/[.\-]/g, '').toUpperCase().slice(0, -1);
}

module.exports = { validarRut, obtenerCuerpoRut };
