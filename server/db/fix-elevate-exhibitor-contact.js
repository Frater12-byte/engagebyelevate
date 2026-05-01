var db = require("better-sqlite3")(__dirname + "/engage.db");
db.prepare("UPDATE exhibitors SET contact_name = 'Zeina El Sayegh' WHERE slug = 'elevate-world'").run();
var row = db.prepare("SELECT slug, name, contact_name, contact_email FROM exhibitors WHERE slug = 'elevate-world'").get();
console.log("Updated:", JSON.stringify(row));
db.close();
