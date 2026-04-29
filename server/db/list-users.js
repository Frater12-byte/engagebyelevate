var db = require("better-sqlite3")(__dirname + "/engage.db");
var sql = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get();
console.log("Schema:", sql.sql.substring(0, 200));
console.log("");
var users = db.prepare("SELECT id,type,email,org_name,region,active FROM users ORDER BY id").all();
users.forEach(function(u) { console.log(u.id, u.type, u.email, u.org_name, u.region, u.active ? "active" : "INACTIVE"); });
db.close();
