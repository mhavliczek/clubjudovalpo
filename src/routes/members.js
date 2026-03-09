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
    // Include guardian info, user info, belt grade history, and payments for each member
    const membersWithDetails = members.map(member => {
      const guardian = db.prepare('SELECT * FROM guardian_info WHERE member_id = ?').get(member.id);
      const user = db.prepare('SELECT id, email, role FROM users WHERE member_id = ?').get(member.id);
      const beltHistory = db.prepare('SELECT * FROM belt_grade_history WHERE member_id = ? ORDER BY grade_date DESC').all(member.id);
      const currentBelt = beltHistory.length > 0 ? beltHistory[0].belt_color : null;
      const payments = db.prepare('SELECT * FROM payments WHERE member_id = ? ORDER BY payment_date DESC').all(member.id);
      return { 
        ...member, 
        guardian_info: guardian || null,
        user_info: user || null,
        belt_grade_history: beltHistory,
        current_belt: currentBelt,
        payments: payments
      };
    });
    res.json(membersWithDetails);
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
    // Include guardian info and belt grade history
    const guardian = db.prepare('SELECT * FROM guardian_info WHERE member_id = ?').get(member.id);
    const beltHistory = db.prepare('SELECT * FROM belt_grade_history WHERE member_id = ? ORDER BY grade_date DESC').all(member.id);
    res.json({ ...member, guardian_info: guardian || null, belt_grade_history: beltHistory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new member (admin only)
router.post('/', requireAdmin, (req, res) => {
  const {
    first_name, last_name, email, phone, date_of_birth,
    address, emergency_contact, emergency_phone, medical_info,
    rut, member_type, is_board_member, board_position,
    profession, weight, medical_conditions, is_guardian,
    guardian_info, create_user, user_role
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
      INSERT INTO members (first_name, last_name, email, phone, date_of_birth, address, emergency_contact, emergency_phone, medical_info, rut, member_type, is_board_member, board_position, profession, weight, medical_conditions, is_guardian)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      first_name, last_name, email || null, phone || null,
      date_of_birth || null, address || null,
      emergency_contact || null, emergency_phone || null,
      medical_info || null, rut || null, member_type || 'judoca',
      is_board_member || 0, board_position || null,
      profession || null, weight || null, medical_conditions || null,
      is_guardian || 0
    );

    const memberId = result.lastInsertRowid;

    // Save guardian info if provided
    if (guardian_info && is_guardian) {
      const { full_name, rut: guardian_rut, date_of_birth: guardian_dob, address: guardian_address, email: guardian_email, phone: guardian_phone } = guardian_info;
      if (guardian_rut && !validarRut(guardian_rut)) {
        return res.status(400).json({ error: 'RUT del apoderado inválido' });
      }
      db.prepare(`
        INSERT INTO guardian_info (member_id, full_name, rut, date_of_birth, address, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(memberId, full_name, guardian_rut, guardian_dob, guardian_address, guardian_email, guardian_phone);
    }

    // Create user if requested
    if (create_user && email) {
      const bcrypt = require('bcryptjs');
      const passwordSuffix = rut ? rut.slice(-4) : '1234';
      const hashedPassword = bcrypt.hashSync(passwordSuffix, 10);
      db.prepare(`
        INSERT INTO users (email, password, role, member_id)
        VALUES (?, ?, ?, ?)
      `).run(email, hashedPassword, user_role || 'member', memberId);
    }

    res.status(201).json({
      id: memberId,
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
    rut, member_type, is_board_member, board_position,
    profession, weight, medical_conditions, is_guardian,
    guardian_info
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
        profession = COALESCE(?, profession),
        weight = COALESCE(?, weight),
        medical_conditions = COALESCE(?, medical_conditions),
        is_guardian = COALESCE(?, is_guardian),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      first_name, last_name, email, phone, date_of_birth,
      address, emergency_contact, emergency_phone,
      medical_info, status, rut, member_type,
      is_board_member, board_position,
      profession, weight, medical_conditions,
      is_guardian, id
    );

    // Update guardian info
    if (is_guardian && guardian_info) {
      const { full_name, rut: guardian_rut, date_of_birth: guardian_dob, address: guardian_address, email: guardian_email, phone: guardian_phone } = guardian_info;
      if (guardian_rut && !validarRut(guardian_rut)) {
        return res.status(400).json({ error: 'RUT del apoderado inválido' });
      }
      const existingGuardian = db.prepare('SELECT * FROM guardian_info WHERE member_id = ?').get(id);
      if (existingGuardian) {
        db.prepare(`
          UPDATE guardian_info SET
            full_name = COALESCE(?, full_name),
            rut = COALESCE(?, rut),
            date_of_birth = COALESCE(?, date_of_birth),
            address = COALESCE(?, address),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            updated_at = CURRENT_TIMESTAMP
          WHERE member_id = ?
        `).run(full_name, guardian_rut, guardian_dob, guardian_address, guardian_email, guardian_phone, id);
      } else {
        db.prepare(`
          INSERT INTO guardian_info (member_id, full_name, rut, date_of_birth, address, email, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, full_name, guardian_rut, guardian_dob, guardian_address, guardian_email, guardian_phone);
      }
    }

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

// Get belt grade history for a member
router.get('/:id/grade-history', requireAdmin, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM belt_grade_history 
      WHERE member_id = ? 
      ORDER BY grade_date DESC
    `).all(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add belt grade to history
router.post('/:id/grade-history', requireAdmin, (req, res) => {
  const { belt_color, grade_date, instructor, notes } = req.body;

  if (!belt_color || !grade_date) {
    return res.status(400).json({ error: 'Color de cinturón y fecha son requeridos' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO belt_grade_history (member_id, belt_color, grade_date, instructor, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(req.params.id, belt_color, grade_date, instructor || null, notes || null);
    res.status(201).json({ message: 'Grado agregado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update belt grade
router.put('/:id/grade-history/:gradeId', requireAdmin, (req, res) => {
  const { belt_color, grade_date, instructor, notes } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE belt_grade_history SET
        belt_color = COALESCE(?, belt_color),
        grade_date = COALESCE(?, grade_date),
        instructor = COALESCE(?, instructor),
        notes = COALESCE(?, notes)
      WHERE id = ? AND member_id = ?
    `);
    stmt.run(belt_color, grade_date, instructor, notes, req.params.gradeId, req.params.id);
    res.json({ message: 'Grado actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete belt grade
router.delete('/:id/grade-history/:gradeId', requireAdmin, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM belt_grade_history 
      WHERE id = ? AND member_id = ?
    `).run(req.params.gradeId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Grado no encontrado' });
    }
    res.json({ message: 'Grado eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
