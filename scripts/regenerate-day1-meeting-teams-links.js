#!/usr/bin/env node
/**
 * regenerate-day1-meeting-teams-links.js
 *
 * For every approved 1:1 meeting on Day 1 (2026-06-02):
 *   1. Create a fresh Microsoft Teams meeting via Graph
 *   2. Replace meetings.teams_join_url + teams_meeting_id with the new
 *      values, preserving the old joinUrl in meetings.teams_join_url_old
 *      for one-step rollback.
 *   3. Send the "Meeting Confirmed" email to BOTH attendees with the
 *      new Teams URL + new .ics attachment — required because their
 *      saved calendar invite contains the OLD (now-broken) link.
 *
 * Safe to re-run: teams_join_url_old is only set the FIRST time we
 * touch a row (COALESCE in the UPDATE), so re-running won't lose the
 * original pre-regen link.
 *
 * Throttling: 600ms between meetings — keeps us well under Graph
 * (~30/sec tenant default) and gives Brevo time to send 2 emails per
 * iteration without bursting.
 *
 * Usage:
 *   cd /home/engagebyelevate/htdocs/engagebyelevate.com
 *   node scripts/regenerate-day1-meeting-teams-links.js
 *
 * Rollback (if needed):
 *   sqlite3 server/db/engage.db "UPDATE meetings SET teams_join_url = teams_join_url_old WHERE day='2026-06-02' AND teams_join_url_old IS NOT NULL"
 */
require('dotenv').config();

const { getDb } = require('../server/db/connection');
const { createMeeting } = require('../server/services/teams');
const emailService = require('../server/services/email');

const DELAY_MS = 600;

(async () => {
  const db = getDb();

  // Backup column for one-line rollback (idempotent)
  try {
    db.exec("ALTER TABLE meetings ADD COLUMN teams_join_url_old TEXT");
    console.log('Added teams_join_url_old backup column to meetings.\n');
  } catch (_) {
    // already exists; no-op
  }

  // Pull every approved Day-1 meeting with both sides' identity, in the shape
  // sendMeetingApproved() expects.
  //
  // Resumable: skip rows whose teams_join_url_old is already populated. A
  // populated _old column means the regen script already ran on this row
  // (COALESCE in the UPDATE means it can only be set by us). So if the
  // process is interrupted (SSH drop, kill, etc.), re-running picks up
  // where we left off without re-processing or re-emailing.
  const meetings = db.prepare(`
    SELECT
      m.id, m.day, m.start_time, m.end_time, m.status,
      m.teams_join_url, m.teams_meeting_id,
      m.requester_id, m.recipient_id,
      ru.email AS requester_email, ru.contact_name AS requester_name,
      ru.org_name AS requester_org, ru.timezone AS requester_timezone,
      ri.email AS recipient_email, ri.contact_name AS recipient_name,
      ri.org_name AS recipient_org, ri.timezone AS recipient_timezone
    FROM meetings m
    JOIN users ru ON ru.id = m.requester_id
    JOIN users ri ON ri.id = m.recipient_id
    WHERE m.day = '2026-06-02'
      AND m.status = 'approved'
      AND (m.teams_join_url_old IS NULL OR m.teams_join_url_old = '')
    ORDER BY m.start_time, m.id
  `).all();

  console.log(`Found ${meetings.length} approved Day-1 meetings to regenerate.`);
  console.log(`Throttle: ${DELAY_MS}ms between meetings. ETA: ~${Math.ceil(meetings.length * DELAY_MS / 1000)}s.\n`);

  const updateStmt = db.prepare(`
    UPDATE meetings
    SET teams_join_url_old = COALESCE(teams_join_url_old, teams_join_url),
        teams_join_url = ?,
        teams_meeting_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  let ok = 0, graphFail = 0, mailFail = 0;

  for (let i = 0; i < meetings.length; i++) {
    const m = meetings[i];
    const prefix = `[${String(i + 1).padStart(3)}/${meetings.length}]`;
    const label = `${m.start_time.substring(11, 16)}Z  ${m.requester_org} × ${m.recipient_org}`;

    // Step 1 — Graph call
    let newLink, newMeetingId;
    try {
      const out = await createMeeting({
        subject: `Engage by Elevate — ${m.requester_org} × ${m.recipient_org}`,
        startTime: m.start_time,
        endTime: m.end_time,
        attendeeEmails: [m.requester_email, m.recipient_email]
      });
      newLink = out.joinUrl;
      newMeetingId = out.meetingId;
    } catch (e) {
      console.log(`${prefix} GRAPH FAIL  ${label}`);
      console.log(`            ${e.message}`);
      graphFail++;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    // Step 2 — DB update (backup old, write new)
    updateStmt.run(newLink, newMeetingId, m.id);
    m.teams_join_url = newLink;
    m.teams_meeting_id = newMeetingId;

    // Step 3 — notify both attendees
    try {
      await emailService.sendMeetingApproved(m);
      console.log(`${prefix} OK          ${label}`);
      ok++;
    } catch (e) {
      console.log(`${prefix} MAIL FAIL   ${label}  (link updated in DB, attendees NOT notified)`);
      console.log(`            ${e.message}`);
      mailFail++;
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone.`);
  console.log(`  Regenerated + notified: ${ok}`);
  console.log(`  Graph failures (DB unchanged):     ${graphFail}`);
  console.log(`  Mail failures (DB updated, no email): ${mailFail}`);
  console.log(`\nRollback (if needed):`);
  console.log(`  sqlite3 server/db/engage.db "UPDATE meetings SET teams_join_url = teams_join_url_old WHERE day='2026-06-02' AND teams_join_url_old IS NOT NULL"`);

  process.exit((graphFail + mailFail) > 0 ? 1 : 0);
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
