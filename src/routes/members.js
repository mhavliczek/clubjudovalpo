const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { validarRut, obtenerCuerpoRut } = require('../utils/rut');
const { calculatePaymentStatus, setPaymentStatusOverride, removePaymentStatusOverride } = require('../utils/paymentStatus');

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
    const currentYear = new Date().getFullYear();
    
    // Include guardian info, user info, belt grade history, payments, school info, and payment status
    const membersWithDetails = members.map(member => {
      const guardian = db.prepare('SELECT * FROM guardian_info WHERE member_id = ?').get(member.id);
      const user = db.prepare('SELECT id, email, role FROM users WHERE member_id = ?').get(member.id);
      const beltHistory = db.prepare('SELECT * FROM belt_grades WHERE member_id = ? ORDER BY grade_date DESC').all(member.id);
      const currentBelt = beltHistory.length > 0 ? beltHistory[0].belt_color : null;
      const payments = db.prepare('SELECT * FROM payments WHERE member_id = ? ORDER BY payment_date DESC').all(member.id);
      const school = member.school_id ? db.prepare('SELECT id, name, school_type, commune FROM schools WHERE id = ?').get(member.school_id) : null;
      const paymentStatus = calculatePaymentStatus(member.id);
      
      return {
        ...member,
        guardian_info: guardian || null,
        user_info: user || null,
        belt_grades: beltHistory,
        current_belt: currentBelt,
        payments: payments,
        school_info: school || null,
        payment_status: paymentStatus
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
    // Include guardian info, belt grade history, school info, payments, and payment status
    const guardian = db.prepare('SELECT * FROM guardian_info WHERE member_id = ?').get(member.id);
    const beltHistory = db.prepare('SELECT * FROM belt_grades WHERE member_id = ? ORDER BY grade_date DESC').all(member.id);
    const payments = db.prepare('SELECT * FROM payments WHERE member_id = ? ORDER BY payment_date DESC').all(member.id);
    const school = member.school_id ? db.prepare('SELECT id, name, school_type, commune FROM schools WHERE id = ?').get(member.school_id) : null;
    const paymentStatus = calculatePaymentStatus(member.id);

    res.json({
      ...member,
      guardian_info: guardian || null,
      school_info: school || null,
      belt_grades: beltHistory,
      payments: payments,
      payment_status: paymentStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set payment status override (admin only)
router.post('/:id/payment-status', requireAdmin, (req, res) => {
  const { year, status, reason } = req.body;
  
  if (!year || !status) {
    return res.status(400).json({ error: 'Año y estado son requeridos' });
  }
  
  const result = setPaymentStatusOverride(req.params.id, year, status, reason);
  if (result.success) {
    res.json({ message: 'Estado actualizado' });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Remove payment status override (admin only)
router.delete('/:id/payment-status/:year', requireAdmin, (req, res) => {
  const result = removePaymentStatusOverride(req.params.id, parseInt(req.params.year));
  if (result.success) {
    res.json({ message: 'Estado manual eliminado' });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Create new member (admin only)
router.post('/', requireAdmin, (req, res) => {
  const {
    first_name, last_name, email, phone, date_of_birth,
    address, association, emergency_contact, emergency_phone, medical_info,
    rut, document_type, member_type, is_honorary, guardian_id,
    is_board_member, board_position, profession, weight, medical_conditions,
    is_guardian, guardian_info, create_user, user_role,
    condition, school_id, education_level, grade_course,
    is_commission_member, commission_type, join_date
  } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
  }

  // Validar RUT solo si es tipo RUT
  if (document_type === 'rut' && rut) {
    if (!validarRut(rut)) {
      return res.status(400).json({ error: 'RUT inválido. Verifique el formato y dígito verificador.' });
    }
  }

  // Validar pasaporte (solo verificar que no esté vacío)
  if (document_type === 'passport' && !rut) {
    return res.status(400).json({ error: 'El número de pasaporte no puede estar vacío.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO members (first_name, last_name, email, phone, date_of_birth, address, association, emergency_contact, emergency_phone, medical_info, rut, document_type, member_type, is_honorary, guardian_id, is_board_member, board_position, profession, weight, medical_conditions, is_guardian, condition, school_id, education_level, grade_course, join_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      first_name, last_name, email || null, phone || null,
      date_of_birth || null, address || null, association || null,
      emergency_contact || null, emergency_phone || null,
      medical_info || null, rut || null, document_type || 'rut',
      member_type || 'deportista', is_honorary || 0, guardian_id || null,
      is_board_member || 0, board_position || null,
      profession || null, weight || null, medical_conditions || null,
      is_guardian || 0,
      condition || 'profession',
      school_id || null,
      education_level || null,
      grade_course || null,
      join_date || null
    );

    const memberId = result.lastInsertRowid;

    // Save guardian info if provided
    if (guardian_info && is_guardian) {
      const { full_name, rut: guardian_rut, document_type: guardian_document_type, date_of_birth: guardian_dob, profession: guardian_profession, address: guardian_address, email: guardian_email, phone: guardian_phone } = guardian_info;
      // Validar RUT solo si es tipo RUT
      if (guardian_document_type === 'rut' && guardian_rut && !validarRut(guardian_rut)) {
        return res.status(400).json({ error: 'RUT del apoderado inválido' });
      }
      // Validar pasaporte
      if (guardian_document_type === 'passport' && !guardian_rut) {
        return res.status(400).json({ error: 'El número de pasaporte del apoderado no puede estar vacío.' });
      }
      db.prepare(`
        INSERT INTO guardian_info (member_id, full_name, rut, document_type, date_of_birth, profession, address, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(memberId, full_name, guardian_rut, guardian_document_type || 'rut', guardian_dob, guardian_profession, guardian_address, guardian_email, guardian_phone);
    }

    // Create user if requested
    if (create_user && email) {
      const bcrypt = require('bcryptjs');
      // Contraseña por defecto: últimos 4 dígitos del cuerpo del RUT
      const passwordSuffix = rut ? obtenerCuerpoRut(rut).slice(-4) : '1234';
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
    address, association, emergency_contact, emergency_phone, medical_info, status,
    rut, member_type, is_honorary, guardian_id,
    is_board_member, board_position,
    profession, weight, medical_conditions, is_guardian,
    guardian_info, condition, school_id, education_level, grade_course, join_date
  } = req.body;

  // Validar RUT si se proporciona
  if (rut) {
    if (!validarRut(rut)) {
      return res.status(400).json({ error: 'RUT inv��lido. Verifique el formato y dígito verificador.' });
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
        association = COALESCE(?, association),
        emergency_contact = COALESCE(?, emergency_contact),
        emergency_phone = COALESCE(?, emergency_phone),
        medical_info = COALESCE(?, medical_info),
        status = COALESCE(?, status),
        rut = COALESCE(?, rut),
        member_type = COALESCE(?, member_type),
        is_honorary = COALESCE(?, is_honorary),
        guardian_id = COALESCE(?, guardian_id),
        is_board_member = COALESCE(?, is_board_member),
        board_position = COALESCE(?, board_position),
        profession = COALESCE(?, profession),
        weight = COALESCE(?, weight),
        medical_conditions = COALESCE(?, medical_conditions),
        is_guardian = COALESCE(?, is_guardian),
        condition = COALESCE(?, condition),
        school_id = COALESCE(?, school_id),
        education_level = COALESCE(?, education_level),
        grade_course = COALESCE(?, grade_course),
        join_date = COALESCE(?, join_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      first_name, last_name, email, phone, date_of_birth,
      address, association, emergency_contact, emergency_phone,
      medical_info, status, rut, member_type,
      is_honorary, guardian_id,
      is_board_member, board_position,
      profession, weight, medical_conditions,
      is_guardian, condition, school_id, education_level, grade_course, join_date, id
    );

    // Update guardian info
    if (is_guardian && guardian_info) {
      const { full_name, rut: guardian_rut, date_of_birth: guardian_dob, profession: guardian_profession, address: guardian_address, email: guardian_email, phone: guardian_phone } = guardian_info;
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
            profession = COALESCE(?, profession),
            address = COALESCE(?, address),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            updated_at = CURRENT_TIMESTAMP
          WHERE member_id = ?
        `).run(full_name, guardian_rut, guardian_dob, guardian_profession, guardian_address, guardian_email, guardian_phone, id);
      } else {
        db.prepare(`
          INSERT INTO guardian_info (member_id, full_name, rut, date_of_birth, profession, address, email, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, full_name, guardian_rut, guardian_dob, guardian_profession, guardian_address, guardian_email, guardian_phone);
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
    // Primero eliminar el usuario asociado (si existe) para liberar el email
    db.prepare('DELETE FROM users WHERE member_id = ?').run(req.params.id);
    
    // Eliminar el miembro (las tablas relacionadas con CASCADE se limpiarán automáticamente)
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
