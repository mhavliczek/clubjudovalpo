const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Configurar multer para uploads (aceptar cualquier imagen)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'logo-' + Date.now() + '.png'); // Siempre guardar como PNG
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max para procesamiento
  fileFilter: (req, file, cb) => {
    // Aceptar cualquier tipo de imagen
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Subir logo
router.post('/logo', requireAdmin, upload.single('logo'), async (req, res) => {
  console.log('📤 Logo upload request received');
  console.log('File:', req.file);
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const inputPath = req.file.path;
    
    console.log('📁 Input path:', inputPath);

    // Verificar que el archivo existe
    try {
      await fs.promises.access(inputPath);
      console.log('✅ Input file exists');
    } catch (e) {
      console.log('❌ Input file does not exist');
      return res.status(400).json({ error: 'El archivo subido no existe' });
    }

    // Procesar imagen con sharp
    const outputPath = path.join(uploadsDir, 'logo.png');
    console.log('🔧 Processing with sharp...');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);

    try {
      // Obtener información de la imagen primero
      const metadata = await sharp(inputPath).metadata();
      console.log('📊 Image metadata:', metadata);

      // Procesar y guardar como logo.png
      await sharp(inputPath)
        .resize(400, 200, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log('✅ Image processed successfully');

      // Verificar que el archivo de salida existe
      await fs.promises.access(outputPath);
      console.log('✅ Output file exists');

      // Eliminar archivo temporal
      await fs.promises.unlink(inputPath);
      console.log('🗑️ Temp file deleted');

      logoUrl = '/uploads/logo.png';
      message = '✅ Logo procesado y subido exitosamente';
    } catch (sharpError) {
      console.error('❌ Sharp error:', sharpError);
      // Copiar archivo original como respaldo
      const finalPath = path.join(uploadsDir, 'logo.png');
      await fs.promises.copyFile(inputPath, finalPath);
      await fs.promises.unlink(inputPath);
      logoUrl = '/uploads/logo.png';
      message = 'Logo subido (formato original)';
    }

    console.log('💾 Logo URL:', logoUrl);
    
    // Guardar en configuración
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at) 
      VALUES ('club_logo', ?, CURRENT_TIMESTAMP)
    `).run(logoUrl);

    res.json({ 
      message: message,
      url: logoUrl 
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener logo
router.get('/logo', (req, res) => {
  try {
    const logo = db.prepare("SELECT value FROM settings WHERE key = 'club_logo'").get();
    res.json({ url: logo ? logo.value : null });
  } catch (error) {
    res.json({ url: null });
  }
});

// Guardar nombre del Director
router.post('/director', requireAdmin, (req, res) => {
  try {
    const { value } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('club_director', ?, CURRENT_TIMESTAMP)
    `).run(value);

    res.json({ message: 'Director guardado exitosamente', value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener nombre del Director
router.get('/director', (req, res) => {
  try {
    const director = db.prepare("SELECT value FROM settings WHERE key = 'club_director'").get();
    res.json({ value: director ? director.value : null });
  } catch (error) {
    res.json({ value: null });
  }
});

// Obtener configuración del club
router.get('/config', (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const config = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });
    
    res.json({
      clubName: process.env.CLUB_NAME || 'Judo Club',
      logo: config.club_logo || null
    });
  } catch (error) {
    res.json({
      clubName: process.env.CLUB_NAME || 'Judo Club',
      logo: null
    });
  }
});

module.exports = router;
