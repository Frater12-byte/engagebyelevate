/**
 * Seed approved agenda — run once on VPS after deploy:
 *   node server/db/seed-agenda.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, 'engage.db');
const db = new Database(DB_PATH);

db.pragma('foreign_keys = OFF');
db.prepare('DELETE FROM sessions').run();
db.pragma('foreign_keys = ON');

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
const insert = db.prepare(
  `INSERT INTO sessions (title, speaker, organization, description, day, start_time, end_time, location, type, is_online, is_hybrid, visible, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
);

// All times stored as UTC. Dubai = UTC+4, so 11:00 Dubai = 07:00 UTC.
const sessions = [
  // ===== Day 1 — United Arab Emirates (June 2) =====
  ['Opening Session', null, 'Engage by Elevate', 'Opening session at Elevate Tourism Hub', '2026-06-02', '2026-06-02T07:00:00Z', '2026-06-02T07:40:00Z', 'Elevate Tourism Hub', 'opening', 0, 1],
  ['Workplace Set-Up', null, null, null, '2026-06-02', '2026-06-02T07:40:00Z', '2026-06-02T08:00:00Z', 'Elevate Tourism Hub', 'break', 0, 0],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-02', '2026-06-02T08:00:00Z', '2026-06-02T09:20:00Z', null, 'networking', 0, 1],
  ['Break (Hotels) / Wynn Al Marjan Island Presentation (Tour Operators)', null, 'Wynn Al Marjan Island', 'Sponsorship session: Wynn Al Marjan Island presentation to tour operators', '2026-06-02', '2026-06-02T09:20:00Z', '2026-06-02T10:00:00Z', null, 'keynote', 0, 1],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-02', '2026-06-02T10:00:00Z', '2026-06-02T11:20:00Z', null, 'networking', 0, 1],
  ['Panel Session (Hotels)', null, null, 'Panel session for hotels', '2026-06-02', '2026-06-02T11:20:00Z', '2026-06-02T12:20:00Z', null, 'keynote', 0, 1],
  ['Break (Hotels & Tour Operators)', null, null, null, '2026-06-02', '2026-06-02T12:20:00Z', '2026-06-02T12:40:00Z', null, 'break', 0, 0],
  ['Session (Hotels)', null, null, 'Session for hotels', '2026-06-02', '2026-06-02T12:40:00Z', '2026-06-02T13:00:00Z', null, 'keynote', 0, 1],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-02', '2026-06-02T13:10:00Z', '2026-06-02T15:00:00Z', null, 'networking', 0, 1],

  // ===== Day 2 — United Arab Emirates (June 3) =====
  ['Session (Hotels)', null, null, 'Session for hotels', '2026-06-03', '2026-06-03T07:30:00Z', '2026-06-03T07:50:00Z', null, 'keynote', 0, 1],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-03', '2026-06-03T08:00:00Z', '2026-06-03T09:20:00Z', null, 'networking', 0, 1],
  ['Break (Hotels) / Tourism Board Presentation (Tour Operators)', null, null, 'Sponsorship session: Tourism Board presentation to tour operators', '2026-06-03', '2026-06-03T09:20:00Z', '2026-06-03T10:00:00Z', null, 'tourism_board', 0, 1],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-03', '2026-06-03T10:00:00Z', '2026-06-03T11:20:00Z', null, 'networking', 0, 1],
  ['Tourism Board Presentation (Tour Operators)', null, null, 'Sponsorship session: Tourism Board presentation to tour operators', '2026-06-03', '2026-06-03T11:20:00Z', '2026-06-03T11:40:00Z', null, 'tourism_board', 0, 1],
  ['Break (Hotels & Tour Operators)', null, null, null, '2026-06-03', '2026-06-03T11:40:00Z', '2026-06-03T12:00:00Z', null, 'break', 0, 0],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-03', '2026-06-03T12:00:00Z', '2026-06-03T15:00:00Z', null, 'networking', 0, 1],
  ['Closing Session + Networking Event', null, 'Engage by Elevate', 'Closing session followed by networking event at Elevate Tourism Hub', '2026-06-03', '2026-06-03T15:00:00Z', '2026-06-03T16:00:00Z', 'Elevate Tourism Hub', 'opening', 0, 1],

  // ===== Day 3 — Qatar, Maldives & Thailand (June 4) =====
  ['Opening Session', null, 'Engage by Elevate', 'Opening session for international day', '2026-06-04', '2026-06-04T07:00:00Z', '2026-06-04T07:40:00Z', null, 'opening', 0, 1],
  ['Workplace Set-Up', null, null, null, '2026-06-04', '2026-06-04T07:40:00Z', '2026-06-04T08:00:00Z', null, 'break', 0, 0],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-04', '2026-06-04T08:00:00Z', '2026-06-04T09:20:00Z', null, 'networking', 0, 1],
  ['Break (Tour Operators) / Session: Thailand (Hotels)', null, null, 'Tour operator break / Thailand session for hotels', '2026-06-04', '2026-06-04T09:20:00Z', '2026-06-04T10:00:00Z', null, 'keynote', 0, 1],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-04', '2026-06-04T10:00:00Z', '2026-06-04T11:20:00Z', null, 'networking', 0, 1],
  ['Session: Maldives (Hotels)', null, null, 'Maldives session for hotels', '2026-06-04', '2026-06-04T11:20:00Z', '2026-06-04T12:20:00Z', null, 'keynote', 0, 1],
  ['Break (Thailand & Maldives Hotels + Tour Operators)', null, null, null, '2026-06-04', '2026-06-04T12:20:00Z', '2026-06-04T12:40:00Z', null, 'break', 0, 0],
  ['Session: Qatar (Hotels)', null, null, 'Qatar session for hotels', '2026-06-04', '2026-06-04T12:40:00Z', '2026-06-04T13:00:00Z', null, 'keynote', 0, 1],
  ['Meetings', null, null, '1:1 meeting block', '2026-06-04', '2026-06-04T13:10:00Z', '2026-06-04T15:00:00Z', null, 'networking', 0, 1],
  ['Closing Session', null, 'Engage by Elevate', 'Final closing session', '2026-06-04', '2026-06-04T15:00:00Z', '2026-06-04T15:30:00Z', null, 'opening', 0, 1],
];

const tx = db.transaction(() => {
  for (const s of sessions) insert.run(...s, now);
});
tx();

console.log(`✓ Inserted ${sessions.length} sessions into ${DB_PATH}`);
db.close();
