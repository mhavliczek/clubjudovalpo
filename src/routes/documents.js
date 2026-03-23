const express = require('express');
const router = express.Router();
const db = require('../database');
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../middleware/auth');

const multer = require('multer');

// Configurar multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, PNG'));
    }
  }
});

// Función para verificar y crear directorio de torneos
function ensureTournamentDocumentsDir() {
  const uploadDir = path.join(__dirname, '..', 'uploads', 'tournament-documents');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

// Configurar multer específico para documentos de torneos
const tournamentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = ensureTournamentDocumentsDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadTournament = multer({ 
  storage: tournamentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// ==========================================
// DOCUMENTOS ADMINISTRATIVOS (ESTATUTOS)
// ==========================================

// Obtener todos los documentos administrativos
router.get('/', (req, res) => {
  const { category } = req.query;

  try {
    let query = `
      SELECT d.*, u.email as created_by_email
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.is_active = 1
    `;

    const params = [];

    if (category) {
      query += ' AND d.category = ?';
      params.push(category);
    }

    query += ' ORDER BY d.created_at DESC';

    const documents = db.prepare(query).all(...params);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DOCUMENTOS DE TORNEOS
// ==========================================
// IMPORTANTE: Estas rutas deben estar ANTES de /:id para evitar conflictos

// Obtener todos los documentos de torneos
router.get('/tournaments', (req, res) => {
  const { category, tournament_name } = req.query;
  
  try {
    let query = `
      SELECT td.*, u.email as created_by_email
      FROM tournament_documents td
      LEFT JOIN users u ON td.created_by = u.id
      WHERE td.is_active = 1
    `;
    
    const params = [];
    
    if (category) {
      query += ' AND td.category = ?';
      params.push(category);
    }
    
    if (tournament_name) {
      query += ' AND td.tournament_name LIKE ?';
      params.push(`%${tournament_name}%`);
    }
    
    query += ' ORDER BY td.tournament_date DESC, td.created_at DESC';
    
    const documents = db.prepare(query).all(...params);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un documento de torneo específico
router.get('/tournaments/:id', (req, res) => {
  try {
    const doc = db.prepare(`
      SELECT td.*, u.email as created_by_email
      FROM tournament_documents td
      LEFT JOIN users u ON td.created_by = u.id
      WHERE td.id = ? AND td.is_active = 1
    `).get(req.params.id);
    
    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir nuevo documento de torneo (admin only)
router.post('/tournaments', requireAdmin, uploadTournament.single('file'), (req, res) => {
  try {
    const { title, description, tournament_name, tournament_date, category } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ error: 'Título y archivo son requeridos' });
    }

    const filePath = '/uploads/tournament-documents/' + req.file.filename;

    const stmt = db.prepare(`
      INSERT INTO tournament_documents (title, description, file_path, file_name, file_type, tournament_name, tournament_date, category, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      description || null,
      filePath,
      req.file.originalname,
      req.file.mimetype,
      tournament_name || null,
      tournament_date || null,
      category || 'bases',
      req.user.id
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Documento de torneo subido exitosamente',
      file_path: filePath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar documento de torneo (admin only)
router.put('/tournaments/:id', requireAdmin, upload.single('file'), (req, res) => {
  try {
    const { title, description, tournament_name, tournament_date, category } = req.body;
    
    const existingDoc = db.prepare('SELECT * FROM tournament_documents WHERE id = ?').get(req.params.id);
    
    if (!existingDoc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    let filePath = existingDoc.file_path;
    let fileName = existingDoc.file_name;
    let fileType = existingDoc.file_type;
    
    // Si se sube un nuevo archivo
    if (req.file) {
      // Eliminar archivo anterior
      const oldFilePath = path.join(__dirname, '..', existingDoc.file_path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
      
      filePath = '/uploads/tournament-documents/' + req.file.filename;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }
    
    const stmt = db.prepare(`
      UPDATE tournament_documents 
      SET title = ?, description = ?, file_path = ?, file_name = ?, file_type = ?, 
          tournament_name = ?, tournament_date = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      title, 
      description || null, 
      filePath, 
      fileName, 
      fileType, 
      tournament_name || existingDoc.tournament_name, 
      tournament_date || existingDoc.tournament_date, 
      category || existingDoc.category, 
      req.params.id
    );
    
    res.json({ message: 'Documento de torneo actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar documento de torneo (admin only)
router.delete('/tournaments/:id', requireAdmin, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM tournament_documents WHERE id = ?').get(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Marcar como inactivo (soft delete)
    db.prepare('UPDATE tournament_documents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    res.json({ message: 'Documento de torneo eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS ADMINISTRATIVAS (/:id) - DEBEN ESTAR AL FINAL
// ==========================================

// Obtener un documento específico
router.get('/:id', (req, res) => {
  try {
    const doc = db.prepare(`
      SELECT d.*, u.email as created_by_email
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = ? AND d.is_active = 1
    `).get(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir nuevo documento administrativo (admin only)
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ error: 'Título y archivo son requeridos' });
    }

    const filePath = '/uploads/documents/' + req.file.filename;

    const stmt = db.prepare(`
      INSERT INTO documents (title, description, file_path, file_name, file_type, category, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      description || null,
      filePath,
      req.file.originalname,
      req.file.mimetype,
      category || 'estatuto',
      req.user.id
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Documento subido exitosamente',
      file_path: filePath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar documento administrativo (admin only)
router.put('/:id', requireAdmin, upload.single('file'), (req, res) => {
  try {
    const { title, description, category } = req.body;

    const existingDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

    if (!existingDoc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    let filePath = existingDoc.file_path;
    let fileName = existingDoc.file_name;
    let fileType = existingDoc.file_type;

    // Si se sube un nuevo archivo
    if (req.file) {
      // Eliminar archivo anterior
      const oldFilePath = path.join(__dirname, '..', existingDoc.file_path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      filePath = '/uploads/documents/' + req.file.filename;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }

    const stmt = db.prepare(`
      UPDATE documents
      SET title = ?, description = ?, file_path = ?, file_name = ?, file_type = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(title, description || null, filePath, fileName, fileType, category || existingDoc.category, req.params.id);

    res.json({ message: 'Documento actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar documento administrativo (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Marcar como inactivo (soft delete)
    db.prepare('UPDATE documents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    res.json({ message: 'Documento eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
