const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Delete grade (admin only) - MUST BE BEFORE /:memberId route
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    let deleted = false;

    // Try to delete from belt_grades first
    const result1 = db.prepare('DELETE FROM belt_grades WHERE id = ?').run(req.params.id);
    if (result1.changes > 0) deleted = true;

    // Also try to delete from belt_grade_history (for grades created via history table)
    const result2 = db.prepare('DELETE FROM belt_grade_history WHERE id = ?').run(req.params.id);
    if (result2.changes > 0) deleted = true;

    if (!deleted) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all grades (admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const grades = db.prepare(`
      SELECT g.*, m.first_name, m.last_name
      FROM belt_grades g
      JOIN members m ON g.member_id = m.id
      ORDER BY g.grade_date DESC
    `).all();

    res.json(grades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all grades for a member
router.get('/member/:memberId', (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Non-admin users can only view their own grades
    if (!isAdmin && req.user.member_id?.toString() !== req.params.memberId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Admin sees all grades, regular users only see approved ones
    let query;
    if (isAdmin) {
      query = `
        SELECT g.*, m.first_name, m.last_name
        FROM belt_grades g
        JOIN members m ON g.member_id = m.id
        WHERE g.member_id = ?
        ORDER BY g.grade_date DESC
      `;
    } else {
      query = `
        SELECT g.*, m.first_name, m.last_name
        FROM belt_grades g
        JOIN members m ON g.member_id = m.id
        WHERE g.member_id = ? AND g.status = 'approved'
        ORDER BY g.grade_date DESC
      `;
    }

    const grades = db.prepare(query).all(req.params.memberId);
    res.json(grades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current belt for all members
router.get('/current', (req, res) => {
  try {
    const currentBelts = db.prepare(`
      SELECT m.id, m.first_name, m.last_name, g.belt_color, g.grade_date, g.instructor, g.status
      FROM members m
      LEFT JOIN belt_grades g ON m.id = g.member_id
      LEFT JOIN (
        SELECT member_id, MAX(grade_date) as max_date
        FROM belt_grades
        WHERE status = 'approved'
        GROUP BY member_id
      ) latest ON g.member_id = latest.member_id AND g.grade_date = latest.max_date
      WHERE m.status = 'active'
      ORDER BY m.last_name, m.first_name
    `).all();

    res.json(currentBelts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new grade with exam score
router.post('/', (req, res) => {
  const { member_id, belt_color, grade_date, exam_date, score, instructor, otorgado_por, notes } = req.body;

  if (!member_id || !belt_color) {
    return res.status(400).json({ error: 'Member ID y grado son requeridos' });
  }

  // Usar otorgado_por si se envía, sino usar instructor (para compatibilidad)
  const instructorName = otorgado_por || instructor || null;

  // Calcular estado basado en la nota (4.0 o más es aprobado)
  let status = 'pending';
  let status_date = null;

  if (score !== undefined && score !== null) {
    if (score >= 4.0) {
      status = 'approved';
      status_date = grade_date || new Date().toISOString().split('T')[0];
    } else if (score >= 1.0) {
      status = 'failed';
    }
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO belt_grades (member_id, belt_color, grade_date, exam_date, score, status, status_date, instructor, notes)
      VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      member_id,
      belt_color,
      grade_date || null,
      exam_date || null,
      score || null,
      status,
      status_date,
      instructorName,
      notes || null
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Grado registrado exitosamente',
      status: status,
      status_date: status_date
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update grade (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const { belt_color, grade_date, exam_date, score, instructor, notes, status } = req.body;

  try {
    // Calcular estado si se proporciona nota
    let status_update = status;
    let status_date_update = null;
    
    if (score !== undefined && score !== null) {
      if (score >= 4.0) {
        status_update = 'approved';
        status_date_update = grade_date || new Date().toISOString().split('T')[0];
      } else if (score >= 1.0) {
        status_update = 'failed';
      }
    }

    const stmt = db.prepare(`
      UPDATE belt_grades SET
        belt_color = COALESCE(?, belt_color),
        grade_date = COALESCE(?, grade_date),
        exam_date = COALESCE(?, exam_date),
        score = COALESCE(?, score),
        status = COALESCE(?, status),
        status_date = COALESCE(?, status_date),
        instructor = COALESCE(?, instructor),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      belt_color, grade_date, exam_date, score,
      status_update, status_date_update, instructor, notes, req.params.id
    );

    res.json({ message: 'Grado actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
