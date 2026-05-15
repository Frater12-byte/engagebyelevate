const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `Miral's Off Yas Island portfolio brings together some of Abu Dhabi's most distinctive cultural and entertainment experiences beyond Yas Island, including teamLab Phenomena Abu Dhabi — an immersive digital art experience on Saadiyat Island — and Qasr Al Watan, the working Presidential Palace open to the public as a cultural and architectural landmark.`;

const profile = {
  slug: 'miral-off-yas-iliesse',
  name: 'Miral - Off Yas Island',
  category: 'Destination Management',
  description,
  logo_url: '/img/Miral.png',
  website: 'https://www.miral.ae',
  contact_name: 'Iliesse Krika',
  contact_email: 'ikrika@miral.ae',
};

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

insertExhibitor.run(profile);
insertUser.run({ email: profile.contact_email, contact_name: profile.contact_name, org_name: profile.name });
console.log(`✓ ${profile.slug}  ${profile.name}  (${profile.contact_name} <${profile.contact_email}>)`);

console.log(`\nDone — Miral Off Yas Island exhibitor profile + login account created.`);
db.close();
