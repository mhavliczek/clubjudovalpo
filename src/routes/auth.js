const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { obtenerCuerpoRut } = require('../utils/rut');

const JWT_SECRET = process.env.JWT_SECRET || 'judo-club-secret-key-change-in-production';

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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
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
