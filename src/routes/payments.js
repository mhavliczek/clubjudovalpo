const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Get all payments
router.get('/', (req, res) => {
  const { member_id, payment_type, start_date, end_date } = req.query;

  // Non-admin users can only view their own payments
  const viewMemberId = req.user.role !== 'admin' ? req.user.member_id : member_id;

  let query = `
    SELECT p.*, m.first_name, m.last_name
    FROM payments p
    JOIN members m ON p.member_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (viewMemberId) {
    query += ' AND p.member_id = ?';
    params.push(viewMemberId);
  } else if (member_id) {
    query += ' AND p.member_id = ?';
    params.push(member_id);
  }
  if (payment_type) {
    query += ' AND p.payment_type = ?';
    params.push(payment_type);
  }
  if (start_date) {
    query += ' AND p.payment_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND p.payment_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY p.payment_date DESC';

  try {
    const payments = db.prepare(query).all(...params);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment summary by member
router.get('/summary/member/:memberId', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        COUNT(p.id) as payment_count,
        SUM(p.amount) as total_paid,
        MIN(p.payment_date) as first_payment,
        MAX(p.payment_date) as last_payment
      FROM members m
      LEFT JOIN payments p ON m.id = p.member_id
      WHERE m.id = ?
      GROUP BY m.id
    `).get(req.params.memberId);
    
    if (!summary) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get overall payment summary
router.get('/summary/total', (req, res) => {
  const { start_date, end_date } = req.query;
  
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as payment_count,
        SUM(amount) as total_amount,
        AVG(amount) as average_payment
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
    `).get(start_date || '2000-01-01', end_date || '2099-12-31');
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a payment (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { member_id, amount, payment_type, description } = req.body;

  if (!member_id || !amount) {
    return res.status(400).json({ error: 'Member ID and amount are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO payments (member_id, amount, payment_type, description)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      member_id,
      amount,
      payment_type || 'monthly',
      description || null
    );
    
    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Payment recorded successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a payment (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
