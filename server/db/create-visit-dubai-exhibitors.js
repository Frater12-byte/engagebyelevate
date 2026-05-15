const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `Dubai Corporation for Tourism and Commerce Marketing (Visit Dubai) is responsible for marketing and promoting Dubai globally – as both a world-class tourism centre and as a leading business, lifestyle and talent destination.

Visit Dubai is tasked as the key driving entity for the delivery of Dubai's ambitious tourism strategy. It works closely with stakeholders and partners, both domestic and international, to continuously enhance Dubai's position as the destination of choice for business, MICE and leisure, contributing to the overall investment, economic and visitation growth of the city. Visit Dubai also aims to position Dubai as a global hub for talent, fostering innovation and entrepreneurship.`;

const common = {
  category: 'Tourism Board',
  description,
  logo_url: '/img/DET.png',
  website: 'https://www.visitdubai.com',
};

const profiles = [
  { slug: 'visit-dubai-europe',       name: 'Visit Dubai - Europe',                          contact_name: 'Sayyora Asatova',  contact_email: 'sayyora.asatova@dubaidet.ae' },
  { slug: 'visit-dubai-uk-emma',      name: 'Visit Dubai - UK',                              contact_name: 'Emma Kullman',     contact_email: 'emma.kullman@dubaidet.ae' },
  { slug: 'visit-dubai-uk-jessica',   name: 'Visit Dubai - UK',                              contact_name: 'Jessica Woods',    contact_email: 'jessica.woods@dubaidet.ae' },
  { slug: 'visit-dubai-uk-tabitha',   name: 'Visit Dubai - UK',                              contact_name: 'Tabitha Meadows',  contact_email: 'tabitha.meadows@dubaidet.ae' },
  { slug: 'visit-dubai-russia-cis',   name: 'Visit Dubai - Russia, CIS & Baltic States',     contact_name: 'Anna Yastrebova',  contact_email: 'a.yastrebova@dubaidet.ae' },
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
  VALUES ('exhibitor', @email, @contact_name, @org_name, 'United Arab Emirates', 'Dubai', 1, 1)
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

console.log(`\nDone — ${profiles.length} Visit Dubai exhibitor profiles + login accounts created/updated.`);
console.log(`Each contact can sign in at https://engagebyelevate.com/login.html with their dubaidet.ae email (magic link).`);
db.close();
