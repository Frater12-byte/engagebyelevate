#!/usr/bin/env node
/**
 * regenerate-day1-session-teams-links.js
 *
 * Re-creates the Microsoft Teams meeting for every Day-1 (2026-06-02)
 * public session via Graph API, and updates sessions.teams_link with the
 * new joinUrl. Old joinUrls are kept in a backup column (teams_link_old)
 * for one-step rollback if needed.
 *
 * Why this is safe to run on event day:
 *   - sessions.teams_link is read live by /api/me/agenda + online site's
 *     meetings.json (via deploy, but we'll update both). No attendee has
 *     a static calendar invite for these — the "Save invite" CTA generates
 *     a Gcal/Outlook URL from the live teams_link at click time. So
 *     reloading the dashboard picks up the new URL automatically.
 *   - We do NOT touch the 1:1 meetings table here. That's Pass 2.
 *
 * Usage:
 *   cd /home/engagebyelevate/htdocs/engagebyelevate.com
 *   node scripts/regenerate-day1-session-teams-links.js
 */
require('dotenv').config();

const { getDb } = require('../server/db/connection');
const { createMeeting } = require('../server/services/teams');

(async () => {
  const db = getDb();

  // Add backup column if it doesn't exist yet (idempotent)
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN teams_link_old TEXT");
    console.log('Added teams_link_old backup column.');
  } catch (_) {
    // already exists; no-op
  }

  const sessions = db.prepare(`
    SELECT id, title, day, start_time, end_time, teams_link
    FROM sessions
    WHERE day = '2026-06-02'
      AND visible = 1
      AND type IN ('opening', 'keynote', 'tourism_board')
    ORDER BY start_time
  `).all();

  console.log(`Found ${sessions.length} Day-1 public sessions to regenerate.\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const prefix = `[${i + 1}/${sessions.length}]`;
    const label = `${s.start_time.substring(11, 16)}Z ${s.title.substring(0, 60)}`;

    try {
      const { joinUrl, meetingId } = await createMeeting({
        subject: s.title,
        startTime: s.start_time,
        endTime: s.end_time,
        attendeeEmails: []
      });

      // Save old link to backup, write new link
      db.prepare(`
        UPDATE sessions
        SET teams_link_old = COALESCE(teams_link_old, teams_link),
            teams_link = ?
        WHERE id = ?
      `).run(joinUrl, s.id);

      console.log(`${prefix} OK    ${label}`);
      console.log(`         new meetingId: ${meetingId}`);
      ok++;
    } catch (e) {
      console.log(`${prefix} FAIL  ${label}`);
      console.log(`         error: ${e.message}`);
      fail++;
    }

    // Throttle to stay well under Graph throttling limits (~30/sec for most tenants)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone. Regenerated: ${ok}  Failed: ${fail}`);
  console.log(`\nVerify with:`);
  console.log(`  sqlite3 server/db/engage.db "SELECT start_time, substr(title,1,40), substr(teams_link,1,80) FROM sessions WHERE day='2026-06-02' AND visible=1 AND type IN ('opening','keynote','tourism_board') ORDER BY start_time"`);
  console.log(`\nRollback (if needed):`);
  console.log(`  sqlite3 server/db/engage.db "UPDATE sessions SET teams_link = teams_link_old WHERE day='2026-06-02' AND teams_link_old IS NOT NULL"`);

  process.exit(fail > 0 ? 1 : 0);
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
