const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Crear tabla de certificados si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )
`);

// Obtener todos los certificados (solo admin)
router.get('/', requireAdmin, (req, res) => {
  try {
    const certificates = db.prepare(`
      SELECT c.*, u.email as creator_email
      FROM certificates c
      JOIN users u ON c.created_by = u.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(certificates);
  } catch (error) {
    console.error('Error al obtener certificados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo certificado
router.post('/', requireAdmin, (req, res) => {
  const { title, content } = req.body;
  const created_by = req.user.id;

  if (!title || !content) {
    return res.status(400).json({ error: 'Título y contenido son requeridos' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO certificates (title, content, created_by)
      VALUES (?, ?, ?)
    `).run(title, content, created_by);

    res.json({ id: result.lastInsertRowid, message: 'Certificado creado exitosamente' });
  } catch (error) {
    console.error('Error al crear certificado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar certificado
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Título y contenido son requeridos' });
  }

  try {
    const result = db.prepare(`
      UPDATE certificates SET title = ?, content = ? WHERE id = ?
    `).run(title, content, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Certificado no encontrado' });
    }

    res.json({ message: 'Certificado actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar certificado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Generar PDF de certificado
router.get('/:id/pdf', requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const certificate = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificado no encontrado' });
    }

    // Obtener logo del club
    let logoPath = null;
    try {
      const logo = db.prepare("SELECT value FROM settings WHERE key = 'club_logo'").get();
      if (logo && logo.value) {
        logoPath = path.join(__dirname, '..', 'uploads', 'logo.png');
        if (!fs.existsSync(logoPath)) {
          logoPath = null;
        }
      }
    } catch (e) {
      console.error('Error al cargar logo:', e);
    }

    // Obtener firma del director
    let signaturePath = null;
    try {
      const signature = db.prepare("SELECT value FROM settings WHERE key = 'director_signature'").get();
      if (signature && signature.value) {
        signaturePath = path.join(__dirname, '..', 'uploads', 'signature.png');
        if (!fs.existsSync(signaturePath)) {
          signaturePath = null;
        }
      }
    } catch (e) {
      console.error('Error al cargar firma:', e);
    }

    const clubName = process.env.CLUB_NAME || 'Club de Judo Valparaíso';
    const city = process.env.CLUB_CITY || 'Valparaíso';

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 80, bottom: 80, left: 60, right: 60 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.title}.pdf"`);

    doc.pipe(res);

    // ========== LOGO EN ESQUINA SUPERIOR DERECHA ==========
    if (logoPath) {
      doc.image(logoPath, doc.page.width - 120, 40, { width: 80 });
    }

    // ========== MARCA DE AGUA ==========
    if (logoPath) {
      doc.save();
      doc.opacity(0.1);
      doc.image(logoPath, (doc.page.width - 200) / 2, (doc.page.height - 200) / 2, { width: 200 });
      doc.restore();
    }

    // ========== TÍTULO ==========
    doc.moveDown(2);
    doc.fontSize(24).text(certificate.title, { align: 'center' });
    doc.moveDown(2);

    // ========== CONTENIDO ==========
    // Convertir HTML básico a texto (simplificado)
    let content = certificate.content.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<\/p>/gi, '\n\n');
    content = content.replace(/<p>/gi, '');
    content = content.replace(/<strong>/gi, '');
    content = content.replace(/<\/strong>/gi, '');
    content = content.replace(/<em>/gi, '');
    content = content.replace(/<\/em>/gi, '');
    content = content.replace(/<u>/gi, '');
    content = content.replace(/<\/u>/gi, '');
    content = content.replace(/&nbsp;/gi, ' ');

    doc.fontSize(12).text(content, {
      align: 'justify',
      lineGap: 5
    });

    // ========== FECHA Y LUGAR ==========
    doc.moveDown(3);
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('es-CL', options);

    doc.fontSize(11)
       .text(`${city}, ${formattedDate}`, doc.page.width - 200, doc.y, { align: 'right' });

    doc.moveDown(3);

    // ========== FIRMA DEL DIRECTOR ==========
    const signatureY = doc.y;
    const signatureX = (doc.page.width / 2) - 100;

    // Dibujar firma del director (si existe)
    if (signaturePath) {
      try {
        const signatureWidth = 200;
        const signatureHeight = 80;
        const signatureImageX = signatureX + (200 - signatureWidth) / 2;
        doc.image(signaturePath, signatureImageX, signatureY - 50, {
          width: signatureWidth,
          height: signatureHeight,
          align: 'center'
        });
      } catch (e) {
        console.error('Error al agregar firma:', e);
      }
    }

    // Línea para firma
    doc.moveTo(signatureX, signatureY)
       .lineTo(signatureX + 200, signatureY)
       .stroke();

    // Nombre del director
    const directorName = db.prepare("SELECT value FROM settings WHERE key = 'club_director'").get();
    if (directorName && directorName.value) {
      doc.fontSize(10).text(directorName.value, signatureX, signatureY + 5, {
        width: 200,
        align: 'center'
      });
    }

    doc.end();

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar certificado
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM certificates WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Certificado no encontrado' });
    }
    res.json({ message: 'Certificado eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar certificado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;