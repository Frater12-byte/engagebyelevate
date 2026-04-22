/**
 * Email service — Engage by Elevate 2026
 *
 * Sends via SMTP. All sends logged to email_log table.
 * Templates: dark branded design matching engagebyelevate.com
 * Table-based layout, inline CSS, plain-text fallbacks.
 */

const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const { getDb } = require('../db/connection');

const EVENT_TZ = 'Asia/Dubai';
const REPLY_TO = process.env.REPLY_TO_EMAIL || 'engage.meetings@elevatedmc.com';

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
      replyTo: REPLY_TO,
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
  return dayjs(iso).tz(EVENT_TZ).format('dddd, MMMM D, YYYY [at] HH:mm') + ' (Dubai time)';
}

function fmtShort(iso) {
  return dayjs(iso).tz(EVENT_TZ).format('ddd, MMM D [at] HH:mm') + ' GST';
}

// Font stacks matching the website
const F_DISPLAY = "'Archivo', Georgia, serif";
const F_BODY = "'Manrope', -apple-system, 'Segoe UI', sans-serif";
const C_RUST = '#E8612A';
const C_WHITE = '#ffffff';
const C_SOFT = '#b0b0b8';
const C_MUTED = '#6a6a75';
const C_CARD = '#141416';

/** Outlook-safe CTA button — large, prominent */
function btn(label, href, bg = C_RUST) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="border-radius:6px;background:${bg}">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:280px" arcsize="8%" stroke="f" fillcolor="${bg}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px">${esc(label)}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${href}" target="_blank" style="display:inline-block;padding:16px 48px;background:${bg};color:#ffffff;text-decoration:none;font-family:${F_BODY};font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:6px;line-height:1;mso-hide:all">${esc(label)}</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Meeting details card — clean, spacious */
function meetingCard(data) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;border-radius:8px;overflow:hidden">
  <tr>
    <td style="background:${C_CARD};padding:24px 28px;border-left:4px solid ${C_RUST}">
      ${data.org ? `<div style="font-family:${F_DISPLAY};font-size:20px;font-weight:700;color:${C_WHITE};margin-bottom:6px">${esc(data.org)}</div>` : ''}
      ${data.contact ? `<div style="font-family:${F_BODY};font-size:15px;color:${C_SOFT};margin-bottom:16px">${esc(data.contact)}</div>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding-right:32px;vertical-align:top">
            <div style="font-family:${F_BODY};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C_MUTED};margin-bottom:6px">When</div>
            <div style="font-family:${F_DISPLAY};font-size:16px;font-weight:600;color:${C_WHITE}">${data.datetime}</div>
          </td>
          <td style="vertical-align:top">
            <div style="font-family:${F_BODY};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C_MUTED};margin-bottom:6px">Duration</div>
            <div style="font-family:${F_DISPLAY};font-size:16px;font-weight:600;color:${C_WHITE}">20 min</div>
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

        <!-- Content -->
        <tr>
          <td style="font-family:${F_BODY};font-size:16px;line-height:1.75;color:${C_SOFT}">
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
                  <a href="mailto:${REPLY_TO}" style="color:#C85A3A;text-decoration:none">Contact Us</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;font-family:'Manrope',-apple-system,sans-serif;font-size:12px;color:#5a5a65">
                  Questions? <a href="mailto:${REPLY_TO}" style="color:#C85A3A;text-decoration:none">${REPLY_TO}</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-family:'Manrope',-apple-system,sans-serif;font-size:12px;color:#5a5a65">
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
  return `<div style="font-family:${F_DISPLAY};font-size:28px;font-weight:800;color:${C_WHITE};line-height:1.2;margin-bottom:8px;letter-spacing:-0.02em">${text}</div>`;
}

function subheading(text) {
  return `<div style="font-size:17px;color:${C_SOFT};margin-bottom:24px;line-height:1.6">${text}</div>`;
}

function greeting(name) {
  return `<div style="color:${C_WHITE};font-size:17px;margin-bottom:20px">Hi ${esc(name || 'there')},</div>`;
}

function blockquote(text) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0">
  <tr>
    <td style="border-left:3px solid ${C_RUST};padding:16px 24px;font-style:italic;color:${C_SOFT};font-size:15px;line-height:1.7;background:${C_CARD};border-radius:0 6px 6px 0">${esc(text)}</td>
  </tr>
</table>`;
}

function fallbackLink(url) {
  return `<div style="margin-top:12px;font-size:13px;color:${C_MUTED};word-break:break-all;line-height:1.6">Or copy this link:<br><a href="${url}" style="color:${C_RUST};text-decoration:none">${url}</a></div>`;
}

function footnote(text) {
  return `<div style="margin-top:36px;padding-top:20px;border-top:1px solid #1a1a1f;font-size:13px;color:${C_MUTED};line-height:1.6">${text}</div>`;
}

// ================================================================
// 1. Magic link
// ================================================================

async function sendMagicLink(user, token) {
  const url = `${process.env.BASE_URL}/auth/verify?token=${token}`;
  const subject = 'Your access link to Engage by Elevate';

  const html = wrap(`
    ${heading('Welcome to Engage')}
    ${greeting(user.contact_name)}
    ${subheading('Your personal dashboard is ready. View your agenda, browse participants, and start booking meetings.')}
    ${btn('Open Your Dashboard', url)}
    ${fallbackLink(url)}
    ${footnote("This link is unique to your account. Keep it private \u2014 anyone with this link can access your profile.")}
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
    ${subheading(`<strong style="color:${C_WHITE}">${esc(requester.org_name)}</strong> would like to meet with you.`)}
    ${meetingCard({
      org: requester.org_name,
      contact: requester.contact_name,
      datetime: fmtShort(meeting.start_time)
    })}
    ${meeting.message ? blockquote(meeting.message) : ''}
    ${btn('Review Request', dashUrl)}
    <div style="text-align:center;margin-top:-8px">
      <a href="${profileUrl}" style="font-family:${F_BODY};font-size:13px;color:${C_RUST};text-decoration:none">View their profile</a>
    </div>
    ${footnote('This request expires 48 hours before the meeting time if not actioned.')}
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
    ? btn('Join Teams Meeting', meeting.teams_join_url, '#5B5FC7')
    : '';

  // Google Calendar link
  const gcalStart = dayjs(meeting.start_time).utc().format('YYYYMMDDTHHmmss') + 'Z';
  const gcalEnd = dayjs(meeting.start_time).add(30, 'minute').utc().format('YYYYMMDDTHHmmss') + 'Z';
  const gcalSubject = encodeURIComponent(`Engage by Elevate — ${meeting.requester_org} × ${meeting.recipient_org}`);
  const gcalDetails = encodeURIComponent(meeting.teams_join_url ? `Join Teams: ${meeting.teams_join_url}` : 'Engage by Elevate meeting');
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalSubject}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}&location=${encodeURIComponent(meeting.teams_join_url || 'Microsoft Teams')}`;
  const icsUrl = `${SITE}/api/meetings/${meeting.id}/calendar.ics`;

  const calendarBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 0">
      <tr>
        <td align="center" style="font-family:${F_BODY};font-size:13px;color:${C_MUTED}">
          <a href="${icsUrl}" style="color:${C_RUST};text-decoration:none;font-weight:600">Download .ics</a>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <a href="${gcalUrl}" style="color:${C_RUST};text-decoration:none;font-weight:600">Google Calendar</a>
        </td>
      </tr>
    </table>`;

  const buildHtml = (toName, otherOrg, otherContact) => wrap(`
    ${heading('Meeting Confirmed')}
    ${greeting(toName)}
    ${subheading(`Your meeting with <strong style="color:${C_WHITE}">${esc(otherOrg)}</strong> is confirmed.`)}
    ${meetingCard({
      org: otherOrg,
      contact: otherContact,
      datetime: fmtShort(meeting.start_time)
    })}
    ${teamsBlock}
    ${calendarBlock}
    ${footnote('View all your meetings on your <a href="' + SITE + '/dashboard" style="color:' + C_RUST + ';text-decoration:none">dashboard</a>.')}
  `);

  const buildText = (toName, otherOrg, otherContact) => `Hello ${toName || ''},

Your meeting with ${otherOrg} (${otherContact}) is confirmed.

When: ${fmtShort(meeting.start_time)}
Duration: 30 minutes
${meeting.teams_join_url ? `\nJoin Teams: ${meeting.teams_join_url}\n` : ''}
Add to calendar: ${icsUrl}
Google Calendar: ${gcalUrl}

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
    ${heading('Request Declined')}
    ${greeting(meeting.requester_name)}
    ${subheading(`<strong style="color:${C_WHITE}">${esc(meeting.recipient_org)}</strong> is unable to meet at the proposed time. You can try another slot.`)}
    ${meetingCard({
      org: meeting.recipient_org,
      datetime: fmtShort(meeting.start_time)
    })}
    ${meeting.decline_reason ? blockquote(meeting.decline_reason) : ''}
    ${btn('Back to Dashboard', dashUrl)}
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
    ${subheading(`<strong style="color:${C_WHITE}">${esc(cancellerOrg)}</strong> has cancelled your meeting. Your slot is now free.`)}
    ${meetingCard({
      org: cancellerOrg,
      datetime: fmtShort(meeting.start_time)
    })}
    ${btn('Back to Dashboard', dashUrl)}
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

// ================================================================
// 6. Admin notification — new registration
// ================================================================

async function sendAdminNotification(to, reg) {
  const subject = `New registration: ${reg.org_name} (${reg.type})`;

  const html = wrap(`
    ${heading('New Registration')}
    ${subheading(`A new <strong style="color:${C_WHITE}">${reg.type}</strong> just registered.`)}
    ${meetingCard({
      org: reg.org_name,
      contact: `${reg.contact_name} \u2014 ${reg.email}`,
      datetime: `${reg.city ? reg.city + ', ' : ''}${reg.country}`
    })}
    ${btn('View Directory', SITE + '/directory')}
  `);

  const text = `New ${reg.type} registration on Engage by Elevate:

Organization: ${reg.org_name}
Contact: ${reg.contact_name}
Email: ${reg.email}
Location: ${[reg.city, reg.country].filter(Boolean).join(', ')}

View directory: ${SITE}/directory`;

  return send(to, subject, html, text, { template: 'admin_notification' });
}

module.exports = {
  sendMagicLink,
  sendMeetingRequest,
  sendMeetingApproved,
  sendMeetingDeclined,
  sendMeetingCancelled,
  sendAdminNotification
};
