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
const ufRouter = require('./routes/uf');
const curriculumRouter = require('./routes/curriculum');
const settingsRouter = require('./routes/settings');
const certificatesRouter = require('./routes/certificates');
const qrRouter = require('./routes/qr');
const documentsRouter = require('./routes/documents');
const { authenticate, requireAdmin } = require('./middleware/auth');

// Helper function to format dates in Chilean format
function formatDateChile(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

const app = express();
const PORT = process.env.PORT || 3000;
const CLUB_NAME = process.env.CLUB_NAME || 'Judo Club';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), club: CLUB_NAME });
});

// Auth Routes (public)
app.use('/api/auth', authRouter);

// Endpoint para tarjeta PDF - DEBE IR ANTES de /api/members protegido
app.get('/api/members/:id/card/pdf', async (req, res) => {
  try {
    // Aceptar token por query parameter o header
    let token = req.query.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'clubdejudovalpo-secret-key-2026';

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Verificar que el usuario puede acceder a esta tarjeta
    const requestedMemberId = parseInt(req.params.id);
    if (decoded.role !== 'admin' && decoded.member_id !== requestedMemberId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const PDFDocument = require('pdfkit');
    const QRCode = require('qrcode');
    const path = require('path');
    const fs = require('fs');

    const member = db.prepare(`
      SELECT m.*, bg.belt_color
      FROM members m
      LEFT JOIN (
        SELECT member_id, belt_color, grade_date
        FROM belt_grades
        WHERE member_id = ?
        ORDER BY grade_date DESC
        LIMIT 1
      ) bg ON m.id = bg.member_id
      WHERE m.id = ?
    `).get(requestedMemberId, requestedMemberId);

    if (!member) {
      return res.status(404).json({ error: 'Miembro no encontrado' });
    }

    const clubLogo = db.prepare("SELECT value FROM settings WHERE key = 'club_logo'").get();
    const federationLogo = db.prepare("SELECT value FROM settings WHERE key = 'federation_logo'").get();
    const directorSignature = db.prepare("SELECT value FROM settings WHERE key = 'director_signature'").get();
    const directorName = db.prepare("SELECT value FROM settings WHERE key = 'club_director'").get();
    const city = process.env.CLUB_CITY || 'Valparaíso';

    // Generar QR real
    const qrData = JSON.stringify({
      type: 'judo_member',
      member_id: member.id,
      rut: member.rut,
      name: `${member.first_name} ${member.last_name}`
    });
    console.log('📱 QR generado para member_id:', member.id, 'RUT:', member.rut);
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // Cargar foto de perfil si existe
    let memberPhoto = null;
    let tempPhotoPath = null;
    if (member.photo) {
      const photoPath = path.join(__dirname, member.photo);
      if (fs.existsSync(photoPath)) {
        const sharp = require('sharp');
        tempPhotoPath = path.join(__dirname, 'uploads', 'temp-photo-' + member.id + '.png');
        try {
          await sharp(photoPath)
            .rotate()
            .resize(200, 250, { fit: 'inside' })
            .png()
            .toFile(tempPhotoPath);
          memberPhoto = tempPhotoPath;
        } catch (e) {
          memberPhoto = photoPath;
        }
      }
    }

    // Dimensiones tarjeta
    const cardX = 80;
    const cardY = 50;
    const cardW = 240;
    const cardH = 150;
    const cutMargin = 5; // Margen para marcas de corte

    // Crear PDF horizontal - UNA SOLA HOJA CON FRENTE Y DORSO
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'LETTER',
      margins: { top: 30, bottom: 30, left: 30, right: 30 },
      autoFirstPage: false
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tarjeta_${member.first_name}_${member.last_name}.pdf`);
    doc.pipe(res);

    // Agregar UNA sola página para frente y dorso
    doc.addPage({ layout: 'landscape', size: 'LETTER', margins: { top: 30, bottom: 30, left: 30, right: 30 } });

    // ==========================================
    // FRENTE - CON FOTO Y QR (ARRIBA)
    // ==========================================
    
    // Título "Club de Judo Valparaíso" arriba del frente
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Club de Judo Valparaíso', cardX, cardY - 25, { width: cardW, align: 'center' });

    // Líneas de corte (marcas en las 4 esquinas)
    doc.lineWidth(0.5).strokeColor('#999999');
    // Esquina superior izquierda
    doc.moveTo(cardX - cutMargin, cardY).lineTo(cardX, cardY).lineTo(cardX, cardY - cutMargin);
    // Esquina superior derecha
    doc.moveTo(cardX + cardW + cutMargin, cardY).lineTo(cardX + cardW, cardY).lineTo(cardX + cardW, cardY - cutMargin);
    // Esquina inferior izquierda
    doc.moveTo(cardX - cutMargin, cardY + cardH).lineTo(cardX, cardY + cardH).lineTo(cardX, cardY + cardH + cutMargin);
    // Esquina inferior derecha
    doc.moveTo(cardX + cardW + cutMargin, cardY + cardH).lineTo(cardX + cardW, cardY + cardH).lineTo(cardX + cardW, cardY + cardH + cutMargin);

    // Fondo BLANCO con contorno punteado exterior
    doc.rect(cardX, cardY, cardW, cardH).fill('#ffffff');
    doc.lineWidth(1);
    doc.dash(5, 5);
    doc.rect(cardX, cardY, cardW, cardH).stroke('#000000');
    doc.undash();

    // Foto de perfil (izquierda arriba)
    if (memberPhoto) {
      try {
        doc.image(memberPhoto, cardX + 10, cardY + 30, { width: 60, height: 70 });
        doc.rect(cardX + 10, cardY + 30, 60, 70).lineWidth(0.5).stroke('#333333');
      } catch (e) {
        doc.rect(cardX + 10, cardY + 30, 60, 70).fill('#cccccc');
        doc.fillColor('#666666').fontSize(8).text('Error', cardX + 25, cardY + 60, { align: 'center', width: 30 });
      }
    }

    // QR (derecha al centro) - 50px, mismo formato que asistencia
    try {
      doc.image(qrImage, cardX + cardW - 60, cardY + 80, { width: 50, height: 50 });
    } catch (e) {
      doc.rect(cardX + cardW - 60, cardY + 80, 50, 50).fill('#333333');
    }

    // Logo del club (derecha arriba)
    if (clubLogo && clubLogo.value) {
      const logoPath = path.join(__dirname, clubLogo.value);
      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, cardX + cardW - 45, cardY + 5, { height: 22, fit: 'contain' }); } catch (e) {}
      }
    }

    // Datos (centro)
    const dataX = cardX + 80;
    const dataY = cardY + 30;
    
    // Nombre (más grande)
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000').text(`${member.first_name} ${member.last_name}`, dataX, dataY, { width: cardW - 150, align: 'left' });
    
    // Grado (azul)
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1a237e').text(`Grado: ${member.belt_color || 'Sin grado'}`, dataX, dataY + 14);
    
    // Fecha de ingreso
    doc.fontSize(5.5).font('Helvetica').fillColor('#666666').text(`Ingreso: ${member.join_date ? formatDateChile(member.join_date) : 'No reg.'}`, dataX, dataY + 26);
    
    // RUT (grande y claro, sin "No reg.")
    const rutText = member.rut || 'Sin RUT';
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text(`RUT: ${rutText}`, dataX, dataY + 40, { width: cardW - 150 });
    
    // Teléfono (pequeño abajo)
    doc.fontSize(5).font('Helvetica').fillColor('#666666').text(`${member.phone || 'Sin teléfono'}`, dataX, dataY + 54);

    // ==========================================
    // DORSO - DATOS Y LOGO FEDERACION (ABAJO)
    // ==========================================
    const cardY2 = cardY + cardH + 30; // 30px de separación

    // Título "Información de Emergencia" arriba del dorso
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Información de Emergencia', cardX, cardY2 - 25, { width: cardW, align: 'center' });

    // Líneas de corte (marcas en las 4 esquinas)
    doc.lineWidth(0.5).strokeColor('#999999');
    // Esquina superior izquierda
    doc.moveTo(cardX - cutMargin, cardY2).lineTo(cardX, cardY2).lineTo(cardX, cardY2 - cutMargin);
    // Esquina superior derecha
    doc.moveTo(cardX + cardW + cutMargin, cardY2).lineTo(cardX + cardW, cardY2).lineTo(cardX + cardW, cardY2 - cutMargin);
    // Esquina inferior izquierda
    doc.moveTo(cardX - cutMargin, cardY2 + cardH).lineTo(cardX, cardY2 + cardH).lineTo(cardX, cardY2 + cardH + cutMargin);
    // Esquina inferior derecha
    doc.moveTo(cardX + cardW + cutMargin, cardY2 + cardH).lineTo(cardX + cardW, cardY2 + cardH).lineTo(cardX + cardW, cardY2 + cardH + cutMargin);

    // Fondo BLANCO con contorno punteado exterior (DORSO)
    doc.rect(cardX, cardY2, cardW, cardH).fill('#ffffff');
    doc.lineWidth(1);
    doc.dash(5, 5);
    doc.rect(cardX, cardY2, cardW, cardH).stroke('#000000');
    doc.undash();

    // Logo federación (derecha arriba - 40px)
    if (federationLogo && federationLogo.value) {
      const fedLogoPath = path.join(__dirname, federationLogo.value);
      if (fs.existsSync(fedLogoPath)) {
        try { doc.image(fedLogoPath, cardX + cardW - 50, cardY2 + 5, { height: 40, fit: 'contain' }); } catch (e) {}
      }
    }

    // Datos (izquierda y centro)
    const infoX = cardX + 15;
    const infoY = cardY2 + 40;
    doc.fontSize(7).fillColor('#333333');
    doc.text(`Profesión: ${member.profession || 'No reg.'}`, infoX, infoY);
    doc.text(`Teléfono: ${member.phone || 'No reg.'}`, infoX, infoY + 13);
    const comuna = member.address ? member.address.split(',').pop().trim() : 'No reg.';
    doc.text(`Comuna: ${comuna}`, infoX, infoY + 26);
    doc.text(`Emergencia: ${member.emergency_contact || 'No reg.'}`, infoX, infoY + 39);
    if (member.emergency_phone) {
      doc.text(`Tel: ${member.emergency_phone}`, infoX, infoY + 52);
    }

    // Firma (abajo centro-izquierda)
    const sigY = cardY2 + 110;
    const sigX = cardX + 20;
    if (directorSignature && directorSignature.value) {
      const sigPath = path.join(__dirname, directorSignature.value);
      if (fs.existsSync(sigPath)) {
        try { doc.image(sigPath, sigX, sigY, { height: 22, fit: 'contain' }); } catch (e) {}
      }
    }
    doc.moveTo(sigX, sigY + 24).lineTo(sigX + 70, sigY + 24).stroke();
    if (directorName && directorName.value) {
      doc.fontSize(6).font('Helvetica-Bold').text(directorName.value, sigX, sigY + 26, { width: 70, align: 'center' });
    }
    doc.fontSize(4).fillColor('#666666').text('Director Técnico', sigX, sigY + 38, { width: 70, align: 'center' });

    // Limpiar archivo temporal de la foto
    if (tempPhotoPath && fs.existsSync(tempPhotoPath)) {
      try { fs.unlinkSync(tempPhotoPath); } catch (e) {}
    }

    doc.end();
  } catch (error) {
    // Limpiar archivo temporal en caso de error
    if (tempPhotoPath && fs.existsSync(tempPhotoPath)) {
      try { fs.unlinkSync(tempPhotoPath); } catch (e) {}
    }
    console.error('Card PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API Routes (protected)
app.use('/api/members', authenticate, membersRouter);
app.use('/api/grades', authenticate, gradesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/payments', authenticate, paymentsRouter);
app.use('/api/news', authenticate, newsRouter);
app.use('/api/instructors', authenticate, instructorsRouter);
app.use('/api/schools', authenticate, schoolsRouter);
app.use('/api/fees', authenticate, feesRouter);
app.use('/api/uf', authenticate, ufRouter);
app.use('/api/curriculum', curriculumRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/qr', qrRouter);
app.use('/api/documents', authenticate, documentsRouter);

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
