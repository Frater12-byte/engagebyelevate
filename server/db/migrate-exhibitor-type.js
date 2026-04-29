/**
 * Migrate users table to allow 'exhibitor' type.
 * Run on VPS: node server/db/migrate-exhibitor-type.js
 */
var db = require("better-sqlite3")(__dirname + "/engage.db");

// Check current constraint
var sql = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get().sql;
if (sql.indexOf("exhibitor") !== -1) {
  console.log("Already migrated — exhibitor type allowed.");
  db.close();
  process.exit(0);
}

console.log("Migrating users table to allow exhibitor type...");
db.pragma("foreign_keys = OFF");

// Get columns from current table
var cols = db.prepare("PRAGMA table_info(users)").all().map(function(c) { return c.name; });
var colList = cols.join(", ");

// Create new table with updated CHECK
var newSql = sql.replace(
  "CHECK(type IN ('hotel', 'agent', 'admin'))",
  "CHECK(type IN ('hotel', 'agent', 'admin', 'exhibitor'))"
);
db.exec("ALTER TABLE users RENAME TO _users_old");
db.exec(newSql);
db.exec("INSERT INTO users (" + colList + ") SELECT " + colList + " FROM _users_old");
db.exec("DROP TABLE _users_old");
db.exec("CREATE INDEX IF NOT EXISTS idx_users_type ON users(type)");
db.exec("CREATE INDEX IF NOT EXISTS idx_users_region ON users(region)");

db.pragma("foreign_keys = ON");
console.log("Done. Exhibitor type now allowed.");

// List users
var users = db.prepare("SELECT id,type,email,org_name FROM users ORDER BY id").all();
users.forEach(function(u) { console.log(u.id, u.type, u.email, u.org_name); });
db.close();
