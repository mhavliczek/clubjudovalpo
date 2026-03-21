const express = require('express');
const router = express.Router();
const db = require('../database');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Helper functions
function getBeltName(belt) {
  if (!belt) return belt;
  const beltMap = {
    '6to kyu': '6º Kyu', '5to kyu': '5º Kyu', '4to kyu': '4º Kyu',
    '3er kyu': '3º Kyu', '2do kyu': '2º Kyu', '1er kyu': '1º Kyu',
    '1er dan': '1º Dan', '2do dan': '2º Dan', '3er dan': '3º Dan',
    '4to dan': '4º Dan', '5to dan': '5º Dan', '6to dan': '6º Dan',
    '7mo dan': '7º Dan', '8vo dan': '8º Dan', '9no dan': '9º Dan', '10mo dan': '10º Dan'
  };
  return beltMap[belt.toLowerCase()] || belt;
}

function formatDateChile(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

// Obtener torneos de un miembro
router.get('/member/:memberId', (req, res) => {
  try {
    const tournaments = db.prepare(`
      SELECT * FROM curriculum 
      WHERE member_id = ? 
      ORDER BY tournament_date DESC
    `).all(req.params.memberId);
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar torneo
router.post('/', (req, res) => {
  try {
    const { member_id, tournament_name, tournament_date, location, tournament_type, category, weight, belt_grade, place_obtained } = req.body;
    
    if (!tournament_name || !tournament_date) {
      return res.status(400).json({ error: 'Nombre y fecha del torneo son requeridos' });
    }

    const stmt = db.prepare(`
      INSERT INTO curriculum (member_id, tournament_name, tournament_date, location, tournament_type, category, weight, belt_grade, place_obtained)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(member_id, tournament_name, tournament_date, location, tournament_type, category, weight, belt_grade, place_obtained);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Torneo agregado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar torneo
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM curriculum WHERE id = ?').run(req.params.id);
    res.json({ message: 'Torneo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar a Excel
router.get('/member/:memberId/excel', (req, res) => {
  try {
    const tournaments = db.prepare(`
      SELECT * FROM curriculum 
      WHERE member_id = ? 
      ORDER BY tournament_date DESC
    `).all(req.params.memberId);

    // Crear CSV
    const csvHeader = 'Torneo,Fecha,Lugar,Tipo,Categoría,Peso,Grado,Lugar\n';
    const csvRows = tournaments.map(t => 
      `"${t.tournament_name}","${t.tournament_date}","${t.location}","${t.tournament_type}","${t.category}","${t.weight}","${t.belt_grade}","${t.place_obtained}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=curriculum.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generar Certificado PDF
router.get('/certificate/:memberId/pdf', async (req, res) => {
  generateCertificatePDF(req, res);
});

// Alias para compatibilidad
router.get('/justificacion/:memberId/pdf', async (req, res) => {
  generateCertificatePDF(req, res);
});

function generateCertificatePDF(req, res) {
  try {
    // Verificar autenticación
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'judo-club-secret-key-change-in-production';
        jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Token inválido' });
      }
    }

    // Obtener la asociación desde query params (si se envía)
    const association = req.query.association || req.query.destinatario || '';

    // Obtener datos del miembro
    const member = db.prepare(`
      SELECT m.*, bg.belt_color, bg.grade_date
      FROM members m
      LEFT JOIN (
        SELECT member_id, belt_color, grade_date
        FROM belt_grades
        WHERE member_id = ?
        ORDER BY grade_date DESC
        LIMIT 1
      ) bg ON m.id = bg.member_id
      WHERE m.id = ?
    `).get(req.params.memberId, req.params.memberId);

    if (!member) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    // Obtener datos del apoderado si existe
    const guardian = db.prepare(`
      SELECT first_name, last_name FROM members WHERE id = ?
    `).get(member.guardian_id || null);

    // Obtener logo del club
    let logoPath = null;
    try {
      const logo = db.prepare("SELECT value FROM settings WHERE key = 'club_logo'").get();
      if (logo && logo.value) {
        // El logo.value es '/uploads/logo.png', la ruta física está en src/uploads/
        logoPath = path.join(__dirname, '..', 'uploads', 'logo.png');
        if (!fs.existsSync(logoPath)) {
          console.log('Logo no existe en:', logoPath);
          logoPath = null;
        } else {
          console.log('Logo encontrado en:', logoPath);
        }
      }
    } catch (e) {
      console.error('Error al cargar logo:', e);
      // Ignorar error
    }

    const clubName = process.env.CLUB_NAME || 'Club de Judo Valparaíso';
    const city = process.env.CLUB_CITY || 'Valparaíso';

    // Obtener nombre del Director
    let directorName = '';
    try {
      const director = db.prepare("SELECT value FROM settings WHERE key = 'club_director'").get();
      if (director && director.value) {
        directorName = director.value;
      }
    } catch (e) {
      // Ignorar error
    }

    // Fechas y horarios de entrenamiento
    const trainingDays = 'martes y jueves';
    const trainingTimeStart = '19:00';
    const trainingTimeEnd = '20:30';

    // Crear PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 80, bottom: 80, left: 60, right: 60 }
    });

    // Configurar headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=justificacion_${member.first_name}_${member.last_name}.pdf`);

    doc.pipe(res);

    // ========== LOGO EN ESQUINA SUPERIOR DERECHA ==========
    if (logoPath) {
      doc.image(logoPath, doc.page.width - 120, 40, { width: 80 });
    }

    // ========== FECHA Y LUGAR ==========
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('es-CL', options);

    doc.fontSize(11)
       .text(`${city}, ${formattedDate}`, doc.page.width - 200, 140, { align: 'right' });

    doc.moveDown(3);

    // ========== DESTINATARIO ==========
    const destinatarioY = 180;
    const destinatario = association || member.association || '';
    
    if (destinatario && destinatario.trim() !== '') {
      doc.fontSize(11)
         .text(`Srs. ${destinatario}`, 60, destinatarioY)
         .text('PRESENTE', 60, destinatarioY + 15);
    } else {
      doc.fontSize(11)
         .text('A quien corresponda:', 60, destinatarioY);
    }

    doc.moveDown(4);

    // ========== CUERPO DEL DOCUMENTO ==========
    const textLeft = 60;
    const textRight = doc.page.width - 60;
    const textWidth = textRight - textLeft;

    doc.fontSize(11).font('Helvetica');

    // Texto justificado
    const guardianName = guardian ? guardian.first_name + ' ' + guardian.last_name : 'el/la apoderado/a';
    const bodyText = `De nuestra consideración, como ${clubName} por petición del socio/a Apoderado/a ${guardianName} y Director del Club ${directorName || 'el Director'}, indicamos que ${member.first_name} ${member.last_name} es judoka activo de nuestro Club, el cual pertenece al grupo selectivo de deportistas que entrenan los días ${trainingDays} desde las ${trainingTimeStart} hrs hasta las ${trainingTimeEnd} hrs para los diversos torneos en que dichos deportistas representan al Club. Hacemos la presente indicación como justificación del retiro anticipado de la deportista en las actividades extra académicas que realiza.`;

    doc.text(bodyText, textLeft, doc.y, {
      width: textWidth,
      align: 'justify',
      lineGap: 5
    });

    doc.moveDown(3);

    // ========== CIERRE ==========
    doc.text('Sin otro particular, nos despedimos atentamente', textLeft, doc.y, {
      width: textWidth,
      align: 'center'
    });

    doc.moveDown(5);

    // ========== FIRMA ==========
    const signatureY = doc.y;
    const signatureX = textLeft + (textWidth / 2) - 100;

    doc.moveTo(signatureX, signatureY)
       .lineTo(signatureX + 200, signatureY)
       .stroke();

    doc.fontSize(11)
       .text(directorName || 'Director Técnico', signatureX, signatureY + 10, { width: 200, align: 'center' })
       .text('Director Técnico', signatureX, signatureY + 25, { width: 200, align: 'center' })
       .text(clubName, signatureX, signatureY + 40, { width: 200, align: 'center' });

    // ========== MARCA DE AGUA ==========
    if (logoPath) {
      doc.opacity(0.05);
      doc.image(logoPath, doc.page.width / 2 - 150, doc.page.height / 2 - 150, {
        width: 300,
        align: 'center'
      });
      doc.opacity(1);
    }

    doc.end();
  } catch (error) {
    console.error('Certificate PDF error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generar Curriculum Deportivo PDF
router.get('/curriculum/:memberId/pdf', async (req, res) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'judo-club-secret-key-change-in-production';
        jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Token inválido' });
      }
    }

    const member = db.prepare(`
      SELECT m.*, bg.belt_color, bg.grade_date
      FROM members m
      LEFT JOIN (
        SELECT member_id, belt_color, grade_date
        FROM belt_grades
        WHERE member_id = ? AND status = 'approved'
        ORDER BY grade_date DESC
        LIMIT 1
      ) bg ON m.id = bg.member_id
      WHERE m.id = ?
    `).get(req.params.memberId, req.params.memberId);

    if (!member) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    const tournaments = db.prepare(`
      SELECT * FROM curriculum
      WHERE member_id = ?
      ORDER BY tournament_date DESC
    `).all(req.params.memberId);

    // Obtener solo grados aprobados para el historial
    const approvedGrades = db.prepare(`
      SELECT belt_color, grade_date, status_date
      FROM belt_grades
      WHERE member_id = ? AND status = 'approved'
      ORDER BY grade_date DESC
    `).all(req.params.memberId);

    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=curriculum_${member.first_name}_${member.last_name}.pdf`);

    doc.pipe(res);

    // Título
    doc.fontSize(20).text('Curriculum Deportivo', { align: 'center' });
    doc.moveDown(1);
    
    // Datos del deportista
    doc.fontSize(12).text(`Nombre: ${member.first_name} ${member.last_name}`);
    doc.text(`Grado Actual: ${member.belt_color || 'No registrado'}`);
    doc.moveDown(2);

    // Historial de Grados Aprobados
    if (approvedGrades && approvedGrades.length > 0) {
      doc.fontSize(14).text('Historial de Grados Aprobados', { underline: true });
      doc.moveDown(1);
      
      approvedGrades.forEach((g, i) => {
        doc.fontSize(11).text(`${i + 1}. ${getBeltName(g.belt_color)} - ${formatDateChile(g.grade_date)}`);
      });
      doc.moveDown(2);
    }

    // Tabla de torneos
    if (tournaments.length > 0) {
      doc.fontSize(14).text('Torneos Participados', { underline: true });
      doc.moveDown(1);
      
      tournaments.forEach((t, i) => {
        doc.fontSize(11).text(`${i + 1}. ${t.tournament_name}`);
        doc.fontSize(10).text(`   Fecha: ${t.tournament_date} | Lugar: ${t.location}`);
        doc.text(`   Categoría: ${t.category} | Peso: ${t.weight} | Lugar: ${t.place_obtained}`);
        doc.moveDown(1);
      });
    } else {
      doc.fontSize(12).text('No hay torneos registrados.', { align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('Curriculum PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
