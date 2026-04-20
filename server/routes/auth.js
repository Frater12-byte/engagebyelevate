/**
 * Auth routes:
 *   POST /auth/signup        - register hotel or agent (self-serve)
 *   POST /auth/magic         - request magic link to email
 *   GET  /auth/verify        - click from email -> sets session cookie -> redirect to /dashboard
 *   POST /auth/logout
 */

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');

const { getDb } = require('../db/connection');
const { generateSlotsForUser } = require('../services/slots');
const email = require('../services/email');

const router = express.Router();

// Free email providers that are NOT allowed
const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'outlook.com',
  'live.com', 'aol.com', 'icloud.com', 'me.com', 'mail.com', 'protonmail.com',
  'proton.me', 'zoho.com', 'yandex.com', 'gmx.com', 'gmx.net',
  'tutanota.com', 'fastmail.com', 'hey.com', 'msn.com',
  'hotmail.co.uk', 'yahoo.fr', 'yahoo.de', 'web.de', 'mail.ru'
];

function isCompanyEmail(emailAddr) {
  const domain = emailAddr.split('@')[1];
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.includes(domain.toLowerCase());
}

// ---------- Signup ----------
router.post('/signup', (req, res) => {
  const db = getDb();
  const {
    type, contact_name, email: emailAddr, phone,
    org_name, country, city, website,
    description, specialties, target_markets,
    room_count, star_rating, region
  } = req.body;

  if (!['hotel', 'agent'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  if (!emailAddr || !contact_name || !org_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailNorm = String(emailAddr).toLowerCase().trim();

  if (!isCompanyEmail(emailNorm)) {
    return res.status(400).json({ error: 'Please use your company email address. Personal emails (Gmail, Yahoo, Outlook, etc.) are not accepted.' });
  }

  // Determine region automatically for hotels if not provided
  let userRegion = region;
  if (type === 'hotel' && !userRegion) {
    userRegion = (country || '').toLowerCase().includes('uae') ||
                 (country || '').toLowerCase().includes('emirates') ? 'UAE' : 'INTL';
  }
  if (type === 'agent') userRegion = null;

  try {
    const info = db.prepare(`
      INSERT INTO users (
        type, email, contact_name, phone, org_name, country, city, website,
        description, specialties, target_markets, room_count, star_rating, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type, emailNorm, contact_name, phone || null, org_name,
      country || null, city || null, website || null,
      description || null,
      specialties ? JSON.stringify(specialties) : null,
      target_markets ? JSON.stringify(target_markets) : null,
      room_count || null, star_rating || null, userRegion
    );

    const userId = info.lastInsertRowid;
    // Generate their slots immediately
    generateSlotsForUser(userId);

    // Send magic link right away so they can access dashboard
    sendMagicLinkFor(userId).catch(console.error);

    res.json({ ok: true, userId, message: 'Registration successful. Check your email for the access link.' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This email is already registered. Use "Get login link" instead.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ---------- Request magic link ----------
router.post('/magic', async (req, res) => {
  const emailAddr = String(req.body.email || '').toLowerCase().trim();
  if (!emailAddr) return res.status(400).json({ error: 'Email required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(emailAddr);

  // Always return success to prevent email enumeration
  if (user) {
    try {
      await sendMagicLinkFor(user.id);
    } catch (e) {
      console.error('Magic link send failed:', e.message);
    }
  }
  res.json({ ok: true, message: 'If that email exists, a login link has been sent.' });
});

async function sendMagicLinkFor(userId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expiryHours = parseInt(process.env.MAGIC_LINK_EXPIRY_HOURS || '720', 10);
  const expiresAt = dayjs().add(expiryHours, 'hour').toISOString();

  db.prepare(`
    INSERT INTO magic_tokens (user_id, token, expires_at) VALUES (?, ?, ?)
  `).run(userId, token, expiresAt);

  await email.sendMagicLink(user, token);
}

// ---------- Verify magic link ----------
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  const db = getDb();
  const row = db.prepare(`
    SELECT mt.*, u.id AS user_id, u.active
    FROM magic_tokens mt
    JOIN users u ON u.id = mt.user_id
    WHERE mt.token = ?
  `).get(token);

  if (!row) return res.status(400).send('Invalid or expired link');
  if (dayjs().isAfter(dayjs(row.expires_at))) return res.status(400).send('This link has expired');
  if (!row.active) return res.status(400).send('Account is inactive');

  // Mark used (but we allow re-use of magic token for convenience during event; comment out next line if one-time use desired)
  // db.prepare('UPDATE magic_tokens SET used_at = datetime("now") WHERE id = ?').run(row.id);

  const sessionToken = jwt.sign({ uid: row.user_id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.cookie('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
  res.redirect('/dashboard');
});

// ---------- Logout ----------
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

// ---------- Current user ----------
router.get('/me', (req, res) => {
  const token = req.cookies?.session;
  if (!token) return res.json({ user: null });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = getDb().prepare(
      'SELECT id, type, email, contact_name, org_name, country, region, logo_url FROM users WHERE id = ?'
    ).get(payload.uid);
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;
