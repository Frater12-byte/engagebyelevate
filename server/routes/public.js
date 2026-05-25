/**
 * Public routes - no auth required.
 *   GET /api/public/hotels         - list of hotels (grouped by region)
 *   GET /api/public/agents         - list of agencies
 *   GET /api/public/agenda         - full event agenda
 *   GET /api/public/tourism-boards - tourism boards
 *   GET /api/public/profile/:id    - single org public profile
 */

const express = require('express');
const { getDb } = require('../db/connection');
const router = express.Router();

function publicUserFields(rows) {
  return rows.map(r => ({
    id: r.id,
    type: r.type,
    org_name: r.org_name,
    country: r.country,
    city: r.city,
    region: r.region,
    website: r.website,
    logo_url: r.logo_url,
    photo_url: r.photo_url,
    contact_name: r.contact_name,
    description: r.description,
    specialties: r.specialties ? safeJSON(r.specialties) : [],
    target_markets: r.target_markets ? safeJSON(r.target_markets) : [],
    room_count: r.room_count,
    star_rating: r.star_rating,
    timezone: r.timezone,
    attendance_mode: r.attendance_mode
  }));
}
function safeJSON(s) { try { return JSON.parse(s); } catch { return []; } }

router.get('/hotels', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM users WHERE type = 'hotel' AND active = 1
    ORDER BY org_name COLLATE NOCASE
  `).all();
  res.json({ hotels: publicUserFields(rows) });
});

router.get('/agents', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM users WHERE type = 'agent' AND active = 1
    ORDER BY org_name COLLATE NOCASE
  `).all();
  res.json({ agents: publicUserFields(rows) });
});

router.get('/exhibitors', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM users WHERE type = 'exhibitor' AND active = 1
    ORDER BY org_name
  `).all();
  res.json({ exhibitors: publicUserFields(rows) });
});

router.get('/tourism-boards', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT e.*, u.email AS rep_email, u.contact_name AS rep_contact_name
    FROM exhibitors e
    LEFT JOIN users u ON u.id = e.user_id AND u.active = 1
    WHERE e.active = 1
    ORDER BY e.name
  `).all();
  res.json({ boards: rows });
});

router.get('/agenda', (req, res) => {
  const db = getDb();
  // Explicit column list — public response must NOT include teams_link
  // (audience gating happens in /api/me/agenda) or the audience flags.
  const rows = db.prepare(`
    SELECT id, title, speaker, organization, description, day, start_time, end_time,
           location, type, is_online, is_hybrid
    FROM sessions WHERE visible = 1
    ORDER BY day, start_time
  `).all();
  // Group by day
  const byDay = {};
  for (const r of rows) {
    if (!byDay[r.day]) byDay[r.day] = [];
    byDay[r.day].push(r);
  }
  res.json({ agenda: byDay });
});

router.get('/profile/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT * FROM users WHERE id = ? AND active = 1
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ profile: publicUserFields([user])[0] });
});

// Stats endpoint for homepage hero
router.get('/stats', (req, res) => {
  const db = getDb();
  const hotels = db.prepare("SELECT COUNT(*) AS n FROM users WHERE type='hotel' AND active=1").get().n;
  const agents = db.prepare("SELECT COUNT(*) AS n FROM users WHERE type='agent' AND active=1").get().n;
  const meetings = db.prepare("SELECT COUNT(*) AS n FROM meetings WHERE status='approved'").get().n;
  const boards = db.prepare("SELECT COUNT(*) AS n FROM exhibitors WHERE active = 1").get().n;
  res.json({ hotels, agents, meetings, boards });
});

// Check if email already registered
router.get('/check-email', (req, res) => {
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email) return res.json({ exists: false });
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  res.json({ exists: !!user });
});

module.exports = router;
