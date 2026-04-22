const express = require('express');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many messages. Try again later.' } });

// List all active exhibitors
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM exhibitors WHERE active = 1 ORDER BY name').all();
  res.json({ exhibitors: rows });
});

// Get single exhibitor by slug
router.get('/:slug', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM exhibitors WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ exhibitor: row });
});

// Contact form — requires login, auto-populates sender from session
router.post('/:slug/contact', requireAuth, contactLimiter, async (req, res) => {
  const db = getDb();
  const exhibitor = db.prepare('SELECT * FROM exhibitors WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!exhibitor) return res.status(404).json({ error: 'Not found' });

  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Please write a message' });
  }

  const sender_name = req.user.contact_name;
  const sender_company = req.user.org_name;
  const sender_email = req.user.email;

  db.prepare('INSERT INTO exhibitor_contacts (exhibitor_id, sender_name, sender_company, sender_email, message) VALUES (?, ?, ?, ?, ?)').run(
    exhibitor.id, sender_name, sender_company, sender_email, message.trim()
  );

  const submission = { sender_name, sender_company, sender_email, message: message.trim() };

  try {
    const email = require('../services/email');
    await email.sendExhibitorContact(exhibitor, submission);
    await email.sendExhibitorContactAck(exhibitor, submission);
  } catch (err) {
    console.error('[EXHIBITOR CONTACT EMAIL FAIL]', err.message);
  }

  res.json({ ok: true });
});

module.exports = router;
