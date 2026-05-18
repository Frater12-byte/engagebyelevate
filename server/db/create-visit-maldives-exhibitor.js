const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `The Maldives Marketing & Public Relations Corporation (MMPRC) is the national tourism office of the Maldives responsible for carrying out promotional activities to become the most preferred island destination of the world under the theme of the Maldives...the Sunny Side of Life; whilst adhering to its mission to promote quality and sustainable growth in the local tourism industry to deliver long term economic, social and cultural benefits to the country.`;

const profile = {
  slug: 'visit-maldives',
  name: 'Visit Maldives',
  category: 'Tourism Board',
  description,
  logo_url: '/img/Male.png',
  website: 'https://visitmaldives.com/en',
  contact_name: 'Nasrulla Adam',
  contact_email: 'nasru@visitmaldives.com',
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
  VALUES ('exhibitor', @email, @contact_name, @org_name, 'Maldives', 'Malé', 1, 1)
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

console.log(`\nDone — Visit Maldives exhibitor profile + login account created.`);
db.close();
