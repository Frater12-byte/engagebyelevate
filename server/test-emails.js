/**
 * One-off script to send all 5 email templates to a test address.
 * Usage: node server/test-emails.js
 */
require('dotenv').config();
const email = require('./services/email');

const TO = 'francesco.terragni@elevatedmc.com';

async function run() {
  console.log(`Sending all 5 test emails to ${TO}...\n`);

  // 1. Magic link
  console.log('1/5 Magic link...');
  await email.sendMagicLink(
    { id: 999, email: TO, contact_name: 'Francesco' },
    'test-token-abc123-not-real'
  );
  console.log('    Sent.\n');

  // 2. Meeting request
  console.log('2/5 Meeting request...');
  await email.sendMeetingRequest(
    { id: 1, start_time: '2026-06-02T10:00:00+04:00', message: 'Looking forward to discussing partnership opportunities for the upcoming season.' },
    { id: 100, org_name: 'Atlantis The Royal', contact_name: 'Sarah Mitchell' },
    { id: 999, email: TO, contact_name: 'Francesco' }
  );
  console.log('    Sent.\n');

  // 3. Meeting approved
  console.log('3/5 Meeting approved...');
  await email.sendMeetingApproved({
    id: 1,
    start_time: '2026-06-02T10:00:00+04:00',
    requester_id: 100,
    requester_email: TO,
    requester_name: 'Francesco',
    requester_org: 'Elevate DMC',
    recipient_id: 200,
    recipient_email: TO,
    recipient_name: 'Sarah Mitchell',
    recipient_org: 'Atlantis The Royal',
    teams_join_url: 'https://teams.microsoft.com/l/meetup-join/test-link'
  });
  console.log('    Sent (2 emails: requester + recipient).\n');

  // 4. Meeting declined
  console.log('4/5 Meeting declined...');
  await email.sendMeetingDeclined({
    id: 2,
    start_time: '2026-06-03T14:00:00+04:00',
    requester_id: 999,
    requester_email: TO,
    requester_name: 'Francesco',
    requester_org: 'Elevate DMC',
    recipient_org: 'Jumeirah Group',
    decline_reason: 'Unfortunately we are fully booked at that time. Please try another slot.'
  });
  console.log('    Sent.\n');

  // 5. Meeting cancelled
  console.log('5/5 Meeting cancelled...');
  await email.sendMeetingCancelled(
    {
      id: 3,
      start_time: '2026-06-04T11:00:00+04:00',
      requester_id: 300,
      requester_email: 'other@test.com',
      requester_name: 'Mark Johnson',
      requester_org: 'TUI Group',
      recipient_id: 999,
      recipient_email: TO,
      recipient_name: 'Francesco',
      recipient_org: 'Elevate DMC'
    },
    300 // cancelled by requester, so recipient (Francesco) gets the email
  );
  console.log('    Sent.\n');

  console.log('All 5 templates sent. Check your inbox at ' + TO);
}

run().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
