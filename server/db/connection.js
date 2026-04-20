/**
 * Singleton DB connection.
 * better-sqlite3 is synchronous, fast, and reliable - zero external services.
 */
const Database = require('better-sqlite3');
const { DB_PATH, initDatabase } = require('./init');
const fs = require('fs');

let db;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_PATH)) {
      initDatabase();
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

module.exports = { getDb };
