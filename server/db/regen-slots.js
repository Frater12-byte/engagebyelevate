/**
 * Regenerate all user slots based on new agenda meeting windows.
 * Run after seed-agenda.js:
 *   node server/db/regen-slots.js
 *
 * This will:
 * 1. Delete all slots that are NOT tied to an active meeting
 * 2. Regenerate slots only during "Meetings" blocks in the agenda
 * 3. Preserve any slots that have booked/held meetings
 */
const path = require('path');
// Set up module resolution from project root
process.chdir(path.join(__dirname, '..', '..'));

const { getDb } = require('../db/connection');
const { generateSlotsForUser } = require('../services/slots');

const db = getDb();

// Delete free/blocked slots (not tied to meetings)
const deleted = db.prepare(`
  DELETE FROM slots WHERE meeting_id IS NULL
`).run();
console.log(`Deleted ${deleted.changes} unbooked slots`);

// Regenerate for all active users
const users = db.prepare(
  "SELECT id, org_name FROM users WHERE active = 1 AND type IN ('hotel','agent','exhibitor')"
).all();

let totalCreated = 0;
for (const u of users) {
  const r = generateSlotsForUser(u.id);
  if (r.created > 0) console.log(`  ${u.org_name}: ${r.created} slots created`);
  totalCreated += r.created;
}

console.log(`\n✓ Regenerated ${totalCreated} slots for ${users.length} users`);
process.exit(0);
