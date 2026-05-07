var db = require("better-sqlite3")(__dirname + "/engage.db");

var slug = 'RAKTDA';
var name = 'Ras Al Khaimah Tourism Development Authority';
var category = 'DMO';
var description = "Ras Al Khaimah is ideally situated at the modern crossroads between Europe and Asia. One-third of the world's population is within four hours of flight duration, making it an ideal location for businesses to expand into the UAE, the Middle East, Africa, and beyond.\n\nThe Emirate is home to the highest peak in the United Arab Emirates, Jebel Jais, soaring at an impressive 1,934 metres above sea level and recording temperatures that are 10 degrees Celsius cooler on average than across the other Emirates.\n\nThe mountain is also home to the Jais Adventure Park, a gateway to attractions such as the Jais Viewing Deck Park, the Jais Flight, the World's Longest Zipline, Jais Sky Tour, a series of seven exhilarating ziplines stretching 5km, and Jais Sledder, the region's longest toboggan ride.";
var logo_url = '/img/RAKTDA.png';
var website = 'https://visitrasalkhaimah.com';
var contact_name = 'Carlo Kazan';
var contact_email = 'carlo@raktda.com';

var existing = db.prepare("SELECT * FROM exhibitors WHERE slug = ?").get(slug);

if (existing) {
  db.prepare(`UPDATE exhibitors SET
    name = ?, category = ?, description = ?, logo_url = ?, website = ?,
    contact_name = ?, contact_email = ?, active = 1
    WHERE slug = ?`).run(name, category, description, logo_url, website, contact_name, contact_email, slug);
  console.log("Updated RAKTDA exhibitor:");
} else {
  db.prepare(`INSERT INTO exhibitors
    (slug, name, category, description, logo_url, website, contact_name, contact_email, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(slug, name, category, description, logo_url, website, contact_name, contact_email);
  console.log("Created RAKTDA exhibitor:");
}

console.log(JSON.stringify(db.prepare("SELECT * FROM exhibitors WHERE slug = ?").get(slug), null, 2));
db.close();
