const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const membersRouter = require('./routes/members');
const gradesRouter = require('./routes/grades');
const attendanceRouter = require('./routes/attendance');
const paymentsRouter = require('./routes/payments');
const authRouter = require('./routes/auth');
const newsRouter = require('./routes/news');
const instructorsRouter = require('./routes/instructors');
const schoolsRouter = require('./routes/schools');
const feesRouter = require('./routes/fees');
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const CLUB_NAME = process.env.CLUB_NAME || 'Judo Club';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), club: CLUB_NAME });
});

// Auth Routes (public)
app.use('/api/auth', authRouter);

// API Routes (protected)
app.use('/api/members', authenticate, membersRouter);
app.use('/api/grades', authenticate, gradesRouter);
app.use('/api/attendance', authenticate, attendanceRouter);
app.use('/api/payments', authenticate, paymentsRouter);
app.use('/api/news', authenticate, newsRouter);
app.use('/api/instructors', authenticate, instructorsRouter);
app.use('/api/schools', authenticate, schoolsRouter);
app.use('/api/fees', authenticate, feesRouter);

// Config endpoint (public)
app.get('/api/config', (req, res) => {
  res.json({ clubName: CLUB_NAME });
});

// Dashboard stats endpoint
app.get('/api/stats', authenticate, (req, res) => {
  try {
    const stats = {
      totalMembers: db.prepare("SELECT COUNT(*) as count FROM members WHERE status = 'active'").get().count,
      totalPayments: db.prepare('SELECT SUM(amount) as total FROM payments').get().total || 0,
      attendanceToday: db.prepare("SELECT COUNT(*) as count FROM attendance WHERE class_date = date('now')").get().count,
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Static files (after API routes)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve index.html for non-API routes (SPA)
app.get('/{*splat}', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Judo Club Server running on http://localhost:${PORT}`);
  console.log('API Endpoints:');
  console.log('  GET    /health');
  console.log('  GET    /api/stats');
  console.log('  GET    /api/members');
  console.log('  POST   /api/members');
  console.log('  GET    /api/grades/current');
  console.log('  POST   /api/grades');
  console.log('  GET    /api/attendance');
  console.log('  POST   /api/attendance');
  console.log('  GET    /api/payments');
  console.log('  POST   /api/payments');
});
