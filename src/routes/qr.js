const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin, authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// Configurar multer para uploads de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'photos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// Subir foto de perfil
router.post('/upload-photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen' });
    }

    const memberId = req.user.role === 'admin' ? req.body.member_id : req.user.member_id;
    
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID requerido' });
    }

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    db.prepare(`
      UPDATE members SET photo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(photoUrl, memberId);

    res.json({
      message: 'Foto subida exitosamente',
      photo_url: photoUrl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generar QR para miembro
router.get('/generate-qr/:memberId', authenticate, async (req, res) => {
  try {
    const memberId = req.params.memberId;
    
    // Obtener datos del miembro
    const member = db.prepare(`
      SELECT id, first_name, last_name, rut, document_type, photo
      FROM members
      WHERE id = ?
    `).get(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.member_id?.toString() !== memberId) {
      // Verificar si es apoderado del miembro
      const isGuardian = db.prepare(`
        SELECT id FROM members
        WHERE id = ? AND guardian_id = ?
      `).get(memberId, req.user.member_id);

      if (!isGuardian) {
        return res.status(403).json({ error: 'No tienes permiso para generar este QR' });
      }
    }

    // Crear datos del QR (RUT + Nombre)
    const rut = member.rut || member.document_type;
    const fullName = `${member.first_name} ${member.last_name}`;
    
    // Datos en formato JSON para el QR
    const qrData = {
      type: 'judo_member',
      member_id: memberId,
      rut: rut,
      name: fullName,
      timestamp: new Date().toISOString()
    };

    // Generar QR como imagen en base64
    const qrDataString = JSON.stringify(qrData);
    const qrCodeImage = await QRCode.toDataURL(qrDataString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({
      member_id: memberId,
      name: fullName,
      rut: rut,
      photo: member.photo,
      qr_code: qrCodeImage,
      qr_data: qrData
    });
  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener hijos de un apoderado
router.get('/my-children', authenticate, async (req, res) => {
  try {
    const guardianId = req.user.member_id;

    if (!guardianId) {
      return res.status(400).json({ error: 'Usuario no es apoderado' });
    }

    const children = db.prepare(`
      SELECT m.id, m.first_name, m.last_name, m.rut, m.date_of_birth, m.photo, m.status
      FROM members m
      WHERE m.guardian_id = ?
      ORDER BY m.last_name, m.first_name
    `).all(guardianId);

    res.json(children);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener datos de miembro por QR (para admin - escanear QR)
router.post('/scan-qr', requireAdmin, (req, res) => {
  try {
    const { qr_data } = req.body;

    if (!qr_data || qr_data.type !== 'judo_member') {
      return res.status(400).json({ error: 'QR inválido' });
    }

    const member = db.prepare(`
      SELECT m.id, m.first_name, m.last_name, m.rut, m.photo, m.status, m.guardian_id,
             g.first_name as guardian_first_name, g.last_name as guardian_last_name
      FROM members m
      LEFT JOIN members g ON m.guardian_id = g.id
      WHERE m.id = ?
    `).get(qr_data.member_id);

    if (!member) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    // Verificar que el RUT coincida
    if (member.rut !== qr_data.rut) {
      return res.status(400).json({ 
        error: 'El RUT del QR no coincide con el miembro',
        security_alert: true
      });
    }

    // Registrar asistencia automáticamente
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Verificar si ya tiene asistencia hoy
      const existingAttendance = db.prepare(`
        SELECT id FROM attendance WHERE member_id = ? AND class_date = ?
      `).get(qr_data.member_id, today);

      let attendanceRegistered = false;
      let attendanceId = null;

      if (!existingAttendance) {
        // Registrar nueva asistencia
        const result = db.prepare(`
          INSERT INTO attendance (member_id, class_date, class_type, notes)
          VALUES (?, ?, 'regular', 'Registrado vía QR')
        `).run(qr_data.member_id, today);
        
        attendanceRegistered = true;
        attendanceId = result.lastInsertRowid;
      } else {
        attendanceId = existingAttendance.id;
      }

      res.json({
        member: {
          id: member.id,
          name: `${member.first_name} ${member.last_name}`,
          rut: member.rut,
          photo: member.photo,
          status: member.status,
          guardian: member.guardian_first_name ? 
            `${member.guardian_first_name} ${member.guardian_last_name}` : null
        },
        valid: true,
        attendance: {
          registered: attendanceRegistered,
          already_registered: !attendanceRegistered,
          date: today,
          id: attendanceId
        }
      });
    } catch (attendanceError) {
      console.error('Error registering attendance:', attendanceError);
      // Retornar datos del miembro pero indicar error en asistencia
      res.json({
        member: {
          id: member.id,
          name: `${member.first_name} ${member.last_name}`,
          rut: member.rut,
          photo: member.photo,
          status: member.status,
          guardian: member.guardian_first_name ? 
            `${member.guardian_first_name} ${member.guardian_last_name}` : null
        },
        valid: true,
        attendance: {
          error: attendanceError.message
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
