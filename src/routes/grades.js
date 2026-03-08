const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

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
    // Non-admin users can only view their own grades
    if (req.user.role !== 'admin' && req.user.member_id?.toString() !== req.params.memberId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const grades = db.prepare(`
      SELECT g.*, m.first_name, m.last_name
      FROM belt_grades g
      JOIN members m ON g.member_id = m.id
      WHERE g.member_id = ?
      ORDER BY g.grade_date DESC
    `).all(req.params.memberId);

    res.json(grades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current belt for all members
router.get('/current', (req, res) => {
  try {
    const currentBelts = db.prepare(`
      SELECT m.id, m.first_name, m.last_name, g.belt_color, g.grade_date, g.instructor
      FROM members m
      LEFT JOIN belt_grades g ON m.id = g.member_id
      LEFT JOIN (
        SELECT member_id, MAX(grade_date) as max_date
        FROM belt_grades
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

// Add new grade
router.post('/', (req, res) => {
  const { member_id, belt_color, instructor, notes } = req.body;

  if (!member_id || !belt_color) {
    return res.status(400).json({ error: 'Member ID and belt color are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO belt_grades (member_id, belt_color, instructor, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(member_id, belt_color, instructor || null, notes || null);
    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Grade recorded successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete grade
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM belt_grades WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
