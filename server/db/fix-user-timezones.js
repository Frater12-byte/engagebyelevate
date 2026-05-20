/**
 * One-off: re-apply countryToTimezone() to every user that has a country set.
 * Picks up newly added country mappings without hardcoding IDs.
 * Idempotent — only updates rows whose computed timezone differs from current.
 *
 * Usage:  node server/db/fix-user-timezones.js          (apply)
 *         node server/db/fix-user-timezones.js --dry    (preview only)
 */
const { getDb } = require('./connection');
const { countryToTimezone } = require('../utils/timezone');

const dry = process.argv.includes('--dry');
const db = getDb();

const users = db.prepare(
  "SELECT id, type, org_name, contact_name, country, timezone FROM users WHERE country IS NOT NULL AND country != ''"
).all();

const update = db.prepare(
  "UPDATE users SET timezone = ?, updated_at = datetime('now') WHERE id = ?"
);

let changed = 0;
const changes = [];

for (const u of users) {
  const target = countryToTimezone(u.country);
  if (target !== u.timezone) {
    changes.push({ id: u.id, org: u.org_name, country: u.country, from: u.timezone, to: target });
    if (!dry) update.run(target, u.id);
    changed++;
  }
}

console.log(`${dry ? '[DRY RUN] Would update' : 'Updated'} ${changed} users.`);
for (const c of changes) {
  console.log(`  #${c.id}  ${c.org} (${c.country}):  ${c.from}  ->  ${c.to}`);
}
