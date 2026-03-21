const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Get attendance records
router.get('/', (req, res) => {
  const { member_id, start_date, end_date, class_type } = req.query;

  // Non-admin users can only view their own attendance
  const viewMemberId = req.user.role !== 'admin' ? req.user.member_id : member_id;

  let query = `
    SELECT a.*, m.first_name, m.last_name, m.rut, m.photo
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (viewMemberId) {
    query += ' AND a.member_id = ?';
    params.push(viewMemberId);
  } else if (member_id) {
    query += ' AND a.member_id = ?';
    params.push(member_id);
  }
  if (start_date) {
    query += ' AND a.class_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND a.class_date <= ?';
    params.push(end_date);
  }
  if (class_type) {
    query += ' AND a.class_type = ?';
    params.push(class_type);
  }

  query += ' ORDER BY a.class_date DESC, m.last_name';

  try {
    const records = db.prepare(query).all(...params);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance summary for a date range
router.get('/summary', (req, res) => {
  const { start_date, end_date } = req.query;
  
  try {
    const summary = db.prepare(`
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        COUNT(a.id) as attendance_count
      FROM members m
      LEFT JOIN attendance a ON m.id = a.member_id
        AND a.class_date BETWEEN ? AND ?
      WHERE m.status = 'active'
      GROUP BY m.id
      ORDER BY attendance_count DESC
    `).all(start_date || '2000-01-01', end_date || date('now'));
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record attendance (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { member_id, class_date, class_type, notes } = req.body;

  if (!member_id || !class_date) {
    return res.status(400).json({ error: 'Member ID and class date are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO attendance (member_id, class_date, class_type, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(member_id, class_date, class_type || 'regular', notes || null);
    res.json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record attendance for multiple members at once (admin only)
router.post('/bulk', requireAdmin, (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Records must be an array' });
  }

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO attendance (member_id, class_date, class_type, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.member_id,
          record.class_date,
          record.class_type || 'regular',
          record.notes || null
        );
      }
    });
    
    insertMany(records);
    res.json({ message: `${records.length} attendance records saved` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete attendance record (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
