const fs = require('fs');
const path = require('path');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Nombre del archivo de log con la fecha de hoy
const today = new Date().toISOString().split('T')[0];
const logFile = path.join(logsDir, `error-${today}.log`);

// Función para escribir en el log
function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  // Escribir en archivo
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });

  // También imprimir en consola (útil para ver en Render)
  console.error('❌ ERROR:', logEntry);
}

// Función para log de información general
function logInfo(message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'INFO',
    message,
    data
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  const infoFile = path.join(logsDir, `info-${today}.log`);

  fs.appendFile(infoFile, logLine, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });

  console.log('ℹ️ INFO:', message, data);
}

// Función para log de warnings
function logWarning(message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'WARNING',
    message,
    data
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  const warnFile = path.join(logsDir, `warning-${today}.log`);

  fs.appendFile(warnFile, logLine, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });

  console.warn('⚠️ WARNING:', message, data);
}

module.exports = {
  logError,
  logInfo,
  logWarning
};
