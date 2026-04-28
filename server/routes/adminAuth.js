const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

const router = express.Router();

router.post('/admin-login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ error: 'Admin login not configured' });
  const normalizedEmail = String(email).trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || 'hello@engagebyelevate.com').toLowerCase();
  if (normalizedEmail !== adminEmail) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const user = getDb().prepare("SELECT id, email FROM users WHERE LOWER(email) = ? AND type = 'admin' AND active = 1").get(adminEmail);
  if (!user) return res.status(500).json({ error: 'Admin user row missing' });
  const token = jwt.sign({ uid: user.id, admin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('admin_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7*24*60*60*1000, path: '/' });
  res.json({ ok: true });
});

router.post('/admin-logout', (req, res) => {
  res.clearCookie('admin_session', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ ok: true });
});

router.get('/admin/me', (req, res) => {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ admin: null });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.admin) return res.status(401).json({ admin: null });
    const user = getDb().prepare('SELECT id, email FROM users WHERE id = ?').get(payload.uid);
    res.json({ admin: user });
  } catch { res.status(401).json({ admin: null }); }
});

module.exports = router;
