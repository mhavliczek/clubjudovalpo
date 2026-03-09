const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Get all annual fees
router.get('/', requireAdmin, (req, res) => {
  try {
    const fees = db.prepare('SELECT * FROM annual_fees ORDER BY year DESC').all();
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get fees for specific year
router.get('/year/:year', requireAdmin, (req, res) => {
  try {
    const fees = db.prepare('SELECT * FROM annual_fees WHERE year = ?').get(req.params.year);
    if (!fees) return res.status(404).json({ error: 'No hay montos registrados para este año' });
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current year fees
router.get('/current', (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    let fees = db.prepare('SELECT * FROM annual_fees WHERE year = ?').get(currentYear);
    
    // If no fees for current year, use previous year or return defaults
    if (!fees) {
      fees = {
        year: currentYear,
        enrollment_amount: 0,
        monthly_amount: 0,
        license_amount: 0
      };
    }
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update annual fees
router.post('/', requireAdmin, (req, res) => {
  const { year, enrollment_amount, monthly_amount, license_amount } = req.body;
  
  if (!year || year < 2020) return res.status(400).json({ error: 'Año inválido' });

  try {
    // Check if year exists
    const existing = db.prepare('SELECT id FROM annual_fees WHERE year = ?').get(year);
    
    if (existing) {
      // Update existing
      const stmt = db.prepare(`
        UPDATE annual_fees SET
          enrollment_amount = ?,
          monthly_amount = ?,
          license_amount = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE year = ?
      `);
      stmt.run(enrollment_amount || 0, monthly_amount || 0, license_amount || 0, year);
      res.json({ message: 'Montos actualizados' });
    } else {
      // Insert new
      const stmt = db.prepare(`
        INSERT INTO annual_fees (year, enrollment_amount, monthly_amount, license_amount)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(year, enrollment_amount || 0, monthly_amount || 0, license_amount || 0);
      res.status(201).json({ id: result.lastInsertRowid, message: 'Montos creados' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete annual fees
router.delete('/:year', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM annual_fees WHERE year = ?').run(req.params.year);
    if (result.changes === 0) return res.status(404).json({ error: 'No se encontraron montos para este año' });
    res.json({ message: 'Montos eliminados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
