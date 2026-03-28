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

// Register new user (admin only)
router.post('/register', (req, res) => {
  const { email, password, role, member_id } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = db.prepare(`
      INSERT INTO users (email, password, role, member_id)
      VALUES (?, ?, ?, ?)
    `).run(email, hashedPassword, role || 'member', member_id || null);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Usuario creado exitosamente'
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
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

module.exports = router;
