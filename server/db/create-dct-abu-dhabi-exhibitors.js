const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `We actively engage our trade partners, working together to convert interest in our destination into concrete visitation for their next leisure travel opportunity. We have a series of delivery mechanisms which work to increase guest arrivals, occupancy rates and visitor footfall at our diverse portfolio of cultural, heritage and leisure attractions, while also educating key travel trade stakeholders on our value proposition, which raises Abu Dhabi's profile locally and internationally.

We also host numerous trade familiarisation trips for travel professionals throughout the year, to give them in-depth knowledge of the destination. We also have a training tool on our page on Hablo, and will have our UK Roadshow this year in August visiting London, Chester and Glasgow and look forward to meeting as many of you there and introduce you to our key hotel partners, attractions, and Airline, and will be joined this year by Elevate DMC!`;

const common = {
  category: 'Tourism Board',
  description,
  logo_url: '/img/DCT.png',
  website: 'https://dct.gov.ae/en',
};

const profiles = [
  { slug: 'dct-abu-dhabi-uk-richard', name: 'Experience Abu Dhabi - UK/Ireland', contact_name: 'Richard Smith', contact_email: 'rismith@dctabudhabi.ae' },
  { slug: 'dct-abu-dhabi-uk-rosie',   name: 'Experience Abu Dhabi - UK/Ireland', contact_name: 'Rosie Garside',  contact_email: 'rgarside@dctabudhabi.ae' },
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

console.log(`\nDone — ${profiles.length} DCT Abu Dhabi exhibitor profiles + login accounts created/updated.`);
console.log(`Each contact can sign in at https://engagebyelevate.com/login.html with their dctabudhabi.ae email (magic link).`);
db.close();
