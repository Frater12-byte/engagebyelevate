/**
 * Email service.
 *
 * Sends via SMTP (Hostinger's mail server by default).
 * All sends are logged to the email_log table for audit + N8N reconciliation.
 *
 * Templates are inline HTML with shared styling to avoid external assets.
 */

const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const { getDb } = require('../db/connection');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

function log(row) {
  try {
    getDb().prepare(`
      INSERT INTO email_log (to_email, subject, template, meeting_id, user_id, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(row.to_email, row.subject, row.template, row.meeting_id || null, row.user_id || null, row.status || 'sent', row.error || null);
  } catch (e) { console.error('email_log insert failed:', e.message); }
}

async function send(to, subject, html, meta = {}) {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html
    });
    log({ to_email: to, subject, template: meta.template, meeting_id: meta.meeting_id, user_id: meta.user_id, status: 'sent' });
    return info;
  } catch (err) {
    log({ to_email: to, subject, template: meta.template, meeting_id: meta.meeting_id, user_id: meta.user_id, status: 'failed', error: err.message });
    throw err;
  }
}

// ---------- Shared branded template ----------
function wrap(content) {
  return `
  <div style="background:#f4f1ea;padding:40px 20px;font-family:Georgia,serif;color:#1a1a1a">
    <div style="max-width:580px;margin:0 auto;background:#fff;border:1px solid #e5e1d6">
      <div style="background:#0f1a2b;color:#d4a762;padding:24px 32px;border-bottom:3px solid #d4a762">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.7">Engage by Elevate</div>
        <div style="font-size:20px;margin-top:4px;font-weight:normal;letter-spacing:0.5px">Hotel × Agency Matchmaking</div>
      </div>
      <div style="padding:32px">${content}</div>
      <div style="padding:20px 32px;border-top:1px solid #e5e1d6;font-size:11px;color:#888;background:#fafaf5">
        This is an automated message from Engage by Elevate.<br>
        June 1–3, 2026 · Dubai
      </div>
    </div>
  </div>`;
}

function btn(href, label, color = '#0f1a2b') {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px;text-transform:uppercase">${label}</a>`;
}

function fmt(iso) {
  return dayjs(iso).format('dddd, MMM D · HH:mm');
}

// ---------- Magic link ----------
async function sendMagicLink(user, token) {
  const url = `${process.env.BASE_URL}/auth/verify?token=${token}`;
  const html = wrap(`
    <h2 style="font-weight:normal;font-size:22px;margin:0 0 16px">Hello ${user.contact_name},</h2>
    <p>Click below to access your personal dashboard for Engage by Elevate.</p>
    <p style="margin:28px 0">${btn(url, 'Open Dashboard', '#d4a762')}</p>
    <p style="font-size:13px;color:#666">This link works for the duration of the event. Keep it private — anyone with the link can access your account.</p>
    <p style="font-size:13px;color:#666;word-break:break-all">If the button doesn't work, paste this into your browser:<br>${url}</p>
  `);
  return send(user.email, 'Your Engage by Elevate access link', html, {
    template: 'magic_link', user_id: user.id
  });
}

// ---------- Meeting request ----------
async function sendMeetingRequest(meeting, requester, recipient) {
  const url = `${process.env.BASE_URL}/dashboard?meeting=${meeting.id}`;
  const html = wrap(`
    <h2 style="font-weight:normal;font-size:22px;margin:0 0 16px">New meeting request</h2>
    <p><strong>${requester.org_name}</strong> (${requester.contact_name}) would like to meet with you.</p>
    <div style="background:#f8f6f0;padding:16px;border-left:3px solid #d4a762;margin:20px 0">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Proposed Time</div>
      <div style="font-size:18px;margin-top:4px">${fmt(meeting.start_time)}</div>
      <div style="font-size:13px;color:#666">20 minutes · Virtual meeting</div>
    </div>
    ${meeting.message ? `<div style="margin:20px 0"><div style="font-size:12px;color:#888;text-transform:uppercase">Message</div><div style="padding:12px;border:1px solid #e5e1d6;margin-top:8px;font-style:italic">${escapeHtml(meeting.message)}</div></div>` : ''}
    <p style="margin:28px 0">${btn(url, 'Review Request')}</p>
    <p style="font-size:13px;color:#666">This request will auto-expire 48 hours before the meeting time if you don't respond.</p>
  `);
  return send(recipient.email, `Meeting request from ${requester.org_name}`, html, {
    template: 'meeting_request', meeting_id: meeting.id, user_id: recipient.id
  });
}

// ---------- Meeting approved ----------
async function sendMeetingApproved(meeting) {
  const joinBlock = meeting.teams_join_url
    ? `<p style="margin:28px 0">${btn(meeting.teams_join_url, 'Join Teams Meeting', '#5b5fc7')}</p>`
    : `<p style="color:#a87800;background:#fdf6e3;padding:12px;border-left:3px solid #d4a762">The Teams link will be shared separately by the organizer.</p>`;

  const html = (toName, otherOrg) => wrap(`
    <h2 style="font-weight:normal;font-size:22px;margin:0 0 16px;color:#2d6a3e">✓ Meeting confirmed</h2>
    <p>Hello ${toName}, your meeting with <strong>${otherOrg}</strong> is confirmed.</p>
    <div style="background:#f8f6f0;padding:16px;border-left:3px solid #2d6a3e;margin:20px 0">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">When</div>
      <div style="font-size:18px;margin-top:4px">${fmt(meeting.start_time)}</div>
      <div style="font-size:13px;color:#666">20 minutes</div>
    </div>
    ${joinBlock}
    <p style="font-size:13px;color:#666">You can view all your meetings anytime via your dashboard.</p>
  `);

  // Email both parties
  await send(meeting.requester_email, `Meeting confirmed with ${meeting.recipient_org}`, html(meeting.requester_name, meeting.recipient_org), {
    template: 'meeting_approved', meeting_id: meeting.id, user_id: meeting.requester_id
  });
  await send(meeting.recipient_email, `Meeting confirmed with ${meeting.requester_org}`, html(meeting.recipient_name, meeting.requester_org), {
    template: 'meeting_approved', meeting_id: meeting.id, user_id: meeting.recipient_id
  });
}

// ---------- Meeting declined ----------
async function sendMeetingDeclined(meeting) {
  const html = wrap(`
    <h2 style="font-weight:normal;font-size:22px;margin:0 0 16px">Meeting request declined</h2>
    <p>Your meeting request with <strong>${meeting.recipient_org}</strong> at ${fmt(meeting.start_time)} was declined.</p>
    ${meeting.decline_reason ? `<div style="padding:12px;border:1px solid #e5e1d6;margin:16px 0;font-style:italic">${escapeHtml(meeting.decline_reason)}</div>` : ''}
    <p>The slot is now free — you can browse other hotels or agents and try a different time.</p>
    <p style="margin:28px 0">${btn(`${process.env.BASE_URL}/dashboard`, 'Back to Dashboard')}</p>
  `);
  return send(meeting.requester_email, `Meeting request declined`, html, {
    template: 'meeting_declined', meeting_id: meeting.id, user_id: meeting.requester_id
  });
}

// ---------- Meeting cancelled ----------
async function sendMeetingCancelled(meeting, cancelledByUserId) {
  const otherEmail = cancelledByUserId === meeting.requester_id ? meeting.recipient_email : meeting.requester_email;
  const otherName = cancelledByUserId === meeting.requester_id ? meeting.recipient_name : meeting.requester_name;
  const cancellerOrg = cancelledByUserId === meeting.requester_id ? meeting.requester_org : meeting.recipient_org;

  const html = wrap(`
    <h2 style="font-weight:normal;font-size:22px;margin:0 0 16px">Meeting cancelled</h2>
    <p>Hello ${otherName}, your meeting with <strong>${cancellerOrg}</strong> at ${fmt(meeting.start_time)} has been cancelled.</p>
    <p>The slot is now free again.</p>
  `);
  return send(otherEmail, 'Meeting cancelled', html, {
    template: 'meeting_cancelled', meeting_id: meeting.id
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

module.exports = {
  sendMagicLink,
  sendMeetingRequest,
  sendMeetingApproved,
  sendMeetingDeclined,
  sendMeetingCancelled
};
