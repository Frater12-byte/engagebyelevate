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
const { nowUtc } = require('../utils/time');
const { countryToTimezone, regionToAttendanceMode } = require('../utils/timezone');

const { getDb } = require('../db/connection');
const { generateSlotsForUser } = require('../services/slots');
const email = require('../services/email');
const actionTokens = require('../services/actionTokens');

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
    return res.status(400).json({ error: 'To participate as an exhibitor, please contact engage.meetings@elevatedmc.com' });
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

  const userTimezone = countryToTimezone(country);
  const userAttendanceMode = regionToAttendanceMode(userRegion);

  try {
    const signupNow = nowUtc();
    const info = db.prepare(`
      INSERT INTO users (
        type, email, contact_name, phone, org_name, country, city, website,
        description, specialties, target_markets, room_count, star_rating, region,
        timezone, attendance_mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type, emailNorm, contact_name, phone || null, org_name,
      country || null, city || null, website || null,
      description || null,
      specialties ? JSON.stringify(specialties) : null,
      target_markets ? JSON.stringify(target_markets) : null,
      room_count || null, star_rating || null, userRegion,
      userTimezone, userAttendanceMode, signupNow, signupNow
    );

    const userId = info.lastInsertRowid;
    // Generate their slots immediately
    generateSlotsForUser(userId);

    // Send magic link right away so they can access dashboard
    sendMagicLinkFor(userId).catch(console.error);

    // Notify admin of new registration
    const notifyTo = process.env.REPLY_TO_EMAIL || 'engage.meetings@elevatedmc.com';
    email.sendAdminNotification(notifyTo, {
      type, org_name, contact_name, email: emailNorm, country: country || '', city: city || ''
    }).catch(console.error);

    // Auto-login the new user so they can upload logo immediately
    const signupSessionId = crypto.randomBytes(16).toString('hex');
    const sessionToken = jwt.sign({ uid: userId, sid: signupSessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const cookieOpts = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
    res.cookie('session', sessionToken, { ...cookieOpts, httpOnly: true });
    res.cookie('logged_in', '1', { ...cookieOpts, httpOnly: false });

    res.json({ ok: true, userId, message: 'Registration successful. Check your email for the access link.' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This email is already registered. Use "Get login link" instead.' });
    }
    console.error('[SIGNUP FAIL]', err.message, err.stack?.split('\n')[1]);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
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

router.post('/resend-magic', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email required' });
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND active = 1').get(email);
  if (user) {
    try { await sendMagicLinkFor(user.id); } catch (e) { console.error('[resend-magic]', e.message); }
  }
  res.json({ ok: true });
});

async function sendMagicLinkFor(userId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expiryHours = parseInt(process.env.MAGIC_LINK_EXPIRY_HOURS || '24', 10);
  const expiresAt = dayjs().add(expiryHours, 'hour').toISOString();

  db.prepare(`
    INSERT INTO magic_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)
  `).run(userId, token, expiresAt, nowUtc());

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
  if (row.used_at) return res.status(400).send('This link has already been used. Request a new one from the sign-in page.');

  // Mark token as used — single use only
  db.prepare("UPDATE magic_tokens SET used_at = ? WHERE id = ?").run(nowUtc(), row.id);

  // Mark email as verified on first magic link click
  db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL').run(nowUtc(), row.user_id);

  // Invalidate any previous sessions by using a unique session ID
  const sessionId = crypto.randomBytes(16).toString('hex');
  const sessionToken = jwt.sign({ uid: row.user_id, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const cookieOpts = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
  res.cookie('session', sessionToken, { ...cookieOpts, httpOnly: true });
  res.cookie('logged_in', '1', { ...cookieOpts, httpOnly: false });
  res.redirect('/dashboard');
});

// ---------- Logout ----------
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.clearCookie('logged_in');
  res.json({ ok: true });
});

// ---------- Auto-switch session via action token ----------
router.get('/action', (req, res) => {
  const { token, next } = req.query;
  if (!token) return res.status(400).send('Missing token');
  const result = actionTokens.consume(token);
  if (!result) return res.redirect('/login.html?reason=expired');
  const user = getDb().prepare('SELECT id, active FROM users WHERE id = ?').get(result.user_id);
  if (!user || !user.active) return res.redirect('/login.html?reason=inactive');
  const sessionId = crypto.randomBytes(16).toString('hex');
  const sessionToken = jwt.sign({ uid: user.id, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const cookieOpts = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
  res.cookie('session', sessionToken, { ...cookieOpts, httpOnly: true });
  res.cookie('logged_in', '1', { ...cookieOpts, httpOnly: false });
  res.cookie('just_switched', '1', { sameSite: 'lax', maxAge: 60 * 1000 });
  const safeNext = (typeof next === 'string' && next.startsWith('/')) ? next : '/dashboard';
  res.redirect(safeNext);
});

// ---------- Current user ----------
router.get('/me', (req, res) => {
  const token = req.cookies?.session;
  if (!token) return res.json({ user: null });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = getDb().prepare(
      'SELECT id, type, email, contact_name, org_name, country, region, logo_url, timezone, attendance_mode, email_verified_at, created_at FROM users WHERE id = ?'
    ).get(payload.uid);
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;
