/**
 * Seed data for Engage by Elevate.
 * Populates the agenda per spec:
 *   - Samir opening, 11:00, 20 min, auditorium + online
 *   - 2 tour operator messages, 20 min each
 *   - 5 tourism board sessions
 *
 * Also seeds the admin user.
 * Re-runnable: clears agenda + tourism boards first.
 */

require('dotenv').config();
const { getDb } = require('./connection');
const { regenerateAllSlots } = require('../services/slots');

const DAY1 = process.env.EVENT_DAY_1 || '2026-06-01';
const DAY2 = process.env.EVENT_DAY_2 || '2026-06-02';
const DAY3 = process.env.EVENT_DAY_3 || '2026-06-03';

// Helper: Dubai is UTC+4, so we define times in local and add TZ offset
const TZ = '+04:00';
function dt(day, hhmm) { return `${day}T${hhmm}:00${TZ}`; }

const SESSIONS = [
  // ---- DAY 1 ----
  {
    title: 'Opening Session',
    speaker: 'Samir',
    organization: 'Engage by Elevate',
    description: 'Welcome and event kickoff. Available in the auditorium and online.',
    day: DAY1,
    start_time: dt(DAY1, '11:00'),
    end_time:   dt(DAY1, '11:20'),
    location: 'Auditorium',
    type: 'opening',
    is_hybrid: 1
  },
  {
    title: 'Tour Operator Message — Session 1',
    speaker: 'Tour Operator 1',
    description: 'Strategic overview from a leading tour operator.',
    day: DAY1,
    start_time: dt(DAY1, '11:20'),
    end_time:   dt(DAY1, '11:40'),
    location: 'Auditorium',
    type: 'keynote'
  },
  {
    title: 'Tour Operator Message — Session 2',
    speaker: 'Tour Operator 2',
    description: 'Insights from a second tour operator partner.',
    day: DAY1,
    start_time: dt(DAY1, '11:40'),
    end_time:   dt(DAY1, '12:00'),
    location: 'Auditorium',
    type: 'keynote'
  },
  {
    title: 'Tourism Board Session — Board 1',
    organization: 'Tourism Board 1',
    description: 'Open audience session (not 1:1 — all attendees welcome).',
    day: DAY1,
    start_time: dt(DAY1, '15:00'),
    end_time:   dt(DAY1, '15:20'),
    location: 'Main Stage',
    type: 'tourism_board'
  },

  // ---- DAY 2 ----
  {
    title: 'Tourism Board Session — Board 2',
    organization: 'Tourism Board 2',
    description: 'Open audience session.',
    day: DAY2,
    start_time: dt(DAY2, '10:00'),
    end_time:   dt(DAY2, '10:20'),
    location: 'Main Stage',
    type: 'tourism_board'
  },
  {
    title: 'Tourism Board Session — Board 3',
    organization: 'Tourism Board 3',
    description: 'Open audience session.',
    day: DAY2,
    start_time: dt(DAY2, '15:00'),
    end_time:   dt(DAY2, '15:20'),
    location: 'Main Stage',
    type: 'tourism_board'
  },

  // ---- DAY 3 (international hotels) ----
  {
    title: 'Tourism Board Session — Board 4',
    organization: 'Tourism Board 4',
    description: 'Open audience session.',
    day: DAY3,
    start_time: dt(DAY3, '10:00'),
    end_time:   dt(DAY3, '10:20'),
    location: 'Main Stage',
    type: 'tourism_board'
  },
  {
    title: 'Tourism Board Session — Board 5',
    organization: 'Tourism Board 5',
    description: 'Open audience session.',
    day: DAY3,
    start_time: dt(DAY3, '15:00'),
    end_time:   dt(DAY3, '15:20'),
    location: 'Main Stage',
    type: 'tourism_board'
  }
];

const TOURISM_BOARDS = [
  { name: 'Tourism Board 1', country: 'UAE', description: 'Promoting the Emirates as a premier destination.' },
  { name: 'Tourism Board 2', country: 'UAE', description: 'Dubai hospitality and tourism initiatives.' },
  { name: 'Tourism Board 3', country: 'UAE', description: 'Abu Dhabi tourism.' },
  { name: 'Tourism Board 4', country: 'Thailand', description: 'Tourism Authority of Thailand.' },
  { name: 'Tourism Board 5', country: 'Qatar', description: 'Qatar Tourism.' }
];

function seed() {
  const db = getDb();

  console.log('Clearing existing agenda...');
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM tourism_boards').run();

  console.log('Seeding sessions...');
  const insSession = db.prepare(`
    INSERT INTO sessions
      (title, speaker, organization, description, day, start_time, end_time, location, type, is_hybrid, is_online, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const sessionIds = {};
  for (const s of SESSIONS) {
    const info = insSession.run(
      s.title, s.speaker || null, s.organization || null, s.description || null,
      s.day, s.start_time, s.end_time, s.location || null, s.type,
      s.is_hybrid || 0, s.is_online || 0
    );
    sessionIds[s.organization || s.title] = info.lastInsertRowid;
  }

  console.log('Seeding tourism boards...');
  const insBoard = db.prepare(`
    INSERT INTO tourism_boards (name, country, description, session_id)
    VALUES (?, ?, ?, ?)
  `);
  for (const b of TOURISM_BOARDS) {
    const sid = sessionIds[`Tourism Board Session — ${b.name.replace('Tourism Board ', 'Board ')}`]
              || sessionIds[b.name] || null;
    insBoard.run(b.name, b.country, b.description, sid);
  }

  // Ensure admin user exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@engagebyelevate.com';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    db.prepare(`
      INSERT INTO users (type, email, contact_name, org_name, approved)
      VALUES ('admin', ?, 'Administrator', 'Engage by Elevate', 1)
    `).run(adminEmail);
    console.log(`Admin user created: ${adminEmail}`);
  }

  console.log('Regenerating slots for all users...');
  const n = regenerateAllSlots();
  console.log(`Regenerated ${n} slots.`);

  // Seed first exhibitor
  db.prepare(`INSERT OR IGNORE INTO exhibitors (slug, name, category, description, website, contact_name, contact_email, booth_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'elevate-world', 'Elevate World', 'Destination Management',
    'Elevate World is a global travel and tourism group delivering exceptional destination services across the Middle East, Indian Ocean, Southeast Asia, and beyond.',
    'https://www.elevatedmc.com', 'Fra', 'francesco.terragni+exhibit1@elevatedmc.com', '01'
  );
  console.log('Exhibitor seeded.');

  console.log('✓ Seed complete');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
