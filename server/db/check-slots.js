var db = require("better-sqlite3")(__dirname + "/engage.db");

// Hotels with no region (won't get slots)
var noRegion = db.prepare("SELECT id, org_name, region FROM users WHERE type = 'hotel' AND active = 1 AND region IS NULL").all();
console.log("Hotels with NO region (no slots generated):", noRegion.length);
noRegion.forEach(function(u) { console.log("  #" + u.id, u.org_name); });

// Hotels with region
var withRegion = db.prepare("SELECT region, COUNT(*) as n FROM users WHERE type = 'hotel' AND active = 1 AND region IS NOT NULL GROUP BY region").all();
console.log("\nHotels with region:");
withRegion.forEach(function(r) { console.log("  " + r.region + ": " + r.n); });

// Slots summary
var slotSummary = db.prepare("SELECT day, status, COUNT(*) as n FROM slots GROUP BY day, status ORDER BY day, status").all();
console.log("\nSlots by day/status:");
if (!slotSummary.length) console.log("  NO SLOTS AT ALL");
slotSummary.forEach(function(s) { console.log("  " + s.day + " " + s.status + ": " + s.n); });

// Meetings summary
var mtgSummary = db.prepare("SELECT day, status, COUNT(*) as n FROM meetings GROUP BY day, status ORDER BY day, status").all();
console.log("\nMeetings by day/status:");
if (!mtgSummary.length) console.log("  No meetings yet");
mtgSummary.forEach(function(m) { console.log("  " + m.day + " " + m.status + ": " + m.n); });

// Sessions (meeting windows)
var windows = db.prepare("SELECT day, start_time, end_time, title FROM sessions WHERE type = 'networking' ORDER BY day, start_time").all();
console.log("\nMeeting windows in agenda:");
windows.forEach(function(w) {
  var s = new Date(w.start_time).toLocaleTimeString("en-GB", {timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});
  var e = new Date(w.end_time).toLocaleTimeString("en-GB", {timeZone:"Asia/Dubai",hour:"2-digit",minute:"2-digit"});
  console.log("  " + w.day + " " + s + "-" + e + " " + w.title);
});

db.close();
