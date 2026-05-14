/**
 * Auth routes:
 *   POST /auth/signup         - register hotel or agent (self-serve)
 *   POST /auth/magic          - request magic link to email
 *   GET  /auth/verify         - landing page from email; validates token, renders auto-POST form (no consume)
 *   POST /auth/verify/consume - atomically consumes token, sets session cookie, redirects to /dashboard
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
const { sendMagicLinkFor } = require('../services/magicLink');

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

// ---------- Verify magic link (GET landing — does NOT consume) ----------
//
// Corporate email scanners (Microsoft Defender Safe Links, Mimecast, Proofpoint)
// pre-fetch URLs via GET to scan them, which previously burned the token before
// the real user could click. We now validate-only on GET and render an
// intermediate page that auto-POSTs to /auth/verify/consume. Scanners don't run
// JS and don't submit forms, so the token survives the prefetch.
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).type('html').send(renderErrorPage('Missing token.'));
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT mt.id, mt.expires_at, mt.used_at, u.active
    FROM magic_tokens mt
    JOIN users u ON u.id = mt.user_id
    WHERE mt.token = ?
  `).get(token);

  if (!row)                                       return res.status(400).type('html').send(renderErrorPage('This link is invalid. Request a new one from the sign-in page.'));
  if (dayjs().isAfter(dayjs(row.expires_at)))     return res.status(400).type('html').send(renderErrorPage('This link has expired. Request a new one from the sign-in page.'));
  if (!row.active)                                return res.status(400).type('html').send(renderErrorPage('This account is inactive. Contact engage.meetings@elevatedmc.com.'));
  if (row.used_at)                                return res.status(400).type('html').send(renderErrorPage('This link has already been used. Request a new one from the sign-in page.'));

  res.type('html').send(renderConsumePage(token));
});

// ---------- Verify magic link (POST consume — atomic, single-use) ----------
router.post('/verify/consume', (req, res) => {
  const token = (req.body && typeof req.body.token === 'string') ? req.body.token : null;
  if (!token) return res.status(400).type('html').send(renderErrorPage('Missing token.'));

  const db = getDb();
  const row = db.prepare(`
    SELECT mt.id, mt.user_id, mt.expires_at, u.active
    FROM magic_tokens mt
    JOIN users u ON u.id = mt.user_id
    WHERE mt.token = ?
  `).get(token);

  if (!row)                                       return res.status(400).type('html').send(renderErrorPage('This link is invalid. Request a new one from the sign-in page.'));
  if (dayjs().isAfter(dayjs(row.expires_at)))     return res.status(400).type('html').send(renderErrorPage('This link has expired. Request a new one from the sign-in page.'));
  if (!row.active)                                return res.status(400).type('html').send(renderErrorPage('This account is inactive. Contact engage.meetings@elevatedmc.com.'));

  // Atomic consume: WHERE used_at IS NULL guard means a concurrent or double
  // POST that loses the race affects 0 rows and is rejected.
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || null;
  const ua = (req.headers['user-agent'] || '').toString().slice(0, 500) || null;
  const result = db.prepare(
    'UPDATE magic_tokens SET used_at = ?, used_ip = ?, used_user_agent = ? WHERE id = ? AND used_at IS NULL'
  ).run(nowUtc(), ip, ua, row.id);

  if (result.changes === 0) {
    return res.status(400).type('html').send(renderErrorPage('This link has already been used. Request a new one from the sign-in page.'));
  }

  db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL').run(nowUtc(), row.user_id);

  const sessionId = crypto.randomBytes(16).toString('hex');
  const sessionToken = jwt.sign({ uid: row.user_id, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const cookieOpts = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
  res.cookie('session', sessionToken, { ...cookieOpts, httpOnly: true });
  res.cookie('logged_in', '1', { ...cookieOpts, httpOnly: false });
  res.redirect('/dashboard');
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function renderConsumePage(token) {
  const safeToken = escapeHtml(token);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Signing you in… · Engage by Elevate</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;700&family=Manrope:wght@400;500&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #080808; color: #f5f5f5; font-family: 'Manrope', system-ui, sans-serif; }
  .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 440px; text-align: center; }
  h1 { font-family: 'Barlow', system-ui, sans-serif; font-weight: 700; font-size: 28px; margin: 0 0 12px; letter-spacing: 0.5px; }
  p  { font-size: 15px; line-height: 1.5; color: #b8b8b8; margin: 0 0 24px; }
  .spinner { width: 36px; height: 36px; border: 3px solid #1f1f1f; border-top-color: #EC672C; border-radius: 50%; margin: 0 auto 24px; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn { display: inline-block; background: #EC672C; color: #080808; font-family: 'Barlow', sans-serif; font-weight: 700; text-decoration: none; padding: 12px 24px; border: 0; border-radius: 4px; cursor: pointer; font-size: 15px; letter-spacing: 0.5px; }
  .btn:hover { background: #ff7838; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="spinner" aria-hidden="true"></div>
      <h1>Signing you in…</h1>
      <p>Hold on a moment while we complete your sign-in.</p>
      <form id="f" method="POST" action="/auth/verify/consume">
        <input type="hidden" name="token" value="${safeToken}">
        <noscript>
          <p>JavaScript is disabled. Click the button below to continue.</p>
          <button type="submit" class="btn">Click to continue</button>
        </noscript>
      </form>
      <script>document.getElementById('f').submit();</script>
    </div>
  </div>
</body>
</html>`;
}

function renderErrorPage(message) {
  const safeMsg = escapeHtml(message);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign-in link · Engage by Elevate</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;700&family=Manrope:wght@400;500&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #080808; color: #f5f5f5; font-family: 'Manrope', system-ui, sans-serif; }
  .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 440px; text-align: center; }
  h1 { font-family: 'Barlow', system-ui, sans-serif; font-weight: 700; font-size: 24px; margin: 0 0 12px; letter-spacing: 0.5px; }
  p  { font-size: 15px; line-height: 1.5; color: #b8b8b8; margin: 0 0 24px; }
  .btn { display: inline-block; background: #EC672C; color: #080808; font-family: 'Barlow', sans-serif; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-size: 15px; letter-spacing: 0.5px; }
  .btn:hover { background: #ff7838; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>This sign-in link can't be used</h1>
      <p>${safeMsg}</p>
      <a class="btn" href="/login.html">Request a new link</a>
    </div>
  </div>
</body>
</html>`;
}

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
