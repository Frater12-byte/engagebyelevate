const express = require('express');
const { getDb } = require('../db/connection');
const { requireAdmin } = require('../middleware/requireAdmin');
const { nowUtc } = require('../utils/time');
const { sendMagicLinkFor } = require('../services/magicLink');
const { generateSlotsForUser } = require('../services/slots');
const meetings = require('../services/meetings');

const router = express.Router();
router.use(requireAdmin);

function auditLog(adminId, action, entityType, entityId, details) {
  getDb().prepare('INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    adminId, action, entityType, entityId, details ? JSON.stringify(details) : null, nowUtc()
  );
}

// === STATS ===
router.get('/stats', (req, res) => {
  const db = getDb();
  const userTotal = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const byType = {};
  db.prepare("SELECT type, COUNT(*) as n FROM users GROUP BY type").all().forEach(r => byType[r.type] = r.n);
  const byRegion = {};
  db.prepare("SELECT COALESCE(region,'none') as r, COUNT(*) as n FROM users GROUP BY region").all().forEach(r => byRegion[r.r] = r.n);
  const verified = db.prepare("SELECT COUNT(*) as n FROM users WHERE email_verified_at IS NOT NULL").get().n;
  const unverified = db.prepare("SELECT COUNT(*) as n FROM users WHERE email_verified_at IS NULL AND type != 'admin'").get().n;
  const inactive = db.prepare("SELECT COUNT(*) as n FROM users WHERE active = 0").get().n;

  const newUsers7d = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at > datetime('now','-7 days')").get().n;

  const meetingTotal = db.prepare('SELECT COUNT(*) as n FROM meetings').get().n;
  const meetings7d = db.prepare("SELECT COUNT(*) as n FROM meetings WHERE created_at > datetime('now','-7 days')").get().n;
  const meetingByStatus = {};
  db.prepare("SELECT status, COUNT(*) as n FROM meetings GROUP BY status").all().forEach(r => meetingByStatus[r.status] = r.n);

  const emailSent7d = db.prepare("SELECT COUNT(*) as n FROM email_log WHERE status='sent' AND sent_at > datetime('now','-7 days')").get().n;
  const emailErr7d = db.prepare("SELECT COUNT(*) as n FROM email_log WHERE status='failed' AND sent_at > datetime('now','-7 days')").get().n;
  const emailSent24h = db.prepare("SELECT COUNT(*) as n FROM email_log WHERE status='sent' AND sent_at > datetime('now','-1 day')").get().n;
  const emailErr24h = db.prepare("SELECT COUNT(*) as n FROM email_log WHERE status='failed' AND sent_at > datetime('now','-1 day')").get().n;
  const byTemplate7d = {};
  db.prepare("SELECT template, COUNT(*) as n FROM email_log WHERE sent_at > datetime('now','-7 days') GROUP BY template").all().forEach(r => byTemplate7d[r.template] = r.n);
  const errorsByTemplate7d = {};
  db.prepare("SELECT template, COUNT(*) as n FROM email_log WHERE status='failed' AND sent_at > datetime('now','-7 days') GROUP BY template").all().forEach(r => errorsByTemplate7d[r.template] = r.n);
  const magicTotal7d = db.prepare("SELECT COUNT(*) as n FROM magic_tokens WHERE created_at > datetime('now','-7 days')").get().n;
  const magicUsed7d = db.prepare("SELECT COUNT(*) as n FROM magic_tokens WHERE created_at > datetime('now','-7 days') AND used_at IS NOT NULL").get().n;
  const actionClicked7d = db.prepare("SELECT COUNT(*) as n FROM action_tokens WHERE created_at > datetime('now','-7 days') AND uses_remaining < 5").get().n;
  const actionTotal7d = db.prepare("SELECT COUNT(*) as n FROM action_tokens WHERE created_at > datetime('now','-7 days')").get().n;

  const slotTotal = db.prepare('SELECT COUNT(*) as n FROM slots').get().n;
  const slotByStatus = {};
  db.prepare("SELECT status, COUNT(*) as n FROM slots GROUP BY status").all().forEach(r => slotByStatus[r.status] = r.n);

  // Emails by day (last 7 days) split by template
  const emailsByDay = db.prepare(`
    SELECT date(sent_at) as day, template, COUNT(*) as n
    FROM email_log WHERE sent_at > datetime('now','-7 days')
    GROUP BY day, template ORDER BY day
  `).all();

  // Emails sent + clicked per day (for line graph)
  const emailsSentByDay = db.prepare(`
    SELECT date(sent_at) as day, COUNT(*) as n
    FROM email_log WHERE status='sent' AND sent_at > datetime('now','-7 days')
    GROUP BY day ORDER BY day
  `).all();
  const emailsClickedByDay = [];
  try {
    const magicByDay = db.prepare(`
      SELECT date(used_at) as day, COUNT(*) as n
      FROM magic_tokens WHERE used_at IS NOT NULL AND used_at > datetime('now','-7 days')
      GROUP BY day ORDER BY day
    `).all();
    const actionByDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as n
      FROM action_tokens WHERE uses_remaining < 5 AND created_at > datetime('now','-7 days')
      GROUP BY day ORDER BY day
    `).all();
    const clickMap = {};
    magicByDay.forEach(r => { clickMap[r.day] = (clickMap[r.day] || 0) + r.n; });
    actionByDay.forEach(r => { clickMap[r.day] = (clickMap[r.day] || 0) + r.n; });
    Object.entries(clickMap).sort().forEach(([day, n]) => emailsClickedByDay.push({ day, n }));
  } catch {}

  // System health
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
  const tokenCount = db.prepare('SELECT COUNT(*) as n FROM action_tokens').get().n;
  const expiredTokens = db.prepare("SELECT COUNT(*) as n FROM action_tokens WHERE expires_at < datetime('now')").get().n;
  const uptime = process.uptime();

  res.json({
    users: { total: userTotal, new_7d: newUsers7d, by_type: byType, by_region: byRegion, verified, unverified, inactive },
    meetings: { total: meetingTotal, new_7d: meetings7d, by_status: meetingByStatus },
    emails: { last_7d: { sent: emailSent7d, errored: emailErr7d, clicked: magicUsed7d + actionClicked7d }, last_24h: { sent: emailSent24h, errored: emailErr24h }, by_template_7d: byTemplate7d, errors_by_template_7d: errorsByTemplate7d, by_day: emailsByDay, sent_by_day: emailsSentByDay, clicked_by_day: emailsClickedByDay, magic_link_click_rate_7d: magicTotal7d > 0 ? magicUsed7d / magicTotal7d : 0, action_click_rate_7d: actionTotal7d > 0 ? actionClicked7d / actionTotal7d : 0 },
    slots: { total: slotTotal, by_status: slotByStatus },
    system: { db_size_bytes: dbSize?.size || 0, action_tokens: tokenCount, expired_tokens: expiredTokens, uptime_seconds: Math.floor(uptime), node_version: process.version, memory_mb: Math.round(process.memoryUsage().rss / 1048576) }
  });
});

// === USERS ===
router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, type, email, contact_name, org_name, country, city, region, timezone, attendance_mode, active, email_verified_at, created_at, updated_at, phone, website FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

router.get('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const userMeetings = db.prepare(`SELECT m.*, ru.org_name AS requester_org, eu.org_name AS recipient_org FROM meetings m JOIN users ru ON m.requester_id=ru.id JOIN users eu ON m.recipient_id=eu.id WHERE m.requester_id=? OR m.recipient_id=? ORDER BY m.start_time DESC LIMIT 50`).all(user.id, user.id);
  const tokens = db.prepare('SELECT id, token, expires_at, used_at, created_at FROM magic_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(user.id);
  const emails = db.prepare('SELECT * FROM email_log WHERE user_id = ? ORDER BY sent_at DESC LIMIT 20').all(user.id);
  res.json({ user, meetings: userMeetings, tokens, emails });
});

router.patch('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const allowed = ['type','email','contact_name','phone','org_name','country','city','website','description','specialties','target_markets','room_count','star_rating','region','timezone','attendance_mode','active','email_verified_at'];
  const updates = []; const values = [];
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(['specialties','target_markets'].includes(f) && Array.isArray(req.body[f]) ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  }
  if (!updates.length) return res.json({ ok: true });
  values.push(nowUtc(), req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(',')}, updated_at = ? WHERE id = ?`).run(...values);
  auditLog(req.admin.id, 'update_user', 'user', parseInt(req.params.id), req.body);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  if (id === req.admin.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  // Release slots held by meetings with this user, then delete everything
  db.prepare("UPDATE slots SET status = 'free', meeting_id = NULL WHERE meeting_id IN (SELECT id FROM meetings WHERE requester_id = ? OR recipient_id = ?)").run(id, id);
  db.prepare('DELETE FROM meetings WHERE requester_id = ? OR recipient_id = ?').run(id, id);
  db.prepare('DELETE FROM slots WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM magic_tokens WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM action_tokens WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  auditLog(req.admin.id, 'delete_user', 'user', id, null);
  res.json({ ok: true });
});

router.post('/users/:id/deactivate', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET active = 0, updated_at = ? WHERE id = ?').run(nowUtc(), req.params.id);
  auditLog(req.admin.id, 'deactivate_user', 'user', parseInt(req.params.id), null);
  res.json({ ok: true });
});

router.post('/users/:id/activate', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET active = 1, updated_at = ? WHERE id = ?').run(nowUtc(), req.params.id);
  auditLog(req.admin.id, 'activate_user', 'user', parseInt(req.params.id), null);
  res.json({ ok: true });
});

router.post('/users/:id/verify', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL').run(nowUtc(), req.params.id);
  auditLog(req.admin.id, 'verify_user', 'user', parseInt(req.params.id), null);
  res.json({ ok: true });
});

router.post('/users/:id/resend-magic', async (req, res) => {
  try {
    await sendMagicLinkFor(parseInt(req.params.id));
    auditLog(req.admin.id, 'resend_magic', 'user', parseInt(req.params.id), null);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/regenerate-slots', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  db.prepare("DELETE FROM slots WHERE user_id = ? AND status IN ('free','blocked')").run(id);
  const result = generateSlotsForUser(id);
  auditLog(req.admin.id, 'regenerate_slots', 'user', id, result);
  res.json({ ok: true, ...result });
});

// === MEETINGS ===
router.get('/meetings', (req, res) => {
  const db = getDb();
  let sql = `SELECT m.*, ru.org_name AS requester_org, ru.contact_name AS requester_name, eu.org_name AS recipient_org, eu.contact_name AS recipient_name FROM meetings m JOIN users ru ON m.requester_id=ru.id JOIN users eu ON m.recipient_id=eu.id`;
  const where = []; const params = [];
  if (req.query.status) { where.push('m.status = ?'); params.push(req.query.status); }
  if (req.query.user_id) { where.push('(m.requester_id = ? OR m.recipient_id = ?)'); params.push(req.query.user_id, req.query.user_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY m.start_time DESC LIMIT 200';
  res.json({ meetings: db.prepare(sql).all(...params) });
});

router.post('/meetings/:id/force-cancel', async (req, res) => {
  try {
    const m = meetings.cancelMeetingForce(parseInt(req.params.id));
    auditLog(req.admin.id, 'force_cancel', 'meeting', parseInt(req.params.id), null);
    res.json({ ok: true, meeting: m });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/meetings/:id/force-approve', async (req, res) => {
  try {
    const m = await meetings.approveMeetingForce(parseInt(req.params.id));
    auditLog(req.admin.id, 'force_approve', 'meeting', parseInt(req.params.id), null);
    res.json({ ok: true, meeting: m });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// === GET MAGIC LINK for a user by email ===
router.get('/magic-link', (req, res) => {
  const db = getDb();
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND active = 1").get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const token = db.prepare("SELECT token, expires_at FROM magic_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.id);
  if (!token) return res.json({ url: null });
  const baseUrl = process.env.BASE_URL || 'https://engagebyelevate.com';
  res.json({ url: baseUrl + '/auth/verify?token=' + token.token, expires_at: token.expires_at });
});

// === RESEND EMAIL (sends magic link to the email's original recipient) ===
router.post('/emails/:id/resend', async (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM email_log WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Email not found' });
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND active = 1').get(row.to_email);
  if (!user) return res.status(400).json({ error: 'User not found or inactive for ' + row.to_email });
  try {
    await sendMagicLinkFor(user.id);
    auditLog(req.admin.id, 'resend_email', 'email_log', parseInt(req.params.id), { to: row.to_email });
    res.json({ ok: true, message: 'Magic link resent to ' + row.to_email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === EMAILS ===
router.get('/emails', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  let sql = 'SELECT * FROM email_log';
  const where = []; const params = [];
  if (req.query.template) { where.push('template = ?'); params.push(req.query.template); }
  if (req.query.status) { where.push('status = ?'); params.push(req.query.status); }
  if (req.query.q) { where.push("(subject LIKE ? OR to_email LIKE ?)"); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  res.json({ emails: db.prepare(sql).all(...params) });
});

// === BULK ===
router.post('/bulk/resend-unverified', async (req, res) => {
  if (!req.body.confirm) return res.status(400).json({ error: 'Set confirm: true' });
  const db = getDb();
  const users = db.prepare("SELECT id FROM users WHERE email_verified_at IS NULL AND active = 1 AND type != 'admin'").all();
  let sent = 0; const errors = [];
  for (const u of users) {
    try { await sendMagicLinkFor(u.id); sent++; } catch (e) { errors.push({ id: u.id, error: e.message }); }
    await new Promise(r => setTimeout(r, 150));
  }
  auditLog(req.admin.id, 'bulk_resend_unverified', 'users', null, { sent, errors: errors.length });
  res.json({ sent, errors });
});

router.post('/bulk/email', async (req, res) => {
  if (!req.body.confirm) return res.status(400).json({ error: 'Set confirm: true' });
  const { audience, user_ids, subject, html, text } = req.body;
  if (!subject || !html) return res.status(400).json({ error: 'subject and html required' });
  const db = getDb();
  let users;
  const cols = 'id, email, contact_name, org_name, type, country, city';
  if (audience === 'custom' && user_ids) users = db.prepare(`SELECT ${cols} FROM users WHERE id IN (${user_ids.map(() => '?').join(',')}) AND active = 1`).all(...user_ids);
  else if (audience === 'unverified') users = db.prepare(`SELECT ${cols} FROM users WHERE email_verified_at IS NULL AND active = 1 AND type != 'admin'`).all();
  else if (['hotel','agent','exhibitor'].includes(audience)) users = db.prepare(`SELECT ${cols} FROM users WHERE type = ? AND active = 1`).all(audience);
  else users = db.prepare(`SELECT ${cols} FROM users WHERE active = 1 AND type != 'admin'`).all();
  let sent = 0; const errors = [];
  const emailService = require('../services/email');
  function replaceVars(tpl, u) {
    return tpl.replace(/\{\{name\}\}/gi, u.contact_name || '').replace(/\{\{org_name\}\}/gi, u.org_name || '').replace(/\{\{email\}\}/gi, u.email || '').replace(/\{\{type\}\}/gi, u.type || '').replace(/\{\{country\}\}/gi, u.country || '').replace(/\{\{city\}\}/gi, u.city || '');
  }
  for (const u of users) {
    try {
      await emailService.sendRaw(u.email, replaceVars(subject, u), replaceVars(html, u), replaceVars(text || '', u), { template: 'admin_bulk', user_id: u.id });
      sent++;
    } catch (e) { errors.push({ id: u.id, error: e.message }); }
    await new Promise(r => setTimeout(r, 150));
  }
  auditLog(req.admin.id, 'bulk_email', 'users', null, { audience, sent, errors: errors.length });
  res.json({ sent, errors });
});

module.exports = router;
