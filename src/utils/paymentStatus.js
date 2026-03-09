const db = require('../database');

/**
 * Calculate payment status for a member
 * Returns: 'al_dia' (green), 'al_dia_con_obs' (yellow), 'en_mora' (red)
 * 
 * Reglas:
 * - Verde (al_dia): Matrícula ✅ + Licencia ✅ + Mensualidad del mes ✅
 * - Amarillo (al_dia_con_obs): Matrícula ✅ + Mensualidad del mes ✅ + Licencia ❌
 * - Rojo (en_mora): Matrícula ❌ y/o Mensualidad del mes ❌
 * 
 * Fecha de corte: Día 5 de cada mes
 */
function calculatePaymentStatus(memberId, checkDate = new Date()) {
  const currentYear = checkDate.getFullYear();
  const currentMonth = checkDate.getMonth() + 1; // 1-12
  const currentDay = checkDate.getDate();

  // Get payment status override if exists
  const override = db.prepare('SELECT * FROM payment_status_overrides WHERE member_id = ? AND year = ?')
    .get(memberId, currentYear);

  if (override) {
    return {
      status: override.status,
      reason: override.reason || 'Estado manual',
      isOverride: true
    };
  }

  // Determine cutoff month (if day > 5, current month; otherwise previous month)
  let expectedMonth = currentMonth;
  let expectedYear = currentYear;
  
  if (currentDay <= 5) {
    // Before or on 5th: previous month is due
    if (currentMonth === 1) {
      expectedMonth = 12;
      expectedYear = currentYear - 1;
    } else {
      expectedMonth = currentMonth - 1;
    }
  }
  
  // Check enrollment (matrícula) - paid once per year
  const enrollmentPaid = db.prepare(`
    SELECT COUNT(*) as count FROM payments
    WHERE member_id = ? AND payment_type = 'enrollment' AND strftime('%Y', payment_date) = ?
  `).get(memberId, currentYear.toString()).count > 0;

  // Check license - paid once per year (calendar year)
  const licensePaid = db.prepare(`
    SELECT COUNT(*) as count FROM payments
    WHERE member_id = ? AND payment_type = 'license' AND strftime('%Y', payment_date) = ?
  `).get(memberId, currentYear.toString()).count > 0;

  // Check if expected month is paid (monthly payment)
  const monthNamesFull = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  // Get all monthly payments for the year
  const monthlyPayments = db.prepare(`
    SELECT payment_date, description FROM payments
    WHERE member_id = ? AND payment_type = 'monthly' AND strftime('%Y', payment_date) = ?
  `).all(memberId, currentYear.toString());
  
  // Check if expected month is paid (by description or date)
  let expectedMonthPaid = false;
  for (const payment of monthlyPayments) {
    // Check description first
    const descLower = (payment.description || '').toLowerCase();
    if (descLower.includes(monthNamesFull[expectedMonth - 1])) {
      expectedMonthPaid = true;
      break;
    }
    
    // Check payment date month
    const paymentMonth = new Date(payment.payment_date).getMonth() + 1;
    if (paymentMonth === expectedMonth) {
      expectedMonthPaid = true;
      break;
    }
  }

  // Determine status based on EXACT rules:
  // 🟢 VERDE: Matrícula ✅ + Mensualidad ✅ + Licencia ✅
  // 🟡 AMARILLO: Matrícula ✅ + Mensualidad ✅ + Licencia ❌
  // 🔴 ROJO: Cualquier otro caso donde falte algo
  let status, reason;

  if (enrollmentPaid && expectedMonthPaid && licensePaid) {
    // 🟢 VERDE: Todo pagado
    status = 'al_dia';
    reason = 'Al día';
  } else if (enrollmentPaid && expectedMonthPaid && !licensePaid) {
    // 🟡 AMARILLO: Matrícula y Mensualidad pagadas, pero falta Licencia
    status = 'al_dia_con_obs';
    reason = 'Al día con Obs';
  } else {
    // 🔴 ROJO: Falta algo (matrícula, mensualidad y/o licencia)
    status = 'en_mora';
    const reasons = [];
    if (!enrollmentPaid) reasons.push('matrícula');
    if (!expectedMonthPaid) reasons.push('mensualidad');
    if (!licensePaid) reasons.push('licencia');
    reason = 'En mora (' + reasons.join(', ') + ')';
  }

  return { 
    status, 
    reason, 
    details: { 
      enrollmentPaid, 
      licensePaid, 
      expectedMonthPaid,
      expectedMonth,
      currentMonth,
      currentDay
    } 
  };
}

/**
 * Set manual payment status override for a member
 */
function setPaymentStatusOverride(memberId, year, status, reason = '') {
  try {
    const existing = db.prepare('SELECT id FROM payment_status_overrides WHERE member_id = ? AND year = ?')
      .get(memberId, year);
    
    if (existing) {
      db.prepare(`
        UPDATE payment_status_overrides SET status = ?, reason = ?, created_at = CURRENT_TIMESTAMP
        WHERE member_id = ? AND year = ?
      `).run(status, reason, memberId, year);
    } else {
      db.prepare(`
        INSERT INTO payment_status_overrides (member_id, year, status, reason)
        VALUES (?, ?, ?, ?)
      `).run(memberId, year, status, reason);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove payment status override for a member
 */
function removePaymentStatusOverride(memberId, year) {
  try {
    db.prepare('DELETE FROM payment_status_overrides WHERE member_id = ? AND year = ?')
      .run(memberId, year);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  calculatePaymentStatus,
  setPaymentStatusOverride,
  removePaymentStatusOverride
};
