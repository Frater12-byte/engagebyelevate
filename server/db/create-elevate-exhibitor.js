var db = require("better-sqlite3")(__dirname + "/engage.db");
var now = new Date().toISOString();
db.prepare("INSERT INTO users (type,email,contact_name,org_name,country,city,approved,active,created_at,updated_at) VALUES ('exhibitor','events@engagebyelevate.com','Elevate World','Elevate World','United Arab Emirates','Dubai',1,1,?,?)").run(now, now);
console.log("Created Elevate World exhibitor");
db.close();
