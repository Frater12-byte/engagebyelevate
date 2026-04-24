const crypto = require('crypto');
const dayjs = require('dayjs');
const { getDb } = require('../db/connection');
const { nowUtc } = require('../utils/time');
const email = require('./email');

async function sendMagicLinkFor(userId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');
  const token = crypto.randomBytes(32).toString('hex');
  const expiryHours = parseInt(process.env.MAGIC_LINK_EXPIRY_HOURS || '24', 10);
  const expiresAt = dayjs().add(expiryHours, 'hour').toISOString();
  db.prepare('INSERT INTO magic_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(userId, token, expiresAt, nowUtc());
  await email.sendMagicLink(user, token);
}

module.exports = { sendMagicLinkFor };
