const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'judo-club-secret-key-change-in-production';

// Middleware para verificar autenticación
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware para verificar rol de admin (incluye authenticate)
function requireAdmin(req, res, next) {
  // Primero autenticar
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware para verificar que el usuario es dueño de los datos
function requireOwnerOrAdmin(req, res, next) {
  if (req.user.role === 'admin') {
    return next();
  }
  
  const memberId = req.params.memberId || req.body.member_id || req.query.member_id;
  
  if (memberId && memberId.toString() !== req.user.member_id?.toString()) {
    return res.status(403).json({ error: 'Acceso denegado. Solo puedes ver tus propios datos.' });
  }
  
  next();
}

module.exports = { authenticate, requireAdmin, requireOwnerOrAdmin, JWT_SECRET };
