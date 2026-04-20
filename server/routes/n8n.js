/**
 * Endpoints called by N8N workflows.
 * Protected by a shared secret in the X-N8N-Secret header.
 */

const express = require('express');
const dayjs = require('dayjs');
const { getDb } = require('../db/connection');

const router = express.Router();

function requireN8N(req, res, next) {
  const secret = req.headers['x-n8n-secret'];
  if (!process.env.N8N_WEBHOOK_SECRET || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Meetings happening in the next 24-48h window
router.get('/meetings-tomorrow', requireN8N, (req, res) => {
  const db = getDb();
  const start = dayjs().add(20, 'hour').toISOString();
  const end   = dayjs().add(28, 'hour').toISOString();

  const rows = db.prepare(`
    SELECT m.id, m.start_time, m.end_time, m.teams_join_url,
           ru.email AS requester_email, ru.org_name AS requester_org, ru.contact_name AS requester_name,
           eu.email AS recipient_email, eu.org_name AS recipient_org, eu.contact_name AS recipient_name
    FROM meetings m
    JOIN users ru ON m.requester_id = ru.id
    JOIN users eu ON m.recipient_id = eu.id
    WHERE m.status = 'approved'
      AND m.start_time BETWEEN ? AND ?
  `).all(start, end);

  // Pre-format the start time for easy use in n8n templates
  const meetings = rows.map(r => ({
    ...r,
    start_time_formatted: dayjs(r.start_time).format('dddd HH:mm')
  }));

  res.json({ count: meetings.length, meetings });
});

// Daily stats
router.get('/daily-stats', requireN8N, (req, res) => {
  const db = getDb();
  const todayStart = dayjs().startOf('day').toISOString();

  const q = (sql, ...p) => db.prepare(sql).get(...p).n;

  res.json({
    date: dayjs().format('YYYY-MM-DD'),
    hotels_total: q("SELECT COUNT(*) AS n FROM users WHERE type='hotel' AND active=1"),
    hotels_new_today: q("SELECT COUNT(*) AS n FROM users WHERE type='hotel' AND created_at >= ?", todayStart),
    agents_total: q("SELECT COUNT(*) AS n FROM users WHERE type='agent' AND active=1"),
    agents_new_today: q("SELECT COUNT(*) AS n FROM users WHERE type='agent' AND created_at >= ?", todayStart),
    meetings_requested_today: q("SELECT COUNT(*) AS n FROM meetings WHERE created_at >= ?", todayStart),
    meetings_approved_today: q("SELECT COUNT(*) AS n FROM meetings WHERE status='approved' AND responded_at >= ?", todayStart),
    meetings_declined_today: q("SELECT COUNT(*) AS n FROM meetings WHERE status='declined' AND responded_at >= ?", todayStart),
    meetings_approved_total: q("SELECT COUNT(*) AS n FROM meetings WHERE status='approved'"),
    meetings_pending: q("SELECT COUNT(*) AS n FROM meetings WHERE status='pending'")
  });
});

// Export email log (for reconciliation)
router.get('/email-log', requireN8N, (req, res) => {
  const db = getDb();
  const since = req.query.since || dayjs().subtract(24, 'hour').toISOString();
  const rows = db.prepare('SELECT * FROM email_log WHERE sent_at >= ? ORDER BY sent_at DESC').all(since);
  res.json({ count: rows.length, emails: rows });
});

module.exports = router;
