const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const puppeteer = require('puppeteer');
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
router.get('/:id/pdf', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const certificate = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificado no encontrado' });
    }

    // Obtener logo del club como base64
    let logoBase64 = null;
    try {
      const logo = db.prepare("SELECT value FROM settings WHERE key = 'club_logo'").get();
      if (logo && logo.value) {
        const logoPath = path.join(__dirname, '..', 'uploads', 'logo.png');
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          const mimeType = 'image/png'; // Asumir PNG
          logoBase64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
        }
      }
    } catch (e) {
      console.error('Error al cargar logo:', e);
    }

    // Generar HTML con marca de agua
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            position: relative;
          }
          .logo-small {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 80px;
            height: auto;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            opacity: 0.1;
            width: 300px;
            height: auto;
            z-index: -1;
          }
          .content {
            position: relative;
            z-index: 1;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
          }
        </style>
      </head>
      <body>
        ${logoBase64 ? `<img src="${logoBase64}" class="logo-small" alt="Logo">` : ''}
        ${logoBase64 ? `<img src="${logoBase64}" class="watermark" alt="Marca de agua">` : ''}
        <div class="content">
          <h1>${certificate.title}</h1>
          ${certificate.content}
        </div>
      </body>
      </html>
    `;

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.title}.pdf"`);
    res.send(pdfBuffer);

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