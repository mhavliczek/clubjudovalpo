const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Get all schools
router.get('/', requireAdmin, (req, res) => {
  try {
    const { active } = req.query;
    let query = 'SELECT * FROM schools';
    const params = [];
    
    if (active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY name ASC';
    const schools = db.prepare(query).all(...params);
    res.json(schools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active schools (for dropdown)
router.get('/active', (req, res) => {
  try {
    const schools = db.prepare('SELECT id, name, school_type, commune FROM schools WHERE is_active = 1 ORDER BY name').all();
    res.json(schools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get school by ID
router.get('/:id', requireAdmin, (req, res) => {
  try {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'Colegio no encontrado' });
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create school
router.post('/', requireAdmin, (req, res) => {
  const { name, school_type, commune } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const stmt = db.prepare(`
      INSERT INTO schools (name, school_type, commune)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(name, school_type || 'particular', commune || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Colegio creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update school
router.put('/:id', requireAdmin, (req, res) => {
  const { name, school_type, commune } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const stmt = db.prepare(`
      UPDATE schools SET name = ?, school_type = ?, commune = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(name, school_type, commune, req.params.id);
    res.json({ message: 'Colegio actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete school
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM schools WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Colegio no encontrado' });
    res.json({ message: 'Colegio eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle school status
router.patch('/:id/toggle-status', requireAdmin, (req, res) => {
  try {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'Colegio no encontrado' });
    
    const newStatus = school.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE schools SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStatus, req.params.id);
    
    res.json({ message: 'Estado actualizado', is_active: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
