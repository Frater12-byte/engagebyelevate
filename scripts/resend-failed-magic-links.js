#!/usr/bin/env node
/**
 * resend-failed-magic-links.js
 *
 * Re-sends magic-link emails for every recipient whose magic_link send
 * appears as `failed` in email_log within the last N days (default 2).
 *
 * Targets each unique recipient ONCE even if the original send failed
 * multiple times. Uses the same sendMagicLinkEmail() the admin Resend
 * button uses, so the rate-limited /auth/magic public route is bypassed.
 * Throttles 150ms between sends (matches the existing bulk-resend-unverified
 * endpoint).
 *
 * Usage (run from the app root):
 *   cd /home/engagebyelevate/htdocs/engagebyelevate.com
 *   node scripts/resend-failed-magic-links.js [days]
 *
 * Examples:
 *   node scripts/resend-failed-magic-links.js        # past 2 days (default)
 *   node scripts/resend-failed-magic-links.js 1      # past 1 day
 *   node scripts/resend-failed-magic-links.js 7      # past week
 */
require('dotenv').config();

const { getDb } = require('../server/db/connection');
const { sendMagicLinkEmail } = require('../server/services/magicLink');

const days = parseInt(process.argv[2] || '2', 10);
const DELAY_MS = 150;

(async () => {
  const db = getDb();

  const recipients = db.prepare(`
    SELECT DISTINCT to_email
    FROM email_log
    WHERE status = 'failed'
      AND template = 'magic_link'
      AND sent_at >= datetime('now', '-' || ? || ' days')
    ORDER BY to_email
  `).all(days);

  console.log(`Found ${recipients.length} unique recipients with failed magic_link sends in last ${days} day(s).`);
  console.log(`Sending one re-attempt per recipient, throttled ${DELAY_MS}ms apart.\n`);

  let sent = 0, skipped = 0, errors = 0;

  for (let i = 0; i < recipients.length; i++) {
    const email = recipients[i].to_email;
    const user = db.prepare(
      "SELECT id, email, org_name FROM users WHERE LOWER(email) = LOWER(?) AND active = 1"
    ).get(email);

    const prefix = `[${String(i + 1).padStart(3)}/${recipients.length}]`;

    if (!user) {
      console.log(`${prefix} SKIP  ${email}  (user not found or inactive)`);
      skipped++;
      continue;
    }

    try {
      await sendMagicLinkEmail(user.id);
      console.log(`${prefix} OK    ${user.email}  ${user.org_name ? '(' + user.org_name + ')' : ''}`);
      sent++;
    } catch (e) {
      console.log(`${prefix} FAIL  ${user.email}  — ${e.message}`);
      errors++;
    }

    if (i < recipients.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\nDone. Sent: ${sent}  Skipped: ${skipped}  Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
