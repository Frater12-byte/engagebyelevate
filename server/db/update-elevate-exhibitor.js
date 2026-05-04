var db = require("better-sqlite3")(__dirname + "/engage.db");

// Show current state
var ex = db.prepare("SELECT * FROM exhibitors WHERE slug = 'elevate-world'").get();
if (!ex) {
  console.log("Elevate World not found in exhibitors table!");
  db.close();
  process.exit(1);
}

console.log("BEFORE:");
console.log(JSON.stringify(ex, null, 2));

// Update all fields
db.prepare(`UPDATE exhibitors SET
  name = 'Elevate World',
  category = 'Destination Management',
  description = 'Elevate World is a UAE-based global travel and tourism group, redefining destination services across the UAE and the GCC countries, with operations extending into the Indian Ocean, Southeast Asia, and other key global destinations. Through a portfolio of specialized brands including Elevate DMC, GoElevate, ONELUX, Elevate Cruises, CONNECT Business Events, and Yalator, the group delivers seamless end-to-end travel solutions.',
  website = 'https://www.elevateworld.com',
  contact_name = 'Zeina El Sayegh',
  contact_email = 'events@engagebyelevate.com',
  booth_number = NULL
WHERE slug = 'elevate-world'`).run();

// Show updated state
var updated = db.prepare("SELECT * FROM exhibitors WHERE slug = 'elevate-world'").get();
console.log("\nAFTER:");
console.log(JSON.stringify(updated, null, 2));
db.close();
