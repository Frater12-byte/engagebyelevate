const db = require('better-sqlite3')(__dirname + '/engage.db');

const description = `Visit Qatar is the main marketing and promotional arm of Qatar Tourism, the regulatory body of the tourism sector in Qatar. Visit Qatar's mission is to promote and expand tourism in Qatar by cultivating its rich culture, developing thrilling attractions, enhancing Qatar's calendar, becoming the leading MICE destination in the region, diversifying events and luxury experiences.

Visit Qatar is rooted in Service Excellence, boosting the entire tourism value chain, and increasing local and international visitor demand in Qatar. Through Visit Qatar's network of international offices in priority markets, cutting-edge digital platforms, and marketing campaigns, Visit Qatar is expanding Qatar's presence globally and enhancing the tourism sector.`;

const common = {
  category: 'Tourism Board',
  description,
  logo_url: '/img/VQ.png',
  website: 'https://visitqatar.com/',
};

const profiles = [
  { slug: 'visit-qatar-europe-franziska', name: 'Visit Qatar - Europe (DACH and Nordics)',     contact_name: 'Franziska Maynard',   contact_email: 'fmaynard@visitqatar.qa' },
  { slug: 'visit-qatar-uk-adam',          name: 'Visit Qatar - UK (Spain, Italy and France)',  contact_name: 'Adam Forsdike',       contact_email: 'aforsdike@visitqatar.qa' },
  { slug: 'visit-qatar-russia-darya',     name: 'Visit Qatar - Russia and CIS',                contact_name: 'Darya Baryshnikava',  contact_email: 'dbaryshnikava@visitqatar.qa' },
  { slug: 'visit-qatar-americas-sandeep', name: 'Visit Qatar - Americas',                      contact_name: 'Sandeep Shevale',     contact_email: 'sshevale@visitqatar.qa' },
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
  VALUES ('exhibitor', @email, @contact_name, @org_name, 'Qatar', 'Doha', 1, 1)
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

console.log(`\nDone — ${profiles.length} Visit Qatar exhibitor profiles + login accounts created/updated.`);
console.log(`Each contact can sign in at https://engagebyelevate.com/login.html with their visitqatar.qa email (magic link).`);
db.close();
