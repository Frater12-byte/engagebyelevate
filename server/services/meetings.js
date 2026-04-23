/**
 * Meetings service.
 *
 * Core rules:
 *  1. A meeting is a 1:1 between a hotel and an agent.
 *  2. Either side can initiate (requester) -> other side approves (recipient).
 *  3. When requested, BOTH slots flip to 'held' so nobody else can grab them.
 *  4. If declined or cancelled, slots flip back to 'free'.
 *  5. If approved, slots flip to 'booked', a Teams link is generated,
 *     and both parties get an email with the link.
 *  6. Slots lock 48h before start. Within the lock window:
 *       - no new requests accepted for that slot
 *       - pending requests auto-expire (cron)
 *       - approved meetings cannot be cancelled (enforced here)
 */

const dayjs = require('dayjs');
const { getDb } = require('../db/connection');
const teams = require('./teams');
const email = require('./email');
const { nowUtc } = require('../utils/time');

const LOCK_HOURS = parseInt(process.env.SLOT_LOCK_HOURS || '48', 10);

/** Is this slot within the lock window (< LOCK_HOURS from now)? */
function isSlotLocked(slotStart) {
  const hoursUntil = dayjs(slotStart).diff(dayjs(), 'hour', true);
  return hoursUntil < LOCK_HOURS;
}

/**
 * Find a user's slot at a specific start time. Returns null if not found.
 */
function findSlot(userId, startTime) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM slots WHERE user_id = ? AND start_time = ?'
  ).get(userId, startTime);
}

/**
 * Request a meeting.
 *
 * @param {number} requesterId - user initiating
 * @param {number} recipientId - user being invited
 * @param {string} startTime   - ISO datetime of the desired slot
 * @param {string} message     - optional note
 */
function requestMeeting(requesterId, recipientId, startTime, message) {
  const db = getDb();

  // Validate users exist
  const requester = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(requesterId);
  const recipient = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(recipientId);

  if (!requester || !recipient) {
    throw new Error('Invalid users');
  }
  if (requesterId === recipientId) {
    throw new Error('You cannot book a meeting with yourself');
  }

  // Lock window check
  if (isSlotLocked(startTime)) {
    throw new Error(`Slots within ${LOCK_HOURS}h of start time are locked. Please pick a later slot.`);
  }

  // Both must have a slot at that time, and both must be 'free'
  const rSlot = findSlot(requesterId, startTime);
  const eSlot = findSlot(recipientId, startTime);

  if (!rSlot) throw new Error('You have no slot at that time (you may not be scheduled for that day)');
  if (!eSlot) throw new Error('The other party has no slot at that time');
  if (rSlot.status !== 'free') throw new Error('Your slot is not available');
  if (eSlot.status !== 'free') throw new Error('Their slot is not available');

  // Prevent duplicate pending request between same pair at same slot
  const dup = db.prepare(`
    SELECT id FROM meetings
    WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
      AND start_time = ?
      AND status IN ('pending','approved')
  `).get(requesterId, recipientId, recipientId, requesterId, startTime);
  if (dup) throw new Error('A meeting already exists between you two at that time');

  const tx = db.transaction(() => {
    const now = nowUtc();
    const insert = db.prepare(`
      INSERT INTO meetings
        (requester_id, recipient_id, requester_slot_id, recipient_slot_id,
         day, start_time, end_time, status, message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
    const info = insert.run(
      requesterId, recipientId, rSlot.id, eSlot.id,
      rSlot.day, rSlot.start_time, rSlot.end_time, message || null, now, now
    );
    const meetingId = info.lastInsertRowid;

    // Flip both slots to 'held' so nobody else grabs them
    const updSlot = db.prepare(
      "UPDATE slots SET status = 'held', meeting_id = ?, updated_at = ? WHERE id = ?"
    );
    updSlot.run(meetingId, now, rSlot.id);
    updSlot.run(meetingId, now, eSlot.id);

    return meetingId;
  });

  const meetingId = tx();
  const meeting = getMeeting(meetingId);

  // Fire email to recipient (async, non-blocking)
  email.sendMeetingRequest(meeting, requester, recipient).catch(console.error);

  return meeting;
}

/**
 * Approve a pending meeting. Generates Teams link.
 * @param {number} meetingId
 * @param {number} actingUserId - must be the recipient
 */
async function approveMeeting(meetingId, actingUserId) {
  const db = getDb();
  const meeting = getMeeting(meetingId);
  if (!meeting) throw new Error('Meeting not found');
  if (meeting.status !== 'pending') throw new Error('Meeting is not pending');
  if (meeting.recipient_id !== actingUserId) throw new Error('Only the recipient can approve');
  if (isSlotLocked(meeting.start_time)) {
    throw new Error('This slot is now locked (within 48h of start).');
  }

  // Generate Teams meeting link — required, not optional
  const meetingEndTime = dayjs(meeting.start_time).add(20, 'minute').toISOString();
  const teamsSubject = `Engage by Elevate \u2014 ${meeting.requester_org} \u00d7 ${meeting.recipient_org}`;

  console.log(`[APPROVE] Meeting ${meetingId}: creating Teams link...`);
  const teamsInfo = await teams.createMeeting({
    subject: teamsSubject,
    startTime: meeting.start_time,
    endTime: meetingEndTime,
    attendeeEmails: [meeting.requester_email, meeting.recipient_email]
  });
  console.log(`[APPROVE] Meeting ${meetingId}: Teams link created: ${teamsInfo.joinUrl}`);

  const approveNow = nowUtc();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE meetings
      SET status = 'approved',
          teams_join_url = ?,
          teams_meeting_id = ?,
          responded_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(teamsInfo.joinUrl, teamsInfo.meetingId, approveNow, approveNow, meetingId);

    db.prepare(
      "UPDATE slots SET status = 'booked', updated_at = ? WHERE id IN (?, ?)"
    ).run(approveNow, meeting.requester_slot_id, meeting.recipient_slot_id);
  });
  tx();

  const updated = getMeeting(meetingId);
  console.log(`[APPROVE] Meeting ${meetingId}: approved, teams_join_url=${updated.teams_join_url}`);
  email.sendMeetingApproved(updated).catch(console.error);
  return updated;
}

/**
 * Decline a pending meeting.
 */
function declineMeeting(meetingId, actingUserId, reason) {
  const db = getDb();
  const meeting = getMeeting(meetingId);
  if (!meeting) throw new Error('Meeting not found');
  if (meeting.status !== 'pending') throw new Error('Meeting is not pending');
  if (meeting.recipient_id !== actingUserId) throw new Error('Only the recipient can decline');

  const declineNow = nowUtc();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE meetings
      SET status = 'declined',
          decline_reason = ?,
          responded_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(reason || null, declineNow, declineNow, meetingId);

    db.prepare(`
      UPDATE slots SET status = 'free', meeting_id = NULL, updated_at = ?
      WHERE id IN (?, ?)
    `).run(declineNow, meeting.requester_slot_id, meeting.recipient_slot_id);
  });
  tx();

  const updated = getMeeting(meetingId);
  email.sendMeetingDeclined(updated).catch(console.error);
  return updated;
}

/**
 * Cancel an approved (or pending) meeting.
 * Either party can cancel, but not within the 48h lock window.
 */
function cancelMeeting(meetingId, actingUserId) {
  const db = getDb();
  const meeting = getMeeting(meetingId);
  if (!meeting) throw new Error('Meeting not found');
  if (!['pending', 'approved'].includes(meeting.status)) {
    throw new Error('Meeting cannot be cancelled');
  }
  if (meeting.requester_id !== actingUserId && meeting.recipient_id !== actingUserId) {
    throw new Error('Not authorized');
  }
  if (meeting.status === 'approved' && isSlotLocked(meeting.start_time)) {
    throw new Error('Cannot cancel within 48h of start');
  }

  const cancelNow = nowUtc();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE meetings SET status = 'cancelled', updated_at = ? WHERE id = ?
    `).run(cancelNow, meetingId);

    db.prepare(`
      UPDATE slots SET status = 'free', meeting_id = NULL, updated_at = ?
      WHERE id IN (?, ?)
    `).run(cancelNow, meeting.requester_slot_id, meeting.recipient_slot_id);
  });
  tx();

  // Teams meeting cleanup (best-effort)
  if (meeting.teams_meeting_id) {
    teams.deleteMeeting(meeting.teams_meeting_id).catch(() => {});
  }

  const updated = getMeeting(meetingId);
  email.sendMeetingCancelled(updated, actingUserId).catch(console.error);
  return updated;
}

/**
 * Get a meeting with both users' info joined in.
 */
function getMeeting(id) {
  const db = getDb();
  return db.prepare(`
    SELECT m.*,
      ru.org_name AS requester_org, ru.contact_name AS requester_name,
      ru.email AS requester_email, ru.type AS requester_type,
      eu.org_name AS recipient_org, eu.contact_name AS recipient_name,
      eu.email AS recipient_email, eu.type AS recipient_type
    FROM meetings m
    JOIN users ru ON m.requester_id = ru.id
    JOIN users eu ON m.recipient_id = eu.id
    WHERE m.id = ?
  `).get(id);
}

/**
 * Return all meetings for a user (incoming + outgoing).
 */
function listMeetingsForUser(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT m.*,
      ru.org_name AS requester_org, ru.contact_name AS requester_name,
      ru.logo_url AS requester_logo, ru.type AS requester_type,
      ru.timezone AS requester_timezone, ru.attendance_mode AS requester_attendance_mode,
      eu.org_name AS recipient_org, eu.contact_name AS recipient_name,
      eu.logo_url AS recipient_logo, eu.type AS recipient_type,
      eu.timezone AS recipient_timezone, eu.attendance_mode AS recipient_attendance_mode
    FROM meetings m
    JOIN users ru ON m.requester_id = ru.id
    JOIN users eu ON m.recipient_id = eu.id
    WHERE m.requester_id = ? OR m.recipient_id = ?
    ORDER BY m.start_time ASC
  `).all(userId, userId);
}

/**
 * Expire pending meetings whose slot is now within the lock window.
 * Run this via cron / setInterval.
 */
function expireStalePending() {
  const db = getDb();
  const threshold = dayjs().add(LOCK_HOURS, 'hour').toISOString();
  const pending = db.prepare(`
    SELECT * FROM meetings WHERE status = 'pending' AND start_time <= ?
  `).all(threshold);

  let expired = 0;
  const expireNow = nowUtc();
  const tx = db.transaction(() => {
    for (const m of pending) {
      db.prepare("UPDATE meetings SET status = 'expired', updated_at = ? WHERE id = ?").run(expireNow, m.id);
      db.prepare("UPDATE slots SET status = 'free', meeting_id = NULL, updated_at = ? WHERE id IN (?, ?)")
        .run(expireNow, m.requester_slot_id, m.recipient_slot_id);
      expired++;
    }
  });
  tx();
  return expired;
}

module.exports = {
  requestMeeting,
  approveMeeting,
  declineMeeting,
  cancelMeeting,
  getMeeting,
  listMeetingsForUser,
  expireStalePending,
  isSlotLocked
};
