const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imágenes, PDF, DOC, TXT'));
    }
  }
});

// Get all news (public for logged in users)
router.get('/', (req, res) => {
  try {
    const news = db.prepare(`
      SELECT n.*, u.email as author_email
      FROM news n
      LEFT JOIN users u ON n.author_id = u.id
      ORDER BY n.created_at DESC
    `).all();

    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single news
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare(`
      SELECT n.*, u.email as author_email
      FROM news n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?
    `).get(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create news with optional file upload (admin only)
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Título y contenido son requeridos' });
  }

  try {
    const filePath = req.file ? '/uploads/' + req.file.filename : null;
    const fileName = req.file ? req.file.originalname : null;
    const fileType = req.file ? req.file.mimetype : null;

    const stmt = db.prepare(`
      INSERT INTO news (title, content, author_id, file_path, file_name, file_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      content,
      req.user.id,
      filePath,
      fileName,
      fileType
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Noticia creada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete news (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const news = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
    
    if (!news) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Delete file if exists
    if (news.file_path) {
      const fullPath = path.join(__dirname, '..', news.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
    res.json({ message: 'Noticia eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
