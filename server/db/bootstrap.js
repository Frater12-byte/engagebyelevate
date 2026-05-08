/**
 * Idempotent data bootstrap.
 * Runs on every app boot. Uses INSERT OR IGNORE so existing rows are
 * never overwritten — safe to call repeatedly. Add new exhibitors here
 * and they'll appear on the next `pm2 reload`.
 *
 * Tourism-board / exhibitor backend access:
 *   When an exhibitor entry has `repUser` populated, we provision a
 *   matching users row (type='exhibitor') so the rep can log in via
 *   magic link, see their meeting dashboard, and accept/decline meetings
 *   from hotels and agents. The exhibitors row is then linked via
 *   `user_id` so the dashboard's Book tab shows them as bookable.
 */

const { getDb } = require('./connection');
const { generateSlotsForUser } = require('../services/slots');

const RAKTDA_DESCRIPTION =
  "Ras Al Khaimah is ideally situated at the modern crossroads between Europe and Asia. One-third of the world's population is within four hours of flight duration, making it an ideal location for businesses to expand into the UAE, the Middle East, Africa, and beyond.\n\n" +
  "The Emirate is home to the highest peak in the United Arab Emirates, Jebel Jais, soaring at an impressive 1,934 metres above sea level and recording temperatures that are 10 degrees Celsius cooler on average than across the other Emirates.\n\n" +
  "The mountain is also home to the Jais Adventure Park, a gateway to attractions such as the Jais Viewing Deck Park, the Jais Flight, the World's Longest Zipline, Jais Sky Tour, a series of seven exhilarating ziplines stretching 5km, and Jais Sledder, the region's longest toboggan ride.";

const ELEVATE_WORLD_DESCRIPTION =
  "Elevate World is a UAE-based global travel and tourism group, redefining destination services across the UAE and the GCC countries, with operations extending into the Indian Ocean, Southeast Asia, and other key global destinations. Through a portfolio of specialized brands including Elevate DMC, GoElevate, ONELUX, Elevate Cruises, CONNECT Business Events, and Yalator, the group delivers seamless end-to-end travel solutions.";

const EXHIBITORS = [
  {
    slug: 'elevate-world',
    name: 'Elevate World',
    category: 'Destination Management',
    description: ELEVATE_WORLD_DESCRIPTION,
    logo_url: '/img/elevate-world-logo.svg',
    website: 'https://www.elevateworld.com',
    contact_name: 'Zeina El Sayegh',
    contact_email: 'events@engagebyelevate.com',
    repUser: {
      email: 'events@engagebyelevate.com',
      contact_name: 'Zeina El Sayegh',
      org_name: 'Elevate World',
      country: 'United Arab Emirates',
      city: 'Dubai'
    }
  },
  {
    slug: 'raktda',
    name: 'Ras Al Khaimah Tourism Development Authority',
    category: 'DMO',
    description: RAKTDA_DESCRIPTION,
    logo_url: '/img/RAKTDA.png',
    website: 'https://visitrasalkhaimah.com',
    contact_name: 'Carlo Kazan',
    contact_email: 'carlo@raktda.com',
    repUser: {
      email: 'carlo@raktda.com',
      contact_name: 'Carlo Kazan',
      org_name: 'Ras Al Khaimah Tourism Development Authority',
      country: 'United Arab Emirates',
      city: 'Ras Al Khaimah'
    }
  }
];

function ensureSchema(db) {
  // Add user_id link from exhibitors -> users (nullable). Safe to retry.
  try { db.exec('ALTER TABLE exhibitors ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch {}
}

function ensureExhibitorRow(db, e) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO exhibitors
       (slug, name, category, description, logo_url, website, contact_name, contact_email, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  const info = stmt.run(
    e.slug, e.name, e.category, e.description, e.logo_url,
    e.website, e.contact_name, e.contact_email
  );
  return info.changes > 0;
}

function ensureRepUser(db, repUser) {
  // Create the users row if missing.
  db.prepare(
    `INSERT OR IGNORE INTO users
       (type, email, contact_name, org_name, country, city, approved, active)
     VALUES ('exhibitor', ?, ?, ?, ?, ?, 1, 1)`
  ).run(repUser.email, repUser.contact_name, repUser.org_name, repUser.country, repUser.city);

  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(repUser.email);
  return row ? row.id : null;
}

function linkExhibitorToUser(db, slug, userId) {
  // Only set user_id if it's not already pointing somewhere; never overwrite.
  db.prepare(
    `UPDATE exhibitors SET user_id = ? WHERE slug = ? AND (user_id IS NULL OR user_id = 0)`
  ).run(userId, slug);
}

function ensureExhibitors() {
  const db = getDb();
  let inserted = 0, linked = 0, slotsCreated = 0;

  for (const e of EXHIBITORS) {
    if (ensureExhibitorRow(db, e)) inserted++;

    if (e.repUser) {
      const userId = ensureRepUser(db, e.repUser);
      if (userId) {
        const before = db.prepare('SELECT user_id FROM exhibitors WHERE slug = ?').get(e.slug);
        linkExhibitorToUser(db, e.slug, userId);
        const after = db.prepare('SELECT user_id FROM exhibitors WHERE slug = ?').get(e.slug);
        if (before && after && before.user_id !== after.user_id) linked++;

        // Generate slots for the rep (idempotent — INSERT OR IGNORE inside).
        try {
          const r = generateSlotsForUser(userId);
          slotsCreated += r.created;
        } catch (err) {
          console.error(`[bootstrap] slot gen for user ${userId} failed:`, err.message);
        }
      }
    }
  }

  if (inserted > 0) console.log(`[bootstrap] inserted ${inserted} exhibitor(s)`);
  if (linked > 0) console.log(`[bootstrap] linked ${linked} exhibitor(s) to rep user(s)`);
  if (slotsCreated > 0) console.log(`[bootstrap] generated ${slotsCreated} rep slot(s)`);
}

function runBootstrap() {
  try {
    const db = getDb();
    ensureSchema(db);
    ensureExhibitors();
  } catch (err) {
    console.error('[bootstrap] error:', err.message);
  }
}

module.exports = { runBootstrap, ensureExhibitors };
