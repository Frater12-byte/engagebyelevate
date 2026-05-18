const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `Establishment and Affiliation
The Tourism Authority of Thailand (TAT) Dubai & Middle East Office was officially established on 10 February 2008 in Dubai, United Arab Emirates. Operating under the Ministry of Tourism and Sports of Thailand, it serves as a key international branch of the Tourism Authority of Thailand, dedicated to positioning Thailand as a leading global travel destination.

Mission and Focus
TAT Dubai & Middle East is committed to strengthening tourism ties between Thailand and the region by:
• Building strong partnerships with airlines, travel agencies, OTAs, and media.
• Leading innovative marketing and PR initiatives.
• Creating collaborative platforms that showcase Thailand's diverse tourism offerings.

Its core mission is to inspire travelers across the Middle East and Africa to experience the unique culture, natural beauty, wellness, luxury, and hospitality that make Thailand a truly remarkable destination.

Regional Responsibility
The Dubai & Middle East Office oversees tourism promotion across 22 countries, covering the Gulf, wider Middle East, and Africa. These include:
• GCC & Middle East: United Arab Emirates, Saudi Arabia, Oman, Kuwait, Qatar, Bahrain, Iran, Lebanon, Jordan, Iraq, Syria, Yemen, and Palestine.
• Africa: Egypt, Morocco, Algeria, Tunisia, Libya, Nigeria, Kenya, Ethiopia, and South Africa.

By leveraging regional insights and fostering strategic cooperation, TAT Dubai & Middle East ensures Thailand remains a top choice for travelers seeking quality, diversity, and memorable experiences.`;

const profile = {
  slug: 'tat-thailand',
  name: 'Tourism Authority of Thailand (TAT)',
  category: 'Tourism Board',
  description,
  logo_url: '/img/Thailand.png',
  website: 'https://tatdubai.com/',
  contact_name: 'Hatsanai Chaisri',
  contact_email: 'hatsanai@tatdubai.com',
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
  VALUES ('exhibitor', @email, @contact_name, @org_name, 'United Arab Emirates', 'Dubai', 1, 1)
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

console.log(`\nDone — TAT Thailand exhibitor profile + login account created.`);
db.close();
