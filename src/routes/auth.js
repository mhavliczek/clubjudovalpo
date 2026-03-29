require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { obtenerCuerpoRut } = require('../utils/rut');

// Usar el mismo JWT_SECRET hardcodeado en todos lados
const JWT_SECRET = 'clubdejudovalpo-secret-key-2026';

// Get all users (admin only) - MUST be before /:id routes
router.get('/users', requireAdmin, (req, res) => {
  console.log('GET /api/auth/users - User:', req.user);
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.role, u.member_id, u.created_at,
             m.first_name, m.last_name
      FROM users u
      LEFT JOIN members m ON u.member_id = m.id
      ORDER BY u.created_at DESC
    `).all();

    console.log('Users found:', users.length);
    res.json(users);
  } catch (error) {
    console.error('Error loading users:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
router.post('/login', (req, res) => {
  const { rut, email, password } = req.body;

  if ((!rut && !email) || !password) {
    return res.status(400).json({ error: 'RUT o email y contraseña son requeridos' });
  }

  try {
    let user;

    // Si es email (administrador u otros usuarios con email)
    if (email && email.includes('@')) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
    // Si es RUT, buscar por member_id
    else if (rut) {
      // Limpiar formato del RUT (quitar puntos, dejar guión)
      const rutLimpio = rut.replace(/\./g, '').toUpperCase();

      // Buscar miembro por RUT
      const member = db.prepare('SELECT id FROM members WHERE rut = ?').get(rutLimpio);

      if (!member) {
        return res.status(401).json({ error: 'Credenciales inválidas. RUT no encontrado.' });
      }

      // Buscar usuario por member_id
      user = db.prepare('SELECT * FROM users WHERE member_id = ?').get(member.id);
      
      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas. Usuario no encontrado.' });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, member_id: user.member_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        member_id: user.member_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user profile
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = db.prepare('SELECT id, email, role, member_id FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// Reset password for user (admin only)
router.post('/reset-password/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Contraseña por defecto: últimos 4 dígitos del RUT (sin dígito verificador)
    let password = '1234'; // Default fallback

    if (user.member_id) {
      const member = db.prepare('SELECT rut FROM members WHERE id = ?').get(user.member_id);
      if (member && member.rut) {
        const cuerpoRut = obtenerCuerpoRut(member.rut);
        // Obtener últimos 4 dígitos
        password = cuerpoRut.slice(-4);
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

    res.json({
      message: 'Contraseña reseteada exitosamente',
      new_password: password
    });
  } catch (error) {
    console.error('Error resetting password:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Reset password by member_id (admin only) - for resetting from member card
router.post('/reset-password', requireAdmin, (req, res) => {
  const { member_id, email } = req.body;

  if (!member_id || !email) {
    return res.status(400).json({ error: 'Member ID y email son requeridos' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE member_id = ? AND email = ?').get(member_id, email);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Contraseña por defecto: últimos 4 dígitos del RUT
    let password = '1234'; // Default fallback

    const member = db.prepare('SELECT rut FROM members WHERE id = ?').get(member_id);
    if (member && member.rut) {
      const cuerpoRut = obtenerCuerpoRut(member.rut);
      // Obtener últimos 4 dígitos
      password = cuerpoRut.slice(-4);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

    res.json({
      message: 'Contraseña reseteada exitosamente',
      new_password: password
    });
  } catch (error) {
    console.error('Error resetting password:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Change own password
router.put('/change-password', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Contraseñas son requeridas' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const validPassword = bcrypt.compareSync(current_password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña actual inválida' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

    res.json({ message: 'Contraseña cambiada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// REGISTRO CON RUT (SIN EMAIL REQUERIDO)
// ==========================================

// Endpoint público para solicitar registro con RUT
router.post('/register', async (req, res) => {
  try {
    const { rut, first_name, last_name, phone, email } = req.body;

    // Validaciones básicas
    if (!rut || !first_name || !last_name) {
      return res.status(400).json({ error: 'RUT, nombre y apellido son requeridos' });
    }

    // Limpiar formato del RUT
    const rutLimpio = rut.replace(/\./g, '').toUpperCase();

    // Verificar si ya existe un miembro con este RUT
    const existingMember = db.prepare('SELECT id FROM members WHERE rut = ?').get(rutLimpio);
    if (existingMember) {
      return res.status(400).json({ error: 'Ya existe un miembro registrado con este RUT' });
    }

    // Verificar si ya existe una solicitud pendiente con este RUT
    const existingRequest = db.prepare('SELECT id, status FROM registration_requests WHERE rut = ?').get(rutLimpio);
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ error: 'Ya existe una solicitud de registro pendiente con este RUT' });
      } else if (existingRequest.status === 'approved') {
        return res.status(400).json({ error: 'Este RUT ya fue aprobado previamente. Por favor contacta al administrador.' });
      }
    }

    // Insertar o actualizar solicitud de registro
    db.prepare(`
      INSERT INTO registration_requests (rut, first_name, last_name, phone, email, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      ON CONFLICT(rut) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = excluded.phone,
        email = excluded.email,
        status = 'pending',
        created_at = CURRENT_TIMESTAMP,
        reviewed_at = NULL,
        reviewed_by = NULL,
        review_notes = NULL
    `).run(rutLimpio, first_name, last_name, phone || null, email || null);

    res.json({
      message: 'Solicitud de registro enviada. El administrador debe aprobarla.',
      rut: rutLimpio
    });
  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ENDPOINTS ADMIN - GESTIÓN DE REGISTROS
// ==========================================

// Obtener todas las solicitudes de registro (admin)
router.get('/registration-requests', requireAdmin, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT r.*, u.email as reviewed_by_email
      FROM registration_requests r
      LEFT JOIN users u ON r.reviewed_by = u.id
      ORDER BY 
        CASE r.status 
          WHEN 'pending' THEN 0 
          WHEN 'approved' THEN 1 
          WHEN 'rejected' THEN 2 
        END,
        r.created_at DESC
    `).all();

    res.json(requests);
  } catch (error) {
    console.error('Error loading registration requests:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Aprobar solicitud de registro (admin)
router.post('/registration-requests/:id/approve', requireAdmin, (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const adminId = req.user.id;

    // Obtener solicitud
    const request = db.prepare('SELECT * FROM registration_requests WHERE id = ? AND status = ?').get(requestId, 'pending');
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada o ya fue procesada' });
    }

    // Crear miembro
    const memberResult = db.prepare(`
      INSERT INTO members (rut, first_name, last_name, phone, email, status, join_date)
      VALUES (?, ?, ?, ?, ?, 'active', date('now'))
    `).run(request.rut, request.first_name, request.last_name, request.phone, request.email);

    const memberId = memberResult.lastInsertRowid;

    // Crear usuario con contraseña por defecto (últimos 4 dígitos del RUT)
    const bcrypt = require('bcryptjs');
    const { obtenerCuerpoRut } = require('../utils/rut');
    const cuerpoRut = obtenerCuerpoRut(request.rut);
    const password = cuerpoRut.slice(-4);
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (email, password, role, member_id)
      VALUES (?, ?, 'member', ?)
    `).run(request.rut, hashedPassword, memberId);

    // Actualizar solicitud
    db.prepare(`
      UPDATE registration_requests 
      SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, review_notes = ?
      WHERE id = ?
    `).run(adminId, req.body.notes || null, requestId);

    res.json({
      message: 'Solicitud aprobada. Miembro creado exitosamente.',
      member_id: memberId,
      rut: request.rut,
      temp_password: password
    });
  } catch (error) {
    console.error('Error approving registration:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Rechazar solicitud de registro (admin)
router.post('/registration-requests/:id/reject', requireAdmin, (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const adminId = req.user.id;

    // Obtener solicitud
    const request = db.prepare('SELECT * FROM registration_requests WHERE id = ? AND status = ?').get(requestId, 'pending');
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada o ya fue procesada' });
    }

    // Actualizar solicitud
    db.prepare(`
      UPDATE registration_requests 
      SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, review_notes = ?
      WHERE id = ?
    `).run(adminId, req.body.notes || 'Sin comentarios', requestId);

    res.json({ message: 'Solicitud rechazada' });
  } catch (error) {
    console.error('Error rejecting registration:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
