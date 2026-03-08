const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { validarRut } = require('../utils/rut');

// Get all members (admin only)
router.get('/', requireAdmin, (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM members';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY last_name, first_name';

  try {
    const members = db.prepare(query).all(...params);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get member by ID
router.get('/:id', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    // Non-admin users can only view their own member data
    if (req.user.role !== 'admin' && req.user.member_id?.toString() !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new member (admin only)
router.post('/', requireAdmin, (req, res) => {
  const {
    first_name, last_name, email, phone, date_of_birth,
    address, emergency_contact, emergency_phone, medical_info,
    rut, member_type, is_board_member, board_position
  } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
  }

  // Validar RUT si se proporciona
  if (rut) {
    if (!validarRut(rut)) {
      return res.status(400).json({ error: 'RUT inválido. Verifique el formato y dígito verificador.' });
    }
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO members (first_name, last_name, email, phone, date_of_birth, address, emergency_contact, emergency_phone, medical_info, rut, member_type, is_board_member, board_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      first_name, last_name, email || null, phone || null,
      date_of_birth || null, address || null,
      emergency_contact || null, emergency_phone || null,
      medical_info || null, rut || null, member_type || 'judoca',
      is_board_member || 0, board_position || null
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Miembro creado exitosamente'
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El RUT o email ya está registrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update member (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const {
    first_name, last_name, email, phone, date_of_birth,
    address, emergency_contact, emergency_phone, medical_info, status,
    rut, member_type, is_board_member, board_position
  } = req.body;

  // Validar RUT si se proporciona
  if (rut) {
    if (!validarRut(rut)) {
      return res.status(400).json({ error: 'RUT inválido. Verifique el formato y dígito verificador.' });
    }
  }

  try {
    const stmt = db.prepare(`
      UPDATE members SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        date_of_birth = COALESCE(?, date_of_birth),
        address = COALESCE(?, address),
        emergency_contact = COALESCE(?, emergency_contact),
        emergency_phone = COALESCE(?, emergency_phone),
        medical_info = COALESCE(?, medical_info),
        status = COALESCE(?, status),
        rut = COALESCE(?, rut),
        member_type = COALESCE(?, member_type),
        is_board_member = COALESCE(?, is_board_member),
        board_position = COALESCE(?, board_position),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      first_name, last_name, email, phone, date_of_birth,
      address, emergency_contact, emergency_phone,
      medical_info, status, rut, member_type,
      is_board_member, board_position, id
    );

    res.json({ message: 'Miembro actualizado exitosamente' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El RUT o email ya está registrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete member (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
