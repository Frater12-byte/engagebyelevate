const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `Located on the golden shores of Abu Dhabi - just 20 minutes from downtown Abu Dhabi and 50 minutes from Dubai, Yas Island offers holidaymakers a diverse mix of leisure and entertainment experiences.

From award-winning theme parks such as Ferrari World Yas Island, Abu Dhabi; Yas Waterworld Yas Island, Abu Dhabi; Warner Bros. World™ Yas Island, Abu Dhabi; and SeaWorld® Yas Island, Abu Dhabi to incredible attractions such as the record-breaking CLYMB™ Yas Island, Abu Dhabi, and the thrilling Yas Marina Circuit (home to the FORMULA 1 ETIHAD AIRWAYS ABU DHABI GRAND PRIX™), visitors are bound to discover a world of entertainment options all within the 25 sq. km island.`;

const common = {
  category: 'Destination Management',
  description,
  logo_url: '/img/Miral.png',
  website: 'https://www.yasisland.com/',
};

// 1. Remove Biljana
const removed = db.prepare(`DELETE FROM exhibitors WHERE slug = ?`).run('yas-island-biljana');
const removedUser = db.prepare(`DELETE FROM users WHERE email = ?`).run('btodorovska@miral.ae');
console.log(`✗ Removed yas-island-biljana exhibitor (${removed.changes} row) + user (${removedUser.changes} row)`);

// 2. Add Victoria + Scott
const profiles = [
  { slug: 'yas-island-russia-victoria', name: 'Yas Island - Russia & CIS', contact_name: 'Victoria Yakusheva', contact_email: 'vyakusheva@miral.ae' },
  { slug: 'yas-island-uk-scott',        name: 'Yas Island - UK & ROW',     contact_name: 'Scott le Roi',       contact_email: 'sleroi@miral.ae' },
];

const insertExhibitor = db.prepare(`
  INSERT INTO exhibitors (slug, name, category, description, logo_url, website, contact_name, contact_email, active)
  VALUES (@slug, @name, @category, @description, @logo_url, @website, @contact_name, @contact_email, 1)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    logo_url = excluded.logo_url,
    website = excluded.website,
    contact_name = excluded.contact_name,
    contact_email = excluded.contact_email,
    active = 1
`);

const insertUser = db.prepare(`
  INSERT INTO users (type, email, contact_name, org_name, country, city, approved, active)
  VALUES ('exhibitor', @email, @contact_name, @org_name, 'United Arab Emirates', 'Abu Dhabi', 1, 1)
  ON CONFLICT(email) DO UPDATE SET
    type = 'exhibitor',
    contact_name = excluded.contact_name,
    org_name = excluded.org_name,
    approved = 1,
    active = 1,
    updated_at = datetime('now')
`);

for (const p of profiles) {
  insertExhibitor.run({ ...common, ...p });
  insertUser.run({ email: p.contact_email, contact_name: p.contact_name, org_name: p.name });
  console.log(`✓ ${p.slug}  ${p.name}  (${p.contact_name} <${p.contact_email}>)`);
}

console.log(`\nDone — Biljana removed, ${profiles.length} new Yas Island exhibitor profiles + login accounts created.`);
db.close();
