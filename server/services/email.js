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
const actionTokens = require('./actionTokens');

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

const { nowUtc } = require('../utils/time');

function dbLog(row) {
  try {
    getDb().prepare(`
      INSERT INTO email_log (to_email, subject, template, meeting_id, user_id, status, error, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.to_email, row.subject, row.template, row.meeting_id || null, row.user_id || null, row.status || 'sent', row.error || null, nowUtc());
  } catch (e) { console.error('email_log insert failed:', e.message); }
}

async function send(to, subject, html, text, meta = {}) {
  try {
    const mailOpts = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      replyTo: REPLY_TO,
      to, subject, html, text
    };
    if (meta.attachments) mailOpts.attachments = meta.attachments;
    const info = await getTransporter().sendMail(mailOpts);
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

function tzCity(tz) {
  const map = {
    'Asia/Dubai':'Dubai','Asia/Bangkok':'Bangkok','Europe/London':'London',
    'Europe/Paris':'Paris','Europe/Madrid':'Madrid','Europe/Lisbon':'Lisbon',
    'Europe/Bucharest':'Bucharest','Indian/Maldives':'Maldives','Indian/Mauritius':'Mauritius'
  };
  if (map[tz]) return map[tz];
  if (!tz) return 'Dubai';
  const parts = tz.split('/');
  return (parts[parts.length - 1] || tz).replace(/_/g, ' ');
}

function fmtShortDual(iso, userTz) {
  const dubaiTime = dayjs(iso).tz(EVENT_TZ).format('HH:mm');
  const dateStr = dayjs(iso).tz(EVENT_TZ).format('ddd, MMM D');
  if (!userTz || userTz === EVENT_TZ) return `${dateStr} at ${dubaiTime} Dubai`;
  const localTime = dayjs(iso).tz(userTz).format('HH:mm');
  const localDate = dayjs(iso).tz(userTz).format('ddd, MMM D');
  return `${localDate} at ${localTime} ${tzCity(userTz)} (${dubaiTime} Dubai)`;
}

// Font stacks matching the website
const F_DISPLAY = "'Barlow', 'Helvetica Neue', Arial, sans-serif";
const F_CONDENSED = "'Barlow Condensed', 'Oswald', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
const F_BODY = "'Manrope', -apple-system, 'Segoe UI', Arial, sans-serif";
const C_BG = '#080808';
const C_ELEV = '#141416';
const C_SUBTLE = '#1a1a1d';
const C_BORDER = '#27272a';
const C_ORANGE = '#EC672C';
const C_ORANGE_SOFT = 'rgba(236,103,44,0.12)';
const C_WHITE = '#ffffff';
const C_SOFT = '#b0b0b8';
const C_MUTED = '#6a6a75';
const C_FAINT = '#3a3a42';

function headerDashboardButton() {
  return `<a href="${SITE}/dashboard" style="display:inline-block;padding:8px 16px;background:${C_ORANGE};color:${C_WHITE};text-decoration:none;font-family:${F_DISPLAY};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:4px;line-height:1">My Dashboard</a>`;
}

function countdownBlock(targetIso, eyebrow = 'MEETING STARTS IN') {
  const target = dayjs(targetIso);
  const now = dayjs();
  if (target.isBefore(now)) return '';
  const diff = target.diff(now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const cell = (num, label) => `<td align="center" style="padding:0 8px">
    <div style="font-family:${F_CONDENSED};font-size:42px;font-weight:800;color:${C_ORANGE};line-height:1">${String(num).padStart(2,'0')}</div>
    <div style="font-family:${F_CONDENSED};font-size:10px;font-weight:600;color:${C_MUTED};text-transform:uppercase;letter-spacing:1.5px;margin-top:6px">${label}</div>
  </td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0">
    <tr><td align="center" style="font-family:${F_CONDENSED};font-size:11px;font-weight:600;color:${C_ORANGE};text-transform:uppercase;letter-spacing:2px;padding-bottom:16px">${eyebrow}</td></tr>
    <tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cell(days,'Days')}${cell(hours,'Hours')}${cell(minutes,'Min')}</tr></table></td></tr>
  </table>`;
}

function countdownText(targetIso) {
  const target = dayjs(targetIso);
  const now = dayjs();
  if (target.isBefore(now)) return '';
  const diff = target.diff(now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `Meeting starts in: ${days} days, ${hours} hours, ${minutes} minutes`;
}

function pill(label, variant = 'outline') {
  const styles = {
    solid: `background:${C_ORANGE};color:${C_WHITE};border:1px solid ${C_ORANGE}`,
    outline: `background:${C_ORANGE_SOFT};color:${C_ORANGE};border:1px solid ${C_ORANGE}`,
    neutral: `background:${C_BORDER};color:${C_SOFT};border:1px solid ${C_BORDER}`,
    red: `background:rgba(220,80,80,0.12);color:#d55050;border:1px solid rgba(220,80,80,0.3)`
  };
  return `<span style="display:inline-block;font-family:${F_CONDENSED};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:4px 10px;border-radius:999px;${styles[variant] || styles.outline}">${esc(label)}</span>`;
}

/** Outlook-safe CTA button — large, prominent */
function btn(label, href, bg = C_ORANGE) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="border-radius:4px;background:${bg}">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:280px" arcsize="8%" stroke="f" fillcolor="${bg}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px">${esc(label)}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${href}" target="_blank" style="display:inline-block;padding:18px 48px;background:${bg};color:#ffffff;text-decoration:none;font-family:${F_DISPLAY};font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:4px;line-height:1;mso-hide:all">${esc(label)}</a>
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
    <td style="background:${C_ELEV};padding:24px 28px;border-left:4px solid ${C_ORANGE}">
      ${data.org ? `<div style="font-family:${F_DISPLAY};font-size:20px;font-weight:700;color:${C_WHITE};margin-bottom:6px">${esc(data.org)}</div>` : ''}
      ${data.contact ? `<div style="font-family:${F_BODY};font-size:15px;color:${C_SOFT};margin-bottom:16px">${esc(data.contact)}</div>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding-right:32px;vertical-align:top">
            <div style="font-family:${F_CONDENSED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C_MUTED};margin-bottom:6px">When</div>
            <div style="font-family:${F_DISPLAY};font-size:16px;font-weight:600;color:${C_WHITE}">${data.datetime}</div>
          </td>
          <td style="vertical-align:top">
            <div style="font-family:${F_CONDENSED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C_MUTED};margin-bottom:6px">Duration</div>
            <div style="font-family:${F_CONDENSED};font-size:16px;font-weight:600;color:${C_WHITE}">20 min</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

const LOGO_URL = `${SITE}/img/logo.png`;

/** Full email wrapper — dark branded layout with logo, color sparks, rich footer */
function wrap(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Engage by Elevate</title>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C_BG};color:#ffffff;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px">${esc(preheader)}</div>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C_BG}">
  <tr>
    <td align="center" style="padding:40px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%">

        <!-- Header with logo and Dubai clock -->
        <tr>
          <td style="padding:0 0 32px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding-bottom:20px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="vertical-align:middle">
                        <a href="${SITE}" style="text-decoration:none"><img src="${LOGO_URL}" alt="Engage by Elevate" width="180" style="display:block;height:auto;border:0;max-width:180px" /></a>
                      </td>
                      <td align="right" style="vertical-align:middle">
                        ${headerDashboardButton()}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="height:3px;background:linear-gradient(90deg, ${C_ORANGE} 0%, ${C_ORANGE} 40%, rgba(99,140,255,0.3) 70%, transparent 100%);font-size:0;line-height:0">&nbsp;</td>
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
              <tr><td style="height:1px;background:linear-gradient(90deg, transparent, rgba(236,103,44,0.2), rgba(99,140,255,0.1), transparent);font-size:0;line-height:0">&nbsp;</td></tr>
            </table>

            <!-- Footer links -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px">
              <tr>
                <td style="font-family:${F_BODY};font-size:12px;color:${C_MUTED};line-height:2">
                  <a href="${SITE}/agenda" style="color:${C_ORANGE};text-decoration:none">Agenda</a> &nbsp;&middot;&nbsp;
                  <a href="${SITE}/directory" style="color:${C_ORANGE};text-decoration:none">Directory</a> &nbsp;&middot;&nbsp;
                  <a href="${SITE}/signup.html" style="color:${C_ORANGE};text-decoration:none">Register</a> &nbsp;&middot;&nbsp;
                  <a href="${SITE}/login.html" style="color:${C_ORANGE};text-decoration:none">Sign In</a> &nbsp;&middot;&nbsp;
                  <a href="mailto:${REPLY_TO}" style="color:${C_ORANGE};text-decoration:none">Contact Us</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;font-family:${F_BODY};font-size:12px;color:${C_MUTED}">
                  Questions? <a href="mailto:${REPLY_TO}" style="color:${C_ORANGE};text-decoration:none">${REPLY_TO}</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-family:${F_BODY};font-size:12px;color:${C_MUTED}">
                  Engage by Elevate &middot; ${EVENT_DATES} &middot; ${EVENT_LOCATION}
                </td>
              </tr>
              <tr>
                <td style="padding-top:4px;font-family:${F_BODY};font-size:11px;color:${C_FAINT}">
                  Elevate Tourism LLC &middot; Dubai, UAE &middot; <a href="${SITE}" style="color:${C_FAINT};text-decoration:none">engagebyelevate.com</a>
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
    <td style="border-left:3px solid ${C_ORANGE};padding:16px 24px;font-style:italic;color:${C_SOFT};font-size:15px;line-height:1.7;background:${C_ELEV};border-radius:0 6px 6px 0">${esc(text)}</td>
  </tr>
</table>`;
}

function fallbackLink(url) {
  return `<div style="margin-top:12px;font-size:13px;color:${C_MUTED};word-break:break-all;line-height:1.6">Or copy this link:<br><a href="${url}" style="color:${C_ORANGE};text-decoration:none">${url}</a></div>`;
}

function buildIcs(meeting) {
  const dtStart = dayjs(meeting.start_time).utc().format('YYYYMMDD[T]HHmmss') + 'Z';
  const dtEnd = dayjs(meeting.start_time).add(20, 'minute').utc().format('YYYYMMDD[T]HHmmss') + 'Z';
  const dtStamp = dayjs().utc().format('YYYYMMDD[T]HHmmss') + 'Z';
  const summary = `Engage by Elevate — ${meeting.requester_org} × ${meeting.recipient_org}`;
  const description = meeting.teams_join_url ? `Join Teams: ${meeting.teams_join_url}` : 'Engage by Elevate meeting';
  const location = meeting.teams_join_url || 'Microsoft Teams';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Engage by Elevate//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:engage-${meeting.id}@engagebyelevate.com`, `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`, `DTEND:${dtEnd}`, `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`, `LOCATION:${location}`,
    `ORGANIZER;CN=Engage by Elevate:mailto:engage.meetings@elevatedmc.com`,
    'STATUS:CONFIRMED',
    ...(meeting.teams_join_url ? [`URL:${meeting.teams_join_url}`] : []),
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}

function footnote(text) {
  return `<div style="margin-top:36px;padding-top:20px;border-top:1px solid ${C_BORDER};font-size:13px;color:${C_MUTED};line-height:1.6">${text}</div>`;
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
  `, 'Your secure access link to Engage by Elevate \u00b7 June 2\u20134, 2026');

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
  const recipientToken = actionTokens.generate(recipient.id, meeting.id);
  const dashUrl = `${process.env.BASE_URL}/auth/action?token=${recipientToken}&next=${encodeURIComponent('/dashboard?meeting=' + meeting.id)}`;
  const profileUrl = `${process.env.BASE_URL}/profile.html?id=${requester.id}`;
  const subject = `${requester.org_name} wants to meet with you`;

  const html = wrap(`
    ${heading('New Meeting Request')}
    ${greeting(recipient.contact_name)}
    ${subheading(`<strong style="color:${C_WHITE}">${esc(requester.org_name)}</strong> would like to meet with you.`)}
    ${meetingCard({
      org: requester.org_name,
      contact: requester.contact_name,
      datetime: fmtShortDual(meeting.start_time, recipient.timezone)
    })}
    ${meeting.message ? blockquote(meeting.message) : ''}
    ${countdownBlock(meeting.start_time, 'MEETING STARTS IN')}
    ${btn('Review Request', dashUrl)}
    <div style="text-align:center;margin-top:-8px">
      <a href="${profileUrl}" style="font-family:${F_BODY};font-size:13px;color:${C_ORANGE};text-decoration:none">View their profile</a>
    </div>
    ${footnote('This request expires 48 hours before the meeting time if not actioned.')}
  `, `New meeting request from ${requester.org_name} \u00b7 Engage by Elevate`);

  const cdText = countdownText(meeting.start_time);
  const text = `Hello ${recipient.contact_name || ''},

You have a new meeting request from ${requester.org_name} (${requester.contact_name}).

When: ${fmtShortDual(meeting.start_time, recipient.timezone)}
Duration: 20 minutes
${cdText ? cdText + '\n' : ''}${meeting.message ? `\nMessage: "${meeting.message}"\n` : ''}
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
    ? btn('Join Teams Meeting', meeting.teams_join_url, C_ORANGE)
    : '';

  // Calendar links
  const gcalStart = dayjs(meeting.start_time).utc().format('YYYYMMDDTHHmmss') + 'Z';
  const gcalEnd = dayjs(meeting.start_time).add(20, 'minute').utc().format('YYYYMMDDTHHmmss') + 'Z';
  const gcalSubject = encodeURIComponent(`Engage by Elevate — ${meeting.requester_org} × ${meeting.recipient_org}`);
  const gcalDetails = encodeURIComponent(meeting.teams_join_url ? `Join Teams: ${meeting.teams_join_url}` : 'Engage by Elevate meeting');
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalSubject}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}&location=${encodeURIComponent(meeting.teams_join_url || 'Microsoft Teams')}`;
  const outlookUrl = `https://outlook.office.com/calendar/0/action/compose?subject=${gcalSubject}&startdt=${encodeURIComponent(meeting.start_time)}&enddt=${encodeURIComponent(dayjs(meeting.start_time).add(20,'minute').toISOString())}&body=${gcalDetails}&location=${encodeURIComponent(meeting.teams_join_url || 'Microsoft Teams')}`;

  const calendarBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0">
      <tr><td align="center" style="font-family:${F_BODY};font-size:11px;color:${C_MUTED};text-transform:uppercase;letter-spacing:1.5px;padding-bottom:10px">Save invite</td></tr>
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 10px"><a href="${outlookUrl}" target="_blank" title="Add to Outlook"><img src="${SITE}/img/icon-outlook.png" width="40" height="40" alt="Outlook" style="border-radius:6px;display:block;border:0"></a></td>
            <td style="padding:0 10px"><a href="${gcalUrl}" target="_blank" title="Add to Google Calendar"><img src="${SITE}/img/icon-gcal.png" width="40" height="40" alt="Google Calendar" style="border-radius:6px;display:block;border:0"></a></td>
          </tr>
        </table>
      </td></tr>
      <tr><td align="center" style="font-family:${F_BODY};font-size:11px;color:${C_MUTED};padding-top:10px">A calendar invite (.ics) is attached to this email</td></tr>
    </table>`;

  // .ics attachment
  const icsContent = buildIcs(meeting);
  const icsAttachment = {
    filename: `engage-meeting-${meeting.id}.ics`,
    content: icsContent,
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
  };

  const requesterToken = actionTokens.generate(meeting.requester_id, meeting.id);
  const recipientToken = actionTokens.generate(meeting.recipient_id, meeting.id);
  const requesterDashUrl = `${process.env.BASE_URL}/auth/action?token=${requesterToken}&next=${encodeURIComponent('/dashboard')}`;
  const recipientDashUrl = `${process.env.BASE_URL}/auth/action?token=${recipientToken}&next=${encodeURIComponent('/dashboard')}`;

  const buildHtml = (toName, otherOrg, otherContact, toTz, toDashUrl) => wrap(`
    ${heading('Meeting Confirmed')}
    ${greeting(toName)}
    ${subheading(`${pill('CONFIRMED', 'solid')} Your meeting with <strong style="color:${C_WHITE}">${esc(otherOrg)}</strong> is confirmed.`)}
    ${meetingCard({
      org: otherOrg,
      contact: otherContact,
      datetime: fmtShortDual(meeting.start_time, toTz)
    })}
    ${countdownBlock(meeting.start_time, 'MEETING STARTS IN')}
    ${teamsBlock}
    ${calendarBlock}
    ${footnote('View all your meetings on your <a href="' + toDashUrl + '" style="color:' + C_ORANGE + ';text-decoration:none">dashboard</a>.')}
  `, `Meeting confirmed with ${otherOrg} \u00b7 Engage by Elevate`);

  const cdText = countdownText(meeting.start_time);
  const buildText = (toName, otherOrg, otherContact, toTz, toDashUrl) => `Hello ${toName || ''},

Your meeting with ${otherOrg} (${otherContact}) is confirmed.

When: ${fmtShortDual(meeting.start_time, toTz)}
Duration: 20 minutes
${cdText ? cdText + '\n' : ''}${meeting.teams_join_url ? `\nJoin Teams: ${meeting.teams_join_url}\n` : ''}
Add to Outlook: ${outlookUrl}
Add to Google Calendar: ${gcalUrl}
A calendar invite (.ics) is attached to this email.

View all your meetings on your dashboard:
${toDashUrl}

---
Engage by Elevate - ${EVENT_DATES} - ${EVENT_LOCATION}
${SITE}`;

  const subjectFor = (otherOrg) => `Confirmed: Meeting with ${otherOrg}`;

  await send(
    meeting.requester_email,
    subjectFor(meeting.recipient_org),
    buildHtml(meeting.requester_name, meeting.recipient_org, meeting.recipient_name, meeting.requester_timezone, requesterDashUrl),
    buildText(meeting.requester_name, meeting.recipient_org, meeting.recipient_name, meeting.requester_timezone, requesterDashUrl),
    { template: 'meeting_approved', meeting_id: meeting.id, user_id: meeting.requester_id, attachments: [icsAttachment] }
  );
  await send(
    meeting.recipient_email,
    subjectFor(meeting.requester_org),
    buildHtml(meeting.recipient_name, meeting.requester_org, meeting.requester_name, meeting.recipient_timezone, recipientDashUrl),
    buildText(meeting.recipient_name, meeting.requester_org, meeting.requester_name, meeting.recipient_timezone, recipientDashUrl),
    { template: 'meeting_approved', meeting_id: meeting.id, user_id: meeting.recipient_id, attachments: [icsAttachment] }
  );
}

// ================================================================
// 4. Meeting declined
// ================================================================

async function sendMeetingDeclined(meeting) {
  const requesterToken = actionTokens.generate(meeting.requester_id, meeting.id);
  const dashUrl = `${process.env.BASE_URL}/auth/action?token=${requesterToken}&next=${encodeURIComponent('/dashboard')}`;
  const subject = `Meeting request with ${meeting.recipient_org} was declined`;

  const html = wrap(`
    ${heading('Request Declined')}
    ${greeting(meeting.requester_name)}
    ${subheading(`<strong style="color:${C_WHITE}">${esc(meeting.recipient_org)}</strong> is unable to meet at the proposed time. You can try another slot.`)}
    ${meetingCard({
      org: meeting.recipient_org,
      datetime: fmtShortDual(meeting.start_time, meeting.requester_timezone)
    })}
    ${meeting.decline_reason ? blockquote(meeting.decline_reason) : ''}
    ${btn('Back to Dashboard', dashUrl)}
  `, `Meeting request with ${meeting.recipient_org} was declined \u00b7 Engage by Elevate`);

  const text = `Hello ${meeting.requester_name || ''},

Your meeting request with ${meeting.recipient_org} at ${fmtShortDual(meeting.start_time, meeting.requester_timezone)} was declined.

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
  const otherTz = cancelledByUserId === meeting.requester_id ? meeting.recipient_timezone : meeting.requester_timezone;
  const otherToken = actionTokens.generate(otherUserId, meeting.id);
  const dashUrl = `${process.env.BASE_URL}/auth/action?token=${otherToken}&next=${encodeURIComponent('/dashboard')}`;
  const subject = `Meeting with ${cancellerOrg} was cancelled`;

  const html = wrap(`
    ${heading('Meeting Cancelled')}
    ${greeting(otherName)}
    ${subheading(`<strong style="color:${C_WHITE}">${esc(cancellerOrg)}</strong> has cancelled your meeting. Your slot is now free.`)}
    ${meetingCard({
      org: cancellerOrg,
      datetime: fmtShortDual(meeting.start_time, otherTz)
    })}
    ${btn('Back to Dashboard', dashUrl)}
  `, `Meeting with ${cancellerOrg} was cancelled \u00b7 Engage by Elevate`);

  const text = `Hello ${otherName || ''},

${cancellerOrg} has cancelled your meeting scheduled for ${fmtShortDual(meeting.start_time, otherTz)}. Your slot is now free for other requests.

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
  `, `New ${reg.type} registration: ${reg.org_name}`);

  const text = `New ${reg.type} registration on Engage by Elevate:

Organization: ${reg.org_name}
Contact: ${reg.contact_name}
Email: ${reg.email}
Location: ${[reg.city, reg.country].filter(Boolean).join(', ')}

View directory: ${SITE}/directory`;

  return send(to, subject, html, text, { template: 'admin_notification' });
}

// ================================================================
// 7. Exhibitor contact — notify exhibitor
// ================================================================

async function sendExhibitorContact(exhibitor, sub) {
  const subject = `New enquiry from ${sub.sender_name} — Engage by Elevate`;
  const html = wrap(`
    ${heading('New Enquiry')}
    ${subheading(`${esc(sub.sender_name)}${sub.sender_company ? ' from ' + esc(sub.sender_company) : ''} has sent you a message via your Engage by Elevate profile.`)}
    ${meetingCard({ org: sub.sender_name, contact: sub.sender_company || '', datetime: sub.sender_email })}
    ${blockquote(sub.message)}
    ${footnote('Reply directly to <a href="mailto:' + esc(sub.sender_email) + '" style="color:' + C_ORANGE + ';text-decoration:none">' + esc(sub.sender_email) + '</a> to respond.')}
  `, `New enquiry from ${sub.sender_name} \u00b7 Engage by Elevate`);
  const text = `New enquiry from ${sub.sender_name}${sub.sender_company ? ' (' + sub.sender_company + ')' : ''}\nEmail: ${sub.sender_email}\n\nMessage:\n${sub.message}\n\nReply to ${sub.sender_email} to respond.`;
  return send(exhibitor.contact_email, subject, html, text, { template: 'exhibitor_contact' });
}

// ================================================================
// 8. Exhibitor contact — acknowledgement to sender
// ================================================================

async function sendExhibitorContactAck(exhibitor, sub) {
  const subject = `Your message to ${exhibitor.name} — Engage by Elevate`;
  const html = wrap(`
    ${heading('Message Sent')}
    ${subheading(`Your message has been forwarded to <strong style="color:${C_WHITE}">${esc(exhibitor.name)}</strong>. They will be in touch directly.`)}
    ${meetingCard({ org: exhibitor.name, contact: exhibitor.booth_number ? 'Booth ' + exhibitor.booth_number : '', datetime: exhibitor.website || '' })}
    ${blockquote(sub.message)}
  `, `Your message to ${exhibitor.name} has been sent`);
  const text = `Your message to ${exhibitor.name} has been sent.\n\nOriginal message:\n${sub.message}\n\nThey will reply directly to your email.`;
  return send(sub.sender_email, subject, html, text, { template: 'exhibitor_contact_ack' });
}

module.exports = {
  sendMagicLink,
  sendMeetingRequest,
  sendMeetingApproved,
  sendMeetingDeclined,
  sendMeetingCancelled,
  sendAdminNotification,
  sendExhibitorContact,
  sendExhibitorContactAck
};
