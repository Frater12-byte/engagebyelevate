/**
 * Idempotent data bootstrap.
 * Runs on every app boot. Uses INSERT OR IGNORE so existing rows are
 * never overwritten — safe to call repeatedly. Add new exhibitors here
 * and they'll appear on the next `pm2 reload`.
 */

const { getDb } = require('./connection');

const RAKTDA_DESCRIPTION =
  "Ras Al Khaimah is ideally situated at the modern crossroads between Europe and Asia. One-third of the world's population is within four hours of flight duration, making it an ideal location for businesses to expand into the UAE, the Middle East, Africa, and beyond.\n\n" +
  "The Emirate is home to the highest peak in the United Arab Emirates, Jebel Jais, soaring at an impressive 1,934 metres above sea level and recording temperatures that are 10 degrees Celsius cooler on average than across the other Emirates.\n\n" +
  "The mountain is also home to the Jais Adventure Park, a gateway to attractions such as the Jais Viewing Deck Park, the Jais Flight, the World's Longest Zipline, Jais Sky Tour, a series of seven exhilarating ziplines stretching 5km, and Jais Sledder, the region's longest toboggan ride.";

const EXHIBITORS = [
  {
    slug: 'RAKTDA',
    name: 'Ras Al Khaimah Tourism Development Authority',
    category: 'DMO',
    description: RAKTDA_DESCRIPTION,
    logo_url: '/img/RAKTDA.png',
    website: 'https://visitrasalkhaimah.com',
    contact_name: 'Carlo Kazan',
    contact_email: 'carlo@raktda.com'
  }
];

function ensureExhibitors() {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO exhibitors
       (slug, name, category, description, logo_url, website, contact_name, contact_email, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  let inserted = 0;
  for (const e of EXHIBITORS) {
    const info = stmt.run(
      e.slug, e.name, e.category, e.description, e.logo_url,
      e.website, e.contact_name, e.contact_email
    );
    if (info.changes > 0) inserted++;
  }
  if (inserted > 0) console.log(`[bootstrap] inserted ${inserted} exhibitor(s)`);
}

function runBootstrap() {
  try {
    ensureExhibitors();
  } catch (err) {
    console.error('[bootstrap] error:', err.message);
  }
}

module.exports = { runBootstrap, ensureExhibitors };
