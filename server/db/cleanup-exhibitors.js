var db = require("better-sqlite3")(__dirname + "/engage.db");

// Show all exhibitor-type users
console.log("=== Users with type='exhibitor' ===");
var exUsers = db.prepare("SELECT id, email, org_name, contact_name FROM users WHERE type = 'exhibitor'").all();
exUsers.forEach(function(u) { console.log("  id=" + u.id, u.email, u.org_name); });

// Show all exhibitors table entries
console.log("\n=== Exhibitors table ===");
var exRows = db.prepare("SELECT id, slug, name, contact_email FROM exhibitors").all();
exRows.forEach(function(e) { console.log("  id=" + e.id, e.slug, e.name, e.contact_email); });

// Delete all exhibitor-type users (they shouldn't be in the users table)
var del = db.prepare("DELETE FROM users WHERE type = 'exhibitor'").run();
console.log("\nDeleted " + del.changes + " exhibitor users from users table");

// Keep only ONE exhibitor in the exhibitors table (the one with slug='elevate-world')
var delDup = db.prepare("DELETE FROM exhibitors WHERE slug != 'elevate-world'").run();
console.log("Deleted " + delDup.changes + " duplicate exhibitors from exhibitors table");

// Verify
console.log("\n=== Remaining ===");
console.log("Exhibitor users:", db.prepare("SELECT COUNT(*) as n FROM users WHERE type = 'exhibitor'").get().n);
var remaining = db.prepare("SELECT id, slug, name, contact_name, contact_email FROM exhibitors").all();
remaining.forEach(function(e) { console.log("  ", e.slug, e.name, e.contact_name, e.contact_email); });

db.close();
