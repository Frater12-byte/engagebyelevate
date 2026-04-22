const express = require('express');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db/connection');

const router = express.Router();

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { error: 'Too many messages. Try again later.' } });

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

// Contact form submission
router.post('/:slug/contact', contactLimiter, async (req, res) => {
  const db = getDb();
  const exhibitor = db.prepare('SELECT * FROM exhibitors WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!exhibitor) return res.status(404).json({ error: 'Not found' });

  const { sender_name, sender_company, sender_email, message } = req.body;
  if (!sender_name || !sender_email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required' });
  }

  db.prepare('INSERT INTO exhibitor_contacts (exhibitor_id, sender_name, sender_company, sender_email, message) VALUES (?, ?, ?, ?, ?)').run(
    exhibitor.id, sender_name, sender_company || null, sender_email, message
  );

  const submission = { sender_name, sender_company, sender_email, message };

  // Send emails (non-blocking)
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
