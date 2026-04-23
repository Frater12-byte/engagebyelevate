const crypto = require('crypto');
const dayjs = require('dayjs');
const { getDb } = require('../db/connection');
const { nowUtc } = require('../utils/time');

function generate(userId, meetingId = null) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = dayjs().add(24, 'hour').toISOString();
  getDb().prepare(`
    INSERT INTO action_tokens (user_id, token, meeting_id, uses_remaining, expires_at, created_at)
    VALUES (?, ?, ?, 5, ?, ?)
  `).run(userId, token, meetingId, expiresAt, nowUtc());
  return token;
}

function consume(token) {
  const db = getDb();
  const row = db.prepare('SELECT id, user_id, meeting_id, uses_remaining, expires_at FROM action_tokens WHERE token = ?').get(token);
  if (!row) return null;
  if (dayjs().isAfter(dayjs(row.expires_at))) return null;
  if (row.uses_remaining <= 0) return null;
  db.prepare('UPDATE action_tokens SET uses_remaining = uses_remaining - 1 WHERE id = ?').run(row.id);
  return { user_id: row.user_id, meeting_id: row.meeting_id };
}

function cleanup() {
  getDb().prepare('DELETE FROM action_tokens WHERE expires_at < ?').run(nowUtc());
}

module.exports = { generate, consume, cleanup };
