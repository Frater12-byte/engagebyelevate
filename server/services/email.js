/**
 * Email service — Engage by Elevate 2026
 *
 * Sends via SMTP. All sends logged to email_log table.
 * Templates: dark branded design matching engagebyelevate.com
 * Table-based layout, inline CSS, plain-text fallbacks.
 */

const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const { getDb } = require('../db/connection');

const SITE = 'https://engagebyelevate.com';
const EVENT_DATES = 'June 2\u20134, 2026';
const EVENT_LOCATION = 'Dubai';

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

function dbLog(row) {
  try {
    getDb().prepare(`
      INSERT INTO email_log (to_email, subject, template, meeting_id, user_id, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(row.to_email, row.subject, row.template, row.meeting_id || null, row.user_id || null, row.status || 'sent', row.error || null);
  } catch (e) { console.error('email_log insert failed:', e.message); }
}

async function send(to, subject, html, text, meta = {}) {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text
    });
    console.log(`[EMAIL OK] to=${to} subject="${subject}" messageId=${info.messageId} response="${info.response || ''}"`);
    dbLog({ to_email: to, subject, template: meta.template, meeting_id: meta.meeting_id, user_id: meta.user_id, status: 'sent' });
    return info;
  } catch (err) {
    console.error(`[EMAIL FAIL] to=${to} subject="${subject}" error=${err.message}${err.response ? ' response=' + err.response : ''}${err.code ? ' code=' + err.code : ''}`);
    dbLog({ to_email: to, subject, template: meta.template, meeting_id: meta.meeting_id, user_id: meta.user_id, status: 'failed', error: err.message });
    throw err;
  }
}

// ================================================================
// Shared components
// ================================================================

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(iso) {
  return dayjs(iso).format('dddd, MMMM D, YYYY [at] HH:mm');
}

function fmtShort(iso) {
  return dayjs(iso).format('ddd, MMM D [at] HH:mm');
}

/** Outlook-safe CTA button using VML fallback */
function btn(label, href, bg = '#C85A3A') {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0">
  <tr>
    <td align="center" style="border-radius:4px;background:${bg}">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px" arcsize="8%" stroke="f" fillcolor="${bg}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${esc(label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;background:${bg};color:#ffffff;text-decoration:none;font-family:'Manrope',-apple-system,'Segoe UI',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:4px;line-height:1;mso-hide:all">${esc(label)}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

/** Meeting details card */
function meetingCard(data) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;border-left:3px solid #C85A3A;background:#141414">
  <tr>
    <td style="padding:20px 24px">
      ${data.org ? `<div style="font-family:'Archivo',Georgia,serif;font-size:18px;font-weight:700;color:#ffffff;margin-bottom:4px">${esc(data.org)}</div>` : ''}
      ${data.contact ? `<div style="font-family:'Manrope',-apple-system,sans-serif;font-size:14px;color:#a0a0a8;margin-bottom:12px">${esc(data.contact)}</div>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:24px">
            <div style="font-family:'Manrope',-apple-system,sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#5a5a65;margin-bottom:4px">Date & Time</div>
            <div style="font-family:'Archivo',Georgia,serif;font-size:15px;color:#ffffff">${data.datetime}</div>
          </td>
          <td>
            <div style="font-family:'Manrope',-apple-system,sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#5a5a65;margin-bottom:4px">Duration</div>
            <div style="font-family:'Archivo',Georgia,serif;font-size:15px;color:#ffffff">20 minutes</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

const LOGO_URL = `${SITE}/img/logo.png`;

/** Full email wrapper — dark branded layout with logo, color sparks, rich footer */
function wrap(content) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Engage by Elevate</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;color:#ffffff;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0A0A0A">
  <tr>
    <td align="center" style="padding:40px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%">

        <!-- Header with logo -->
        <tr>
          <td style="padding:0 0 32px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding-bottom:20px">
                  <a href="${SITE}" style="text-decoration:none"><img src="${LOGO_URL}" alt="Engage by Elevate" width="180" style="display:block;height:auto;border:0;max-width:180px" /></a>
                </td>
              </tr>
              <tr>
                <td style="height:3px;background:linear-gradient(90deg, #C85A3A 0%, #E8612A 40%, rgba(99,140,255,0.3) 70%, transparent 100%);font-size:0;line-height:0">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Content area with subtle color spark -->
        <tr>
          <td style="font-family:'Manrope',-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#a0a0a8;background-image:radial-gradient(ellipse at 90% 10%, rgba(232,97,42,0.04) 0%, transparent 50%),radial-gradient(ellipse at 10% 80%, rgba(99,140,255,0.03) 0%, transparent 50%);background-color:#0A0A0A">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:40px 0 0 0">
            <!-- Gradient divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="height:1px;background:linear-gradient(90deg, transparent, rgba(232,97,42,0.2), rgba(99,140,255,0.1), transparent);font-size:0;line-height:0">&nbsp;</td></tr>
            </table>

            <!-- Footer links -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px">
              <tr>
                <td style="font-family:'Manrope',-apple-system,sans-serif;font-size:12px;color:#5a5a65;line-height:2">
                  <a href="${SITE}/agenda" style="color:#C85A3A;text-decoration:none">Agenda</a> &nbsp;&middot;&nbsp;
                  <a href="${SITE}/directory" style="color:#C85A3A;text-decoration:none">Directory</a> &nbsp;&middot;&nbsp;
                  <a href="${SITE}/signup.html" style="color:#C85A3A;text-decoration:none">Register</a> &nbsp;&middot;&nbsp;
                  <a href="${SITE}/login.html" style="color:#C85A3A;text-decoration:none">Sign In</a> &nbsp;&middot;&nbsp;
                  <a href="mailto:hello@engagebyelevate.com" style="color:#C85A3A;text-decoration:none">Contact Us</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;font-family:'Manrope',-apple-system,sans-serif;font-size:12px;color:#5a5a65">
                  Engage by Elevate &middot; ${EVENT_DATES} &middot; ${EVENT_LOCATION}
                </td>
              </tr>
              <tr>
                <td style="padding-top:4px;font-family:'Manrope',-apple-system,sans-serif;font-size:11px;color:#3a3a42">
                  Elevate Tourism LLC &middot; Dubai, UAE &middot; <a href="${SITE}" style="color:#3a3a42;text-decoration:none">engagebyelevate.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function heading(text) {
  return `<div style="font-family:'Archivo',Georgia,serif;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;margin-bottom:20px">${text}</div>`;
}

function greeting(name) {
  return name
    ? `<div style="color:#ffffff;margin-bottom:16px">Hello ${esc(name)},</div>`
    : `<div style="color:#ffffff;margin-bottom:16px">Hello,</div>`;
}

function blockquote(text) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0">
  <tr>
    <td style="border-left:2px solid #C85A3A;padding:12px 20px;font-style:italic;color:#a0a0a8;font-size:14px;line-height:1.6">${esc(text)}</td>
  </tr>
</table>`;
}

function fallbackLink(url) {
  return `<div style="margin-top:8px;font-size:12px;color:#5a5a65;word-break:break-all">Or paste this URL into your browser:<br><a href="${url}" style="color:#C85A3A;text-decoration:none">${url}</a></div>`;
}

function footnote(text) {
  return `<div style="margin-top:32px;font-size:13px;color:#5a5a65;line-height:1.6">${text}</div>`;
}

// ================================================================
// 1. Magic link
// ================================================================

async function sendMagicLink(user, token) {
  const url = `${process.env.BASE_URL}/auth/verify?token=${token}`;
  const subject = 'Your access link to Engage by Elevate';

  const html = wrap(`
    ${heading('Your Access Link')}
    ${greeting(user.contact_name)}
    <div style="margin-bottom:20px">Click below to access your dashboard for Engage by Elevate, ${EVENT_DATES} in ${EVENT_LOCATION}. From here you can view your personal agenda, manage meeting requests, and update your profile.</div>
    ${btn('ACCESS DASHBOARD', url)}
    ${fallbackLink(url)}
    ${footnote("This link is unique to your account. Don't share it \u2014 anyone with this link can access your profile.")}
  `);

  const text = `Hello ${user.contact_name || ''},

Your access link to Engage by Elevate:
${url}

Click the link above to access your dashboard for Engage by Elevate, ${EVENT_DATES} in ${EVENT_LOCATION}. From here you can view your personal agenda, manage meeting requests, and update your profile.

This link is unique to your account. Don't share it.

---
Engage by Elevate - ${EVENT_DATES} - ${EVENT_LOCATION}
${SITE}`;

  return send(user.email, subject, html, text, {
    template: 'magic_link', user_id: user.id
  });
}

// ================================================================
// 2. Meeting request received
// ================================================================

async function sendMeetingRequest(meeting, requester, recipient) {
  const dashUrl = `${process.env.BASE_URL}/dashboard?meeting=${meeting.id}`;
  const profileUrl = `${process.env.BASE_URL}/profile.html?id=${requester.id}`;
  const subject = `${requester.org_name} wants to meet with you`;

  const html = wrap(`
    ${heading('New Meeting Request')}
    ${greeting(recipient.contact_name)}
    <div style="margin-bottom:8px">You have a new meeting request from <strong style="color:#ffffff">${esc(requester.org_name)}</strong>.</div>
    ${meetingCard({
      org: requester.org_name,
      contact: requester.contact_name,
      datetime: fmtShort(meeting.start_time)
    })}
    ${meeting.message ? blockquote(meeting.message) : ''}
    ${btn('REVIEW REQUEST', dashUrl)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:-16px">
      <tr>
        <td>
          <a href="${profileUrl}" style="font-family:'Manrope',-apple-system,sans-serif;font-size:12px;letter-spacing:0.5px;color:#C85A3A;text-decoration:none;text-transform:uppercase;font-weight:600">View ${esc(requester.org_name)}'s profile</a>
        </td>
      </tr>
    </table>
    ${footnote('This request expires 48 hours before the proposed meeting time if not actioned.')}
  `);

  const text = `Hello ${recipient.contact_name || ''},

You have a new meeting request from ${requester.org_name} (${requester.contact_name}).

When: ${fmtShort(meeting.start_time)}
Duration: 20 minutes
${meeting.message ? `\nMessage: "${meeting.message}"\n` : ''}
Review this request on your dashboard:
${dashUrl}

This request expires 48 hours before the proposed meeting time if not actioned.

---
Engage by Elevate - ${EVENT_DATES} - ${EVENT_LOCATION}
${SITE}`;

  return send(recipient.email, subject, html, text, {
    template: 'meeting_request', meeting_id: meeting.id, user_id: recipient.id
  });
}

// ================================================================
// 3. Meeting approved
// ================================================================

async function sendMeetingApproved(meeting) {
  const teamsBlock = meeting.teams_join_url
    ? btn('JOIN TEAMS MEETING', meeting.teams_join_url, '#5B5FC7')
    : `<div style="margin:24px 0;padding:16px 20px;background:#141414;border-left:3px solid #5a5a65;font-size:14px;color:#a0a0a8">The Teams link will be sent separately by the organizer.</div>`;

  const buildHtml = (toName, otherOrg, otherContact) => wrap(`
    ${heading('Meeting Confirmed')}
    ${greeting(toName)}
    <div style="margin-bottom:8px">Your meeting with <strong style="color:#ffffff">${esc(otherOrg)}</strong> is confirmed.</div>
    ${meetingCard({
      org: otherOrg,
      contact: otherContact,
      datetime: fmtShort(meeting.start_time)
    })}
    ${teamsBlock}
    ${footnote('Add this meeting to your calendar by saving the invite from your <a href="' + SITE + '/dashboard" style="color:#C85A3A;text-decoration:none">dashboard</a>.')}
  `);

  const buildText = (toName, otherOrg, otherContact) => `Hello ${toName || ''},

Your meeting with ${otherOrg} (${otherContact}) is confirmed.

When: ${fmtShort(meeting.start_time)}
Duration: 20 minutes
${meeting.teams_join_url ? `\nJoin Teams: ${meeting.teams_join_url}\n` : '\nThe Teams link will be sent separately by the organizer.\n'}
View all your meetings on your dashboard:
${SITE}/dashboard

---
Engage by Elevate - ${EVENT_DATES} - ${EVENT_LOCATION}
${SITE}`;

  const subjectFor = (otherOrg) => `Confirmed: Meeting with ${otherOrg}`;

  await send(
    meeting.requester_email,
    subjectFor(meeting.recipient_org),
    buildHtml(meeting.requester_name, meeting.recipient_org, meeting.recipient_name),
    buildText(meeting.requester_name, meeting.recipient_org, meeting.recipient_name),
    { template: 'meeting_approved', meeting_id: meeting.id, user_id: meeting.requester_id }
  );
  await send(
    meeting.recipient_email,
    subjectFor(meeting.requester_org),
    buildHtml(meeting.recipient_name, meeting.requester_org, meeting.requester_name),
    buildText(meeting.recipient_name, meeting.requester_org, meeting.requester_name),
    { template: 'meeting_approved', meeting_id: meeting.id, user_id: meeting.recipient_id }
  );
}

// ================================================================
// 4. Meeting declined
// ================================================================

async function sendMeetingDeclined(meeting) {
  const dashUrl = `${process.env.BASE_URL}/dashboard`;
  const subject = `Meeting request with ${meeting.recipient_org} was declined`;

  const html = wrap(`
    ${heading('Meeting Request Declined')}
    ${greeting(meeting.requester_name)}
    <div style="margin-bottom:8px"><strong style="color:#ffffff">${esc(meeting.recipient_org)}</strong> is unable to meet at the time you proposed. You may be able to find another slot that works for both of you.</div>
    ${meeting.decline_reason ? blockquote(meeting.decline_reason) : ''}
    ${meetingCard({
      org: meeting.recipient_org,
      datetime: fmtShort(meeting.start_time)
    })}
    ${btn('VIEW AVAILABLE SLOTS', dashUrl)}
  `);

  const text = `Hello ${meeting.requester_name || ''},

Your meeting request with ${meeting.recipient_org} at ${fmtShort(meeting.start_time)} was declined.

${meeting.recipient_org} is unable to meet at the time you proposed. You may be able to find another slot that works for both of you.
${meeting.decline_reason ? `\nReason: "${meeting.decline_reason}"\n` : ''}
View available slots on your dashboard:
${dashUrl}

---
Engage by Elevate - ${EVENT_DATES} - ${EVENT_LOCATION}
${SITE}`;

  return send(meeting.requester_email, subject, html, text, {
    template: 'meeting_declined', meeting_id: meeting.id, user_id: meeting.requester_id
  });
}

// ================================================================
// 5. Meeting cancelled
// ================================================================

async function sendMeetingCancelled(meeting, cancelledByUserId) {
  const otherEmail = cancelledByUserId === meeting.requester_id ? meeting.recipient_email : meeting.requester_email;
  const otherName = cancelledByUserId === meeting.requester_id ? meeting.recipient_name : meeting.requester_name;
  const cancellerOrg = cancelledByUserId === meeting.requester_id ? meeting.requester_org : meeting.recipient_org;
  const otherUserId = cancelledByUserId === meeting.requester_id ? meeting.recipient_id : meeting.requester_id;
  const dashUrl = `${process.env.BASE_URL}/dashboard`;
  const subject = `Meeting with ${cancellerOrg} was cancelled`;

  const html = wrap(`
    ${heading('Meeting Cancelled')}
    ${greeting(otherName)}
    <div style="margin-bottom:8px"><strong style="color:#ffffff">${esc(cancellerOrg)}</strong> has cancelled your meeting scheduled for ${fmtShort(meeting.start_time)}. Your slot is now free for other requests.</div>
    ${meetingCard({
      org: cancellerOrg,
      datetime: fmtShort(meeting.start_time)
    })}
    ${btn('BACK TO DASHBOARD', dashUrl)}
  `);

  const text = `Hello ${otherName || ''},

${cancellerOrg} has cancelled your meeting scheduled for ${fmtShort(meeting.start_time)}. Your slot is now free for other requests.

Return to your dashboard:
${dashUrl}

---
Engage by Elevate - ${EVENT_DATES} - ${EVENT_LOCATION}
${SITE}`;

  return send(otherEmail, subject, html, text, {
    template: 'meeting_cancelled', meeting_id: meeting.id, user_id: otherUserId
  });
}

module.exports = {
  sendMagicLink,
  sendMeetingRequest,
  sendMeetingApproved,
  sendMeetingDeclined,
  sendMeetingCancelled
};
