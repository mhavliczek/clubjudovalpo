const db = require('../database');

/**
 * Calculate payment status for a member
 * Returns: 'al_dia' (green), 'al_dia_con_obs' (yellow), 'en_mora' (red)
 */
function calculatePaymentStatus(memberId, checkDate = new Date()) {
  const currentYear = checkDate.getFullYear();
  const currentMonth = checkDate.getMonth() + 1; // 1-12
  const currentDay = checkDate.getDate();
  
  // Get annual fees for current year
  const fees = db.prepare('SELECT * FROM annual_fees WHERE year = ?').get(currentYear);
  
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
  const cutoffMonth = currentDay > 5 ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1);
  const cutoffYear = currentDay > 5 || currentMonth !== 1 ? currentYear : currentYear - 1;
  
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

  // Check monthly payments - count how many months are paid this year
  const monthsPaid = db.prepare(`
    SELECT COUNT(DISTINCT strftime('%m', payment_date)) as count FROM payments
    WHERE member_id = ? AND payment_type = 'monthly' AND strftime('%Y', payment_date) = ?
  `).get(memberId, currentYear.toString()).count;

  // For simplicity, consider "all months paid" if at least current month is paid
  const allMonthsPaid = monthsPaid >= currentMonth;
  
  // Determine status
  let status, reason;

  if (enrollmentPaid && licensePaid && monthsPaid >= currentMonth) {
    status = 'al_dia';
    reason = `Al día (${monthsPaid}/${currentMonth} mensualidades)`;
  } else if (enrollmentPaid && monthsPaid >= currentMonth && !licensePaid) {
    status = 'al_dia_con_obs';
    reason = 'Al día con Obs (falta licencia)';
  } else {
    status = 'en_mora';
    const reasons = [];
    if (!enrollmentPaid) reasons.push('matrícula');
    if (monthsPaid < currentMonth) reasons.push(`mensualidades (${monthsPaid}/${currentMonth})`);
    if (!licensePaid) reasons.push('licencia');
    reason = 'En mora (' + reasons.join(', ') + ')';
  }

  return { status, reason, details: { enrollmentPaid, licensePaid, monthsPaid, currentMonth } };
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
