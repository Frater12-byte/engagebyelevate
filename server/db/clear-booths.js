var db = require("better-sqlite3")(__dirname + "/engage.db");
db.prepare("UPDATE exhibitors SET booth_number = NULL").run();
console.log("Booth numbers cleared");
db.close();
