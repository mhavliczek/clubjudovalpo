const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Get all instructors (admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const { active } = req.query;
    let query = 'SELECT * FROM instructors';
    const params = [];
    
    if (active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY name ASC';
    
    const instructors = db.prepare(query).all(...params);
    res.json(instructors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get instructor by ID
router.get('/:id', requireAdmin, (req, res) => {
  try {
    const instructor = db.prepare('SELECT * FROM instructors WHERE id = ?').get(req.params.id);
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor no encontrado' });
    }
    res.json(instructor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new instructor (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { name, rank, organization, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO instructors (name, rank, organization, is_active)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      rank || null,
      organization || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Instructor creado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update instructor (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, rank, organization, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE instructors SET
        name = ?,
        rank = COALESCE(?, rank),
        organization = COALESCE(?, organization),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      name,
      rank,
      organization,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      id
    );

    res.json({ message: 'Instructor actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete instructor (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM instructors WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Instructor no encontrado' });
    }
    res.json({ message: 'Instructor eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle instructor active status (admin only)
router.patch('/:id/toggle-status', requireAdmin, (req, res) => {
  try {
    const instructor = db.prepare('SELECT * FROM instructors WHERE id = ?').get(req.params.id);
    if (!instructor) {
      return res.status(404).json({ error: 'Instructor no encontrado' });
    }
    
    const newStatus = instructor.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE instructors SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStatus, req.params.id);
    
    res.json({ message: 'Estado actualizado', is_active: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
