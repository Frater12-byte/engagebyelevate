/**
 * Database initialization for Engage by Elevate
 * Uses SQLite via better-sqlite3 (zero-config, file-based, perfect for Hostinger VPS)
 *
 * Schema supports:
 *  - Two user types: hotels and agents
 *  - Event days with generated meeting slots (20 min each)
 *  - Two-way meeting requests (pending / approved / declined / cancelled)
 *  - Slot locking (48h before start)
 *  - Magic link authentication
 *  - Tourism board sessions (open audience, not 1:1)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'engage.db');

function initDatabase() {
  // Ensure directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- =========================================================
    -- USERS: hotels and agents (plus admin)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      type            TEXT NOT NULL CHECK(type IN ('hotel', 'agent', 'exhibitor', 'admin')),
      email           TEXT NOT NULL UNIQUE,
      contact_name    TEXT NOT NULL,
      phone           TEXT,

      -- Organization
      org_name        TEXT NOT NULL,
      country         TEXT,
      city            TEXT,
      website         TEXT,
      logo_url        TEXT,
      photo_url       TEXT,

      -- Profile (shown publicly)
      description     TEXT,
      specialties     TEXT,  -- JSON array: e.g. ["luxury","family","MICE"]
      target_markets  TEXT,  -- JSON array
      room_count      INTEGER,
      star_rating     INTEGER,

      -- Grouping (used to control which day they can book)
      -- region: 'UAE' -> eligible for day 1 & 2
      --         'INTL' -> eligible for day 3 (Thailand, Qatar, etc.)
      region          TEXT CHECK(region IN ('UAE', 'INTL') OR region IS NULL),

      -- Auth
      approved        INTEGER NOT NULL DEFAULT 1,  -- self-serve; can be gated later
      active          INTEGER NOT NULL DEFAULT 1,

      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
    CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);

    -- =========================================================
    -- MAGIC LINK TOKENS
    -- =========================================================
    CREATE TABLE IF NOT EXISTS magic_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      used_at     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_magic_token ON magic_tokens(token);

    -- =========================================================
    -- SLOTS: every 20-minute slot for every user
    -- Pre-generated when user registers.
    -- A slot belongs to one user. Booked meetings reference TWO slots.
    -- =========================================================
    CREATE TABLE IF NOT EXISTS slots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day         TEXT NOT NULL,                -- 'YYYY-MM-DD'
      start_time  TEXT NOT NULL,                -- ISO datetime (UTC)
      end_time    TEXT NOT NULL,                -- ISO datetime (UTC)

      -- Status:
      -- 'free'       - available to book
      -- 'held'       - temporarily reserved by a pending request
      -- 'booked'     - meeting confirmed
      -- 'blocked'    - blocked by user (break, lunch, session attendance)
      status      TEXT NOT NULL DEFAULT 'free'
                    CHECK(status IN ('free', 'held', 'booked', 'blocked')),

      meeting_id  INTEGER,  -- nullable, fk to meetings

      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_user_start
      ON slots(user_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_slot_day ON slots(day);
    CREATE INDEX IF NOT EXISTS idx_slot_status ON slots(status);

    -- =========================================================
    -- MEETINGS: a requested or confirmed 1:1 between hotel and agent
    -- =========================================================
    CREATE TABLE IF NOT EXISTS meetings (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id      INTEGER NOT NULL REFERENCES users(id),
      recipient_id      INTEGER NOT NULL REFERENCES users(id),
      requester_slot_id INTEGER NOT NULL REFERENCES slots(id),
      recipient_slot_id INTEGER NOT NULL REFERENCES slots(id),

      day               TEXT NOT NULL,
      start_time        TEXT NOT NULL,
      end_time          TEXT NOT NULL,

      -- 'pending'   - requester sent, recipient has not responded
      -- 'approved'  - both agreed; Teams link generated
      -- 'declined'  - recipient said no; slots released
      -- 'cancelled' - either party cancelled after approval
      -- 'expired'   - pending too long (past 48h lock window)
      status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','approved','declined','cancelled','expired')),

      message           TEXT,                 -- optional note from requester
      decline_reason    TEXT,

      teams_join_url    TEXT,                 -- Microsoft Teams meeting link
      teams_meeting_id  TEXT,                 -- for deletion/update via Graph API

      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      responded_at      TEXT,
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meeting_requester ON meetings(requester_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_recipient ON meetings(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_status ON meetings(status);
    CREATE INDEX IF NOT EXISTS idx_meeting_day ON meetings(day);

    -- =========================================================
    -- AGENDA / SESSIONS
    -- Public event agenda: opening, tourism board talks, etc.
    -- =========================================================
    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      speaker       TEXT,
      organization  TEXT,             -- e.g. tourism board name
      description   TEXT,
      day           TEXT NOT NULL,
      start_time    TEXT NOT NULL,
      end_time      TEXT NOT NULL,
      location      TEXT,             -- 'Auditorium', 'Hall A', 'Online'
      type          TEXT NOT NULL CHECK(type IN ('opening','keynote','tourism_board','break','networking')),
      teams_link    TEXT,             -- for online/hybrid sessions
      is_online     INTEGER DEFAULT 0,
      is_hybrid     INTEGER DEFAULT 0,
      visible       INTEGER DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_session_day ON sessions(day);

    -- =========================================================
    -- TOURISM BOARDS (listed as first-class entities for the public site)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS tourism_boards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      country     TEXT,
      logo_url    TEXT,
      description TEXT,
      website     TEXT,
      contact_email TEXT,
      session_id  INTEGER REFERENCES sessions(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- EMAIL LOG (audit trail + N8N reconciliation)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS email_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email    TEXT NOT NULL,
      subject     TEXT,
      template    TEXT,             -- 'magic_link','meeting_request','meeting_approved','meeting_declined','meeting_cancelled'
      meeting_id  INTEGER,
      user_id     INTEGER,
      status      TEXT DEFAULT 'sent',
      error       TEXT,
      sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_email_log_meeting ON email_log(meeting_id);

    -- =========================================================
    -- AUDIT LOG
    -- =========================================================
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      details     TEXT,
      ip_address  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =========================================================
    -- EXHIBITORS (standalone profiles with contact forms)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS exhibitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      logo_url TEXT,
      website TEXT,
      contact_name TEXT,
      contact_email TEXT NOT NULL,
      booth_number TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exhibitor_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exhibitor_id INTEGER NOT NULL REFERENCES exhibitors(id),
      sender_name TEXT NOT NULL,
      sender_company TEXT,
      sender_email TEXT NOT NULL,
      message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add photo_url if missing (for existing DBs)
  try { db.exec('ALTER TABLE users ADD COLUMN photo_url TEXT'); } catch {}

  // Migration: allow 'exhibitor' type in existing DBs
  // SQLite can't alter CHECK constraints, so we test and recreate if needed
  try {
    db.exec("INSERT INTO users (type, email, contact_name, org_name) VALUES ('exhibitor', '__test_exhibitor__', 'test', 'test')");
    db.exec("DELETE FROM users WHERE email = '__test_exhibitor__'");
  } catch {
    // CHECK constraint blocks 'exhibitor' — need to recreate table
    console.log('Migrating users table to allow exhibitor type...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        contact_name TEXT NOT NULL, phone TEXT, org_name TEXT NOT NULL, country TEXT, city TEXT,
        website TEXT, logo_url TEXT, photo_url TEXT, description TEXT, specialties TEXT,
        target_markets TEXT, room_count INTEGER, star_rating INTEGER,
        region TEXT CHECK(region IN ('UAE', 'INTL') OR region IS NULL),
        approved INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_new SELECT id, type, email, contact_name, phone, org_name, country, city,
        website, logo_url, photo_url, description, specialties, target_markets, room_count, star_rating,
        region, approved, active, created_at, updated_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
      CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);
    `);
    console.log('Migration complete.');
  }

  console.log('✓ Database initialized at', DB_PATH);
  return db;
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase, DB_PATH };
