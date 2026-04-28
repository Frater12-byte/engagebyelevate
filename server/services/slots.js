/**
 * Slot generator.
 *
 * For each registered user, we pre-create 20-minute slots for the days
 * they're eligible for, skipping agenda sessions (opening, keynotes,
 * tourism board sessions, breaks).
 *
 * Eligibility rules:
 *   - hotels with region='UAE' get slots on day 1 and day 2
 *   - hotels with region='INTL' get slots on day 3
 *   - agents get slots on all three days (they meet everyone)
 */

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const { getDb } = require('../db/connection');

// Slots are ONLY generated during "Meetings" blocks in the agenda
// (sessions with type='networking'). No fixed work window.

/** Returns ISO strings for every 20-min slot in a [start,end] window, in the event timezone */
function enumerateSlots(day, startHHMM, endHHMM, tz = '+04:00') {
  const slots = [];
  let cursor = dayjs(`${day}T${startHHMM}:00${tz}`);
  const end = dayjs(`${day}T${endHHMM}:00${tz}`);
  while (cursor.add(20, 'minute').isBefore(end) || cursor.add(20, 'minute').isSame(end)) {
    const slotEnd = cursor.add(20, 'minute');
    slots.push({
      start: cursor.toISOString(),
      end: slotEnd.toISOString()
    });
    cursor = slotEnd;
  }
  return slots;
}

/** Returns meeting windows (type='networking') for a given day */
function getMeetingWindows(day) {
  const db = getDb();
  return db.prepare(`
    SELECT start_time, end_time FROM sessions
    WHERE day = ? AND visible = 1 AND type = 'networking'
    ORDER BY start_time
  `).all(day);
}

/** Days this user is eligible for */
function eligibleDaysFor(user) {
  const day1 = process.env.EVENT_DAY_1 || '2026-06-02';
  const day2 = process.env.EVENT_DAY_2 || '2026-06-03';
  const day3 = process.env.EVENT_DAY_3 || '2026-06-04';

  if (user.type === 'agent' || user.type === 'exhibitor') return [day1, day2, day3];
  if (user.type === 'hotel') {
    if (user.region === 'UAE') return [day1, day2];
    if (user.region === 'INTL') return [day3];
  }
  return [];
}

/**
 * Generate all slots for a user. Idempotent - uses INSERT OR IGNORE
 * so re-running after agenda updates is safe.
 */
function generateSlotsForUser(userId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  const days = eligibleDaysFor(user);
  if (days.length === 0) return { created: 0, skipped: 0 };

  let created = 0, skipped = 0;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO slots (user_id, day, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const res = insert.run(r.user_id, r.day, r.start, r.end, r.status);
      if (res.changes > 0) created++; else skipped++;
    }
  });

  for (const day of days) {
    const windows = getMeetingWindows(day);
    const rows = [];
    for (const win of windows) {
      // Generate 20-min slots within each meeting window
      let cursor = dayjs(win.start_time);
      const end = dayjs(win.end_time);
      while (cursor.add(20, 'minute').isBefore(end) || cursor.add(20, 'minute').isSame(end)) {
        const slotEnd = cursor.add(20, 'minute');
        rows.push({
          user_id: user.id,
          day,
          start: cursor.toISOString(),
          end: slotEnd.toISOString(),
          status: 'free'
        });
        cursor = slotEnd;
      }
    }
    tx(rows);
  }

  return { created, skipped };
}

/** Regenerate slots for all active users. Use after agenda changes. */
function regenerateAllSlots() {
  const db = getDb();
  const users = db.prepare(
    "SELECT id FROM users WHERE active = 1 AND type IN ('hotel','agent','exhibitor')"
  ).all();
  let total = 0;
  for (const u of users) {
    const r = generateSlotsForUser(u.id);
    total += r.created;
  }
  return total;
}

module.exports = {
  generateSlotsForUser,
  regenerateAllSlots,
  eligibleDaysFor,
  enumerateSlots
};
