/**
 * Authenticated meeting routes.
 *
 *   GET  /api/me/agenda                 - my slots + meetings
 *   GET  /api/me/meetings               - all meetings involving me
 *   GET  /api/users/:id/availability    - live availability of another user (for booking)
 *   POST /api/meetings                  - request a meeting
 *   POST /api/meetings/:id/approve
 *   POST /api/meetings/:id/decline
 *   POST /api/meetings/:id/cancel
 */

const express = require('express');
const { getDb } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const meetings = require('../services/meetings');
const { eligibleDaysFor } = require('../services/slots');
const { nowUtc } = require('../utils/time');

const router = express.Router();

// ---------- My agenda ----------
router.get('/me/agenda', requireAuth, (req, res) => {
  const db = getDb();
  const me = req.user;

  const slots = db.prepare(`
    SELECT s.*,
      m.id AS meeting_id_full,
      m.status AS meeting_status,
      m.teams_join_url,
      CASE WHEN s.user_id = m.requester_id THEN u2.org_name ELSE u1.org_name END AS other_org,
      CASE WHEN s.user_id = m.requester_id THEN u2.contact_name ELSE u1.contact_name END AS other_name,
      CASE WHEN s.user_id = m.requester_id THEN m.recipient_id ELSE m.requester_id END AS other_id,
      CASE WHEN s.user_id = m.requester_id THEN 'outgoing' ELSE 'incoming' END AS direction
    FROM slots s
    LEFT JOIN meetings m ON s.meeting_id = m.id
    LEFT JOIN users u1 ON m.requester_id = u1.id
    LEFT JOIN users u2 ON m.recipient_id = u2.id
    WHERE s.user_id = ?
    ORDER BY s.start_time
  `).all(me.id);

  // Group by day
  const byDay = {};
  for (const s of slots) {
    if (!byDay[s.day]) byDay[s.day] = [];
    byDay[s.day].push(s);
  }

  res.json({
    user: { id: me.id, type: me.type, org_name: me.org_name, region: me.region, timezone: me.timezone, attendance_mode: me.attendance_mode, email_verified_at: me.email_verified_at, created_at: me.created_at },
    eligible_days: eligibleDaysFor(me),
    agenda: byDay
  });
});

// ---------- My meetings list ----------
router.get('/me/meetings', requireAuth, (req, res) => {
  const list = meetings.listMeetingsForUser(req.user.id);
  res.json({ meetings: list });
});

// ---------- Notification count (lightweight) ----------
router.get('/me/notifications', requireAuth, (req, res) => {
  const db = getDb();
  const pending = db.prepare(
    "SELECT COUNT(*) AS n FROM meetings WHERE recipient_id = ? AND status = 'pending'"
  ).get(req.user.id);
  res.json({ count: pending.n });
});

// ---------- Availability of another user ----------
router.get('/users/:id/availability', requireAuth, (req, res) => {
  const db = getDb();
  const other = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(req.params.id);
  if (!other) return res.status(404).json({ error: 'Not found' });
  if (other.type === 'exhibitor') {
    return res.status(400).json({ error: 'Exhibitors do not have bookable meeting slots. Use the messaging feature instead.' });
  }

  // Show all of the other user's slots, mark bookable where viewer also has a matching free slot
  const mySlots = db.prepare(`SELECT * FROM slots WHERE user_id = ? ORDER BY start_time`).all(req.user.id);
  const theirSlots = db.prepare(`SELECT * FROM slots WHERE user_id = ? ORDER BY start_time`).all(other.id);
  const myByStart = new Map(mySlots.map(s => [s.start_time, s]));

  const bookable = [];
  for (const theirs of theirSlots) {
    const mine = myByStart.get(theirs.start_time);
    bookable.push({
      start_time: theirs.start_time,
      end_time: theirs.end_time,
      day: theirs.day,
      my_status: mine ? mine.status : 'no_slot',
      their_status: theirs.status,
      available: mine && mine.status === 'free' && theirs.status === 'free'
    });
  }

  res.json({
    other: {
      id: other.id, type: other.type, org_name: other.org_name,
      contact_name: other.contact_name, country: other.country, logo_url: other.logo_url,
      timezone: other.timezone, attendance_mode: other.attendance_mode
    },
    slots: bookable
  });
});

// ---------- Request meeting ----------
router.post('/meetings', requireAuth, (req, res) => {
  const { recipient_id, start_time, message } = req.body;
  if (!recipient_id || !start_time) return res.status(400).json({ error: 'recipient_id and start_time required' });
  try {
    const m = meetings.requestMeeting(req.user.id, parseInt(recipient_id, 10), start_time, message);
    res.json({ ok: true, meeting: m });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Approve ----------
router.post('/meetings/:id/approve', requireAuth, async (req, res) => {
  try {
    const m = await meetings.approveMeeting(parseInt(req.params.id, 10), req.user.id);
    res.json({ ok: true, meeting: m });
  } catch (err) {
    console.error(`[APPROVE FAIL] Meeting ${req.params.id}:`, err.message);
    const status = err.message.includes('Teams') || err.message.includes('Graph') ? 500 : 400;
    res.status(status).json({ error: err.message });
  }
});

// ---------- Decline ----------
router.post('/meetings/:id/decline', requireAuth, (req, res) => {
  try {
    const m = meetings.declineMeeting(parseInt(req.params.id, 10), req.user.id, req.body.reason);
    res.json({ ok: true, meeting: m });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Cancel ----------
router.post('/meetings/:id/cancel', requireAuth, (req, res) => {
  try {
    const m = meetings.cancelMeeting(parseInt(req.params.id, 10), req.user.id);
    res.json({ ok: true, meeting: m });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Calendar .ics download ----------
router.get('/meetings/:id/calendar.ics', requireAuth, (req, res) => {
  const db = getDb();
  const m = db.prepare(`
    SELECT m.*,
      ru.org_name AS requester_org, ru.contact_name AS requester_name,
      eu.org_name AS recipient_org, eu.contact_name AS recipient_name
    FROM meetings m
    JOIN users ru ON m.requester_id = ru.id
    JOIN users eu ON m.recipient_id = eu.id
    WHERE m.id = ?
  `).get(parseInt(req.params.id, 10));

  if (!m) return res.status(404).json({ error: 'Meeting not found' });
  if (m.requester_id !== req.user.id && m.recipient_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your meeting' });
  }
  if (m.status !== 'approved') return res.status(400).json({ error: 'Meeting not confirmed' });

  const toUTC = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dtStart = toUTC(m.start_time);
  const dtEnd = toUTC(new Date(new Date(m.start_time).getTime() + 20 * 60000).toISOString());
  const now = toUTC(new Date().toISOString());
  const summary = `Engage by Elevate — ${m.requester_org} × ${m.recipient_org}`;
  const otherOrg = req.user.id === m.requester_id ? m.recipient_org : m.requester_org;
  const otherName = req.user.id === m.requester_id ? m.recipient_name : m.requester_name;
  const description = `Meeting with ${otherOrg} (${otherName})\\n\\nDuration: 20 minutes${m.teams_join_url ? '\\n\\nJoin Meeting: ' + m.teams_join_url : ''}\\n\\nManage your meetings: https://engagebyelevate.com/dashboard`;
  const location = m.teams_join_url ? `Microsoft Teams: ${m.teams_join_url}` : 'Microsoft Teams';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Engage by Elevate//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:meeting-${m.id}@engagebyelevate.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=Engage by Elevate:mailto:engage.meetings@elevatedmc.com`,
    'STATUS:CONFIRMED',
    ...(m.teams_join_url ? [`URL:${m.teams_join_url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="meeting-${m.id}.ics"`
  });
  res.send(ics);
});

// ---------- Close/open a slot ----------
router.post('/me/slots/:id/toggle', requireAuth, (req, res) => {
  const db = getDb();
  const slot = db.prepare('SELECT * FROM slots WHERE id = ? AND user_id = ?').get(
    parseInt(req.params.id, 10), req.user.id
  );
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  // Only free <-> blocked transitions allowed
  if (slot.status === 'free') {
    db.prepare("UPDATE slots SET status = 'blocked', updated_at = ? WHERE id = ?").run(nowUtc(), slot.id);
    res.json({ ok: true, status: 'blocked' });
  } else if (slot.status === 'blocked') {
    db.prepare("UPDATE slots SET status = 'free', updated_at = ? WHERE id = ?").run(nowUtc(), slot.id);
    res.json({ ok: true, status: 'free' });
  } else {
    res.status(400).json({ error: `Cannot toggle a slot with status "${slot.status}"` });
  }
});

// ---------- Message an exhibitor ----------
router.post('/message-exhibitor', requireAuth, async (req, res) => {
  const { exhibitor_name, exhibitor_email, message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  const sender = req.user;
  const recipientEmail = exhibitor_email || process.env.REPLY_TO_EMAIL || 'engage.meetings@elevatedmc.com';

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      replyTo: sender.email,
      subject: `Message from ${sender.org_name} via Engage by Elevate`,
      text: `Message from ${sender.org_name} (${sender.contact_name}, ${sender.email}):\n\n${message.trim()}\n\n---\nSent via Engage by Elevate\nhttps://engagebyelevate.com`,
      html: `<div style="font-family:sans-serif;max-width:600px">
        <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px">Message via Engage by Elevate</p>
        <p><strong>${sender.org_name}</strong> (${sender.contact_name}) sent a message${exhibitor_name ? ' to ' + exhibitor_name : ''}:</p>
        <blockquote style="border-left:3px solid #E8612A;padding:12px 16px;margin:16px 0;color:#333">${message.trim().replace(/\n/g, '<br>')}</blockquote>
        <p style="font-size:13px;color:#666">Reply directly to this email to respond to ${sender.contact_name} at ${sender.email}.</p>
      </div>`
    });

    console.log(`[MSG] ${sender.email} -> ${recipientEmail} (exhibitor: ${exhibitor_name})`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[MSG FAIL]', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ---------- Update my profile ----------
router.put('/me/profile', requireAuth, (req, res) => {
  const db = getDb();
  const allowed = [
    'contact_name', 'phone', 'org_name', 'country', 'city', 'website',
    'description', 'specialties', 'target_markets', 'room_count', 'star_rating', 'logo_url', 'photo_url'
  ];
  const updates = [];
  const values = [];
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(
        ['specialties','target_markets'].includes(f) && Array.isArray(req.body[f])
          ? JSON.stringify(req.body[f])
          : req.body[f]
      );
    }
  }
  if (!updates.length) return res.json({ ok: true });
  values.push(nowUtc(), req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(',')}, updated_at = ? WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

module.exports = router;
