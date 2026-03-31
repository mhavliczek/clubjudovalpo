const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get attendance report with summary for all members (admin only)
router.get('/report', requireAdmin, (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    // Get all attendance records with member info
    const query = `
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.rut,
        COUNT(a.id) as total_asistencias,
        MAX(a.class_date) as ultima_asistencia,
        GROUP_CONCAT(DISTINCT a.class_type) as tipos_clase
      FROM members m
      LEFT JOIN attendance a ON m.id = a.member_id
        ${start_date || end_date ? `AND a.class_date BETWEEN '${start_date || '2000-01-01'}' AND '${end_date || date('now')}'` : ''}
      GROUP BY m.id
      ORDER BY total_asistencias DESC
    `;

    const report = db.prepare(query).all();

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance records
router.get('/', authenticate, (req, res) => {
  const { member_id, start_date, end_date, class_type, year, month, page = 1, limit = 20 } = req.query;

  // Non-admin users can only view their own attendance
  const viewMemberId = req.user.role !== 'admin' ? req.user.member_id : member_id;

  let query = `
    SELECT a.*, m.first_name, m.last_name, m.rut, m.photo
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (viewMemberId) {
    query += ' AND a.member_id = ?';
    params.push(viewMemberId);
  } else if (member_id) {
    query += ' AND a.member_id = ?';
    params.push(member_id);
  }
  
  // Filtros por año y mes
  if (year) {
    const startYear = `${year}-01-01`;
    const endYear = `${year}-12-31`;
    query += ' AND a.class_date >= ? AND a.class_date <= ?';
    params.push(startYear, endYear);
    
    if (month) {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? parseInt(year) + 1 : parseInt(year);
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      query += ' AND a.class_date >= ? AND a.class_date < ?';
      params.push(monthStart, monthEnd);
    }
  }
  
  if (start_date) {
    query += ' AND a.class_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND a.class_date <= ?';
    params.push(end_date);
  }
  if (class_type) {
    query += ' AND a.class_type = ?';
    params.push(class_type);
  }

  // Count total records
  const countQuery = query.replace('SELECT a.*, m.first_name, m.last_name, m.rut, m.photo', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  // Pagination
  const pageNum = parseInt(page);
  const pageSize = parseInt(limit);
  const offset = (pageNum - 1) * pageSize;

  query += ' ORDER BY a.class_date DESC, m.last_name LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  try {
    const records = db.prepare(query).all(...params);
    res.json({
      data: records,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance summary for a date range
router.get('/summary', (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    const summary = db.prepare(`
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        COUNT(a.id) as attendance_count
      FROM members m
      LEFT JOIN attendance a ON m.id = a.member_id
        AND a.class_date BETWEEN ? AND ?
      WHERE m.status = 'active'
      GROUP BY m.id
      ORDER BY attendance_count DESC
    `).all(start_date || '2000-01-01', end_date || 'now');

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance summary for a specific member
router.get('/summary/member', (req, res) => {
  const { member_id } = req.query;

  if (!member_id) {
    return res.status(400).json({ error: 'Member ID is required' });
  }

  try {
    const summary = db.prepare(`
      SELECT
        COUNT(a.id) as total_asistencias,
        SUM(CASE WHEN a.class_type = 'regular' THEN 1 ELSE 0 END) as regulares,
        SUM(CASE WHEN a.class_type = 'competition' THEN 1 ELSE 0 END) as competencias,
        SUM(CASE WHEN a.class_type = 'grading' THEN 1 ELSE 0 END) as examenes,
        SUM(CASE WHEN a.class_type = 'special' THEN 1 ELSE 0 END) as especiales,
        MAX(a.class_date) as ultima_asistencia
      FROM attendance a
      WHERE a.member_id = ?
    `).get(member_id);

    res.json(summary || {
      total_asistencias: 0,
      regulares: 0,
      competencias: 0,
      examenes: 0,
      especiales: 0,
      ultima_asistencia: null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record attendance (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { member_id, class_date, class_type, notes } = req.body;

  if (!member_id || !class_date) {
    return res.status(400).json({ error: 'Member ID and class date are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO attendance (member_id, class_date, class_type, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(member_id, class_date, class_type || 'regular', notes || null);
    res.json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record attendance for multiple members at once (admin only)
router.post('/bulk', requireAdmin, (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Records must be an array' });
  }

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO attendance (member_id, class_date, class_type, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.member_id,
          record.class_date,
          record.class_type || 'regular',
          record.notes || null
        );
      }
    });
    
    insertMany(records);
    res.json({ message: `${records.length} attendance records saved` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete attendance record (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export attendance report to Excel (admin only)
router.get('/report/excel', requireAdmin, (req, res) => {
  const { start_date, end_date } = req.query;
  const ExcelJS = require('exceljs');

  try {
    const query = `
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.rut,
        COUNT(a.id) as total_asistencias,
        MAX(a.class_date) as ultima_asistencia,
        GROUP_CONCAT(DISTINCT a.class_type) as tipos_clase
      FROM members m
      LEFT JOIN attendance a ON m.id = a.member_id
        ${start_date || end_date ? `AND a.class_date BETWEEN '${start_date || '2000-01-01'}' AND '${end_date || date('now')}'` : ''}
      GROUP BY m.id
      ORDER BY total_asistencias DESC
    `;

    const report = db.prepare(query).all();

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Reporte de Asistencias');
    const worksheet = workbook.getWorksheet('Reporte de Asistencias');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre', key: 'first_name', width: 20 },
      { header: 'Apellido', key: 'last_name', width: 20 },
      { header: 'RUT', key: 'rut', width: 15 },
      { header: 'Total Asistencias', key: 'total_asistencias', width: 20 },
      { header: 'Última Asistencia', key: 'ultima_asistencia', width: 20 },
      { header: 'Tipos de Clase', key: 'tipos_clase', width: 25 }
    ];

    // Add header style
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data
    report.forEach(row => {
      worksheet.addRow(row);
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_asistencias_${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    return workbook.xlsx.write(res).then(() => {
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Certificado de Asistencia PDF
router.get('/certificate/:memberId', (req, res) => {
  const memberId = parseInt(req.params.memberId);

  let token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'clubdejudovalpo-secret-key-2026';

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) {
    return res.status(404).json({ error: 'Miembro no encontrado' });
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN class_type = 'regular' THEN 1 ELSE 0 END) as regulares
    FROM attendance
    WHERE member_id = ?
  `).get(memberId);

  // Obtener configuración del club
  const clubLogo = db.prepare("SELECT value FROM settings WHERE key = 'club_logo'").get();
  const federationLogo = db.prepare("SELECT value FROM settings WHERE key = 'federation_logo'").get();
  const directorSignature = db.prepare("SELECT value FROM settings WHERE key = 'director_signature'").get();
  const directorName = db.prepare("SELECT value FROM settings WHERE key = 'club_director'").get();
  const city = process.env.CLUB_CITY || 'Valparaíso';

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cert-asistencia-${member.first_name}-${member.last_name}.pdf"`);
  doc.pipe(res);

  try {
    // ========== LOGO DEL CLUB (Esquina superior derecha) ==========
    if (clubLogo && clubLogo.value) {
      const logoPath = path.join(__dirname, '..', clubLogo.value);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, doc.page.width - 120, 40, { width: 80 });
      }
    }

    // ========== MARCA DE AGUA (Centro de la página) ==========
    if (clubLogo && clubLogo.value) {
      const logoPath = path.join(__dirname, '..', clubLogo.value);
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.1);
        doc.image(logoPath, (doc.page.width - 200) / 2, (doc.page.height - 200) / 2, { width: 200 });
        doc.restore();
      }
    }

    // ========== FECHA Y LUGAR ==========
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('es-CL', options);

    doc.fontSize(11)
       .text(`${city}, ${formattedDate}`, doc.page.width - 200, 140, { align: 'right' });

    doc.moveDown(3);

    // ========== TÍTULO ==========
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#000000').text('CERTIFICADO DE ASISTENCIA', 50, doc.y, { align: 'center' });

    doc.moveDown(2);

    // ========== CUERPO DEL CERTIFICADO ==========
    doc.fontSize(12).font('Helvetica').fillColor('#333333');
    
    const bodyText = `El Club de Judo Valparaíso certifica que:`;
    doc.text(bodyText, 50, doc.y, { align: 'center', width: doc.page.width - 100 });

    doc.moveDown(1);

    // Nombre del miembro (grande y en negrita)
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
       .text(`${member.first_name.toUpperCase()} ${member.last_name.toUpperCase()}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });

    doc.moveDown(0.5);

    // RUT
    doc.fontSize(12).font('Helvetica').fillColor('#666666')
       .text(`RUT: ${member.rut || 'N/A'}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });

    doc.moveDown(2);

    // Texto de asistencia
    const attendanceText = `Ha asistido a un total de ${stats.total || 0} clases de judo en nuestro club, de las cuales ${stats.regulares || 0} corresponden a clases regulares.`;
    doc.fontSize(12).font('Helvetica').fillColor('#333333')
       .text(attendanceText, 50, doc.y, { align: 'center', width: doc.page.width - 100, lineGap: 5 });

    doc.moveDown(3);

    // ========== DETALLE DE ASISTENCIAS ==========
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Detalle de Asistencias:', 50, doc.y);
    doc.moveDown(0.5);

    // Tabla simple de estadísticas
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidth = 200;
    const rowHeight = 25;

    // Encabezados
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff');
    doc.rect(tableLeft, tableTop, colWidth, rowHeight).fill('#0066cc');
    doc.text('Tipo de Clase', tableLeft + 10, tableTop + 7, { width: colWidth - 20 });
    
    doc.rect(tableLeft + colWidth, tableTop, colWidth, rowHeight).fill('#0066cc');
    doc.text('Cantidad', tableLeft + colWidth + 10, tableTop + 7, { width: colWidth - 20 });

    // Datos
    doc.fontSize(11).font('Helvetica').fillColor('#333333');
    
    // Fila 1: Total
    doc.rect(tableLeft, tableTop + rowHeight, colWidth, rowHeight).fill('#f8f9fa');
    doc.text('Total Asistencias', tableLeft + 10, tableTop + rowHeight + 7, { width: colWidth - 20 });
    doc.rect(tableLeft + colWidth, tableTop + rowHeight, colWidth, rowHeight).fill('#f8f9fa');
    doc.text(`${stats.total || 0}`, tableLeft + colWidth + 10, tableTop + rowHeight + 7, { width: colWidth - 20 });

    // Fila 2: Regulares
    doc.rect(tableLeft, tableTop + rowHeight * 2, colWidth, rowHeight).fill('#ffffff');
    doc.text('Clases Regulares', tableLeft + 10, tableTop + rowHeight * 2 + 7, { width: colWidth - 20 });
    doc.rect(tableLeft + colWidth, tableTop + rowHeight * 2, colWidth, rowHeight).fill('#ffffff');
    doc.text(`${stats.regulares || 0}`, tableLeft + colWidth + 10, tableTop + rowHeight * 2 + 7, { width: colWidth - 20 });

    doc.y = tableTop + rowHeight * 3 + 20;

    doc.moveDown(2);

    // ========== CIERRE ==========
    doc.fontSize(11).font('Helvetica').fillColor('#666666')
       .text('Se expide el presente certificado a solicitud del interesado para los fines que estime conveniente.', 50, doc.y, { align: 'center', width: doc.page.width - 100 });

    doc.moveDown(4);

    // ========== FIRMA DEL DIRECTOR ==========
    const signatureY = doc.y;
    const signatureX = (doc.page.width / 2) - 100;

    // Línea para firma
    doc.moveTo(signatureX, signatureY)
       .lineTo(signatureX + 200, signatureY)
       .stroke();

    // Imagen de firma (si existe)
    if (directorSignature && directorSignature.value) {
      const signaturePath = path.join(__dirname, '..', directorSignature.value);
      if (fs.existsSync(signaturePath)) {
        doc.image(signaturePath, signatureX, signatureY - 50, {
          width: 200,
          height: 80,
          align: 'center'
        });
      }
    }

    // Nombre del director
    if (directorName && directorName.value) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
         .text(directorName.value, signatureX, signatureY + 10, { width: 200, align: 'center' });
    }

    doc.fontSize(10).font('Helvetica').fillColor('#666666')
       .text('Director Técnico', signatureX, signatureY + 25, { width: 200, align: 'center' })
       .text('Club de Judo Valparaíso', signatureX, signatureY + 40, { width: 200, align: 'center' });

    // ========== LOGO FEDERACIÓN (abajo a la derecha) ==========
    if (federationLogo && federationLogo.value) {
      const fedLogoPath = path.join(__dirname, '..', federationLogo.value);
      if (fs.existsSync(fedLogoPath)) {
        doc.image(fedLogoPath, doc.page.width - 150, doc.page.height - 100, { width: 100, height: 100 });
      }
    }

    // Finalizar PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generando certificado de asistencia:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Reporte de asistencia Excel (admin only)
router.get('/report/excel', requireAdmin, (req, res) => {
  const { start_date, end_date } = req.query;
  const ExcelJS = require('exceljs');

  try {
    const query = `
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.rut,
        COUNT(a.id) as total_asistencias,
        MAX(a.class_date) as ultima_asistencia,
        GROUP_CONCAT(DISTINCT a.class_type) as tipos_clase
      FROM members m
      LEFT JOIN attendance a ON m.id = a.member_id
        ${start_date || end_date ? `AND a.class_date BETWEEN '${start_date || '2000-01-01'}' AND '${end_date || date('now')}'` : ''}
      GROUP BY m.id
      ORDER BY total_asistencias DESC
    `;

    const report = db.prepare(query).all();

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Reporte de Asistencias');
    const worksheet = workbook.getWorksheet('Reporte de Asistencias');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre', key: 'first_name', width: 20 },
      { header: 'Apellido', key: 'last_name', width: 20 },
      { header: 'RUT', key: 'rut', width: 15 },
      { header: 'Total Asistencias', key: 'total_asistencias', width: 20 },
      { header: 'Última Asistencia', key: 'ultima_asistencia', width: 20 },
      { header: 'Tipos de Clase', key: 'tipos_clase', width: 25 }
    ];

    // Add header style
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data
    report.forEach(row => {
      worksheet.addRow(row);
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_asistencias_${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    return workbook.xlsx.write(res).then(() => {
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance statistics for all members (monthly, semester, yearly)
router.get('/statistics', requireAdmin, (req, res) => {
  const { year, month } = req.query;
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month ? parseInt(month) : null;

  try {
    // Get all active members who are judokas (deportistas/judocas) with their current belt color
    const members = db.prepare(`
      SELECT 
        m.id, 
        m.first_name, 
        m.last_name, 
        m.rut,
        (SELECT bg.belt_color FROM belt_grades bg WHERE bg.member_id = m.id ORDER BY bg.grade_date DESC LIMIT 1) as belt_color
      FROM members m
      WHERE m.status = 'active' AND (m.member_type = 'deportista' OR m.member_type = 'judoca' OR m.member_type IS NULL)
      ORDER BY m.last_name, m.first_name
    `).all();

    const statistics = members.map(member => {
      const stats = {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        rut: member.rut,
        belt_color: member.belt_color,
        monthly: { attendance: 0, total: 0, percentage: 0 },
        semester: { attendance: 0, total: 0, percentage: 0 },
        yearly: { attendance: 0, total: 0, percentage: 0 }
      };

      // Monthly attendance (current month or specified month)
      const monthNum = currentMonth || new Date().getMonth() + 1;
      const monthStart = `${currentYear}-${String(monthNum).padStart(2, '0')}-01`;
      const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
      const nextYear = monthNum === 12 ? parseInt(currentYear) + 1 : currentYear;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const monthlyData = db.prepare(`
        SELECT COUNT(*) as count
        FROM attendance
        WHERE member_id = ? AND class_date >= ? AND class_date < ?
      `).get(member.id, monthStart, monthEnd);

      // Calculate expected monthly attendance (2 classes per week = ~8-9 per month)
      const expectedMonthly = 8;
      stats.monthly.attendance = monthlyData.count;
      stats.monthly.total = expectedMonthly;
      stats.monthly.percentage = expectedMonthly > 0 
        ? Math.min(100, (monthlyData.count / expectedMonthly) * 100) 
        : 0;

      // Semester attendance (6 months)
      const semesterStartMonth = monthNum <= 6 ? 1 : 7;
      const semesterStart = `${currentYear}-${String(semesterStartMonth).padStart(2, '0')}-01`;
      const semesterEndMonth = monthNum <= 6 ? 6 : 12;
      const nextMonthSem = semesterEndMonth === 12 ? 1 : semesterEndMonth + 1;
      const nextYearSem = semesterEndMonth === 12 ? parseInt(currentYear) + 1 : currentYear;
      const semesterEnd = `${nextYearSem}-${String(nextMonthSem).padStart(2, '0')}-01`;

      const semesterData = db.prepare(`
        SELECT COUNT(*) as count
        FROM attendance
        WHERE member_id = ? AND class_date >= ? AND class_date < ?
      `).get(member.id, semesterStart, semesterEnd);

      // Expected semester attendance (~48 classes)
      const expectedSemester = 48;
      stats.semester.attendance = semesterData.count;
      stats.semester.total = expectedSemester;
      stats.semester.percentage = expectedSemester > 0 
        ? Math.min(100, (semesterData.count / expectedSemester) * 100) 
        : 0;

      // Yearly attendance
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${parseInt(currentYear) + 1}-01-01`;

      const yearData = db.prepare(`
        SELECT COUNT(*) as count
        FROM attendance
        WHERE member_id = ? AND class_date >= ? AND class_date < ?
      `).get(member.id, yearStart, yearEnd);

      // Expected yearly attendance (~96 classes)
      const expectedYearly = 96;
      stats.yearly.attendance = yearData.count;
      stats.yearly.total = expectedYearly;
      stats.yearly.percentage = expectedYearly > 0 
        ? Math.min(100, (yearData.count / expectedYearly) * 100) 
        : 0;

      return stats;
    });

    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance by month for all members
router.get('/by-month', requireAdmin, (req, res) => {
  const { year, month } = req.query;
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;

  try {
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? parseInt(currentYear) + 1 : currentYear;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const attendance = db.prepare(`
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.rut,
        (SELECT bg.belt_color FROM belt_grades bg WHERE bg.member_id = m.id ORDER BY bg.grade_date DESC LIMIT 1) as belt_color,
        a.class_date,
        a.class_type
      FROM members m
      LEFT JOIN attendance a ON m.id = a.member_id 
        AND a.class_date >= ? AND a.class_date < ?
      WHERE m.status = 'active' AND (m.member_type = 'deportista' OR m.member_type = 'judoca' OR m.member_type IS NULL)
      ORDER BY m.last_name, m.first_name, a.class_date
    `).all(monthStart, monthEnd);

    // Group by member
    const membersMap = new Map();
    attendance.forEach(record => {
      if (!membersMap.has(record.id)) {
        membersMap.set(record.id, {
          id: record.id,
          first_name: record.first_name,
          last_name: record.last_name,
          rut: record.rut,
          belt_color: record.belt_color,
          attendance_dates: []
        });
      }
      if (record.class_date) {
        membersMap.get(record.id).attendance_dates.push({
          date: record.class_date,
          type: record.class_type
        });
      }
    });

    res.json(Array.from(membersMap.values()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk save attendance for multiple members for a specific month
router.post('/bulk-month', requireAdmin, (req, res) => {
  const { year, month, member_ids, class_type } = req.body;

  if (!year || !month || !Array.isArray(member_ids)) {
    return res.status(400).json({ error: 'Year, month, and member_ids are required' });
  }

  try {
    // Define training days (Tuesdays and Thursdays)
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    
    const trainingDates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(yearNum, monthNum - 1, day);
      const dayOfWeek = date.getDay();
      // Tuesday (2) or Thursday (4)
      if (dayOfWeek === 2 || dayOfWeek === 4) {
        const dateStr = date.toISOString().split('T')[0];
        trainingDates.push(dateStr);
      }
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO attendance (member_id, class_date, class_type)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((memberIds, dates, type) => {
      for (const memberId of memberIds) {
        for (const date of dates) {
          stmt.run(memberId, date, type || 'regular');
        }
      }
    });

    insertMany(member_ids, trainingDates, class_type || 'regular');

    res.json({ 
      message: `Attendance recorded for ${member_ids.length} members on ${trainingDates.length} training days`,
      training_dates: trainingDates,
      members_count: member_ids.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly attendance summary for a specific member
router.get('/member-stats', (req, res) => {
  const { member_id, year } = req.query;

  if (!member_id) {
    return res.status(400).json({ error: 'Member ID is required' });
  }

  const currentYear = year || new Date().getFullYear();

  try {
    const monthlyStats = [];
    
    for (let month = 1; month <= 12; month++) {
      const monthStart = `${currentYear}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? parseInt(currentYear) + 1 : currentYear;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const attendanceData = db.prepare(`
        SELECT COUNT(*) as count
        FROM attendance
        WHERE member_id = ? AND class_date >= ? AND class_date < ?
      `).get(member_id, monthStart, monthEnd);

      const expectedMonthly = 8;
      const percentage = expectedMonthly > 0 
        ? Math.min(100, (attendanceData.count / expectedMonthly) * 100) 
        : 0;

      monthlyStats.push({
        month: month,
        month_name: new Date(currentYear, month - 1).toLocaleDateString('es-CL', { month: 'long' }),
        attendance: attendanceData.count,
        expected: expectedMonthly,
        percentage: Math.round(percentage * 10) / 10
      });
    }

    res.json(monthlyStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
