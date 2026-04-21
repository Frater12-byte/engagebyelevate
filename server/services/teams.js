/**
 * Microsoft Teams integration via Microsoft Graph API.
 *
 * We create online meetings using app-only auth (client credentials).
 * The organizer is a fixed user in your tenant (MS_ORGANIZER_USER_ID).
 *
 * Setup (one time):
 *   1. Go to https://entra.microsoft.com -> App registrations -> New registration
 *   2. Copy Tenant ID, Client ID
 *   3. Create a client secret - copy it (shown once)
 *   4. API permissions -> Add -> Microsoft Graph -> Application permissions:
 *         - OnlineMeetings.ReadWrite.All
 *   5. Grant admin consent
 *   6. Run the "Application Access Policy" PowerShell to scope the app
 *      to the organizer account (required by Microsoft):
 *
 *        Connect-MicrosoftTeams
 *        New-CsApplicationAccessPolicy -Identity Engage-MeetingPolicy `
 *            -AppIds "<CLIENT_ID>" -Description "Engage by Elevate"
 *        Grant-CsApplicationAccessPolicy -PolicyName Engage-MeetingPolicy `
 *            -Identity "<ORGANIZER_UPN>"
 *
 *   7. Fill in MS_* values in .env
 */

const axios = require('axios');

const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_ORGANIZER_USER_ID
} = process.env;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error('Microsoft Graph credentials not configured (check MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET in .env)');
  }
  if (MS_TENANT_ID === 'your_tenant_id' || MS_CLIENT_SECRET === 'your_client_secret') {
    throw new Error('Microsoft Graph credentials are still placeholder values — update .env with real credentials');
  }

  console.log(`[TEAMS] Requesting token for tenant=${MS_TENANT_ID.slice(0,8)}... client=${MS_CLIENT_ID.slice(0,8)}... organizer=${MS_ORGANIZER_USER_ID}`);
  const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default'
  });
  try {
    const res = await axios.post(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    cachedToken = res.data.access_token;
    tokenExpiresAt = Date.now() + (res.data.expires_in * 1000);
    console.log('[TEAMS] Token obtained successfully');
    return cachedToken;
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[TEAMS AUTH FAIL] ${detail}`);
    throw new Error('Teams auth failed: ' + (err.response?.data?.error_description || err.message));
  }
}

/**
 * Create an online meeting.
 * @param {Object} opts
 * @param {string} opts.subject
 * @param {string} opts.startTime - ISO
 * @param {string} opts.endTime - ISO
 * @param {string[]} opts.attendeeEmails
 * @returns {{ joinUrl: string, meetingId: string }}
 */
async function createMeeting({ subject, startTime, endTime, attendeeEmails }) {
  if (!MS_ORGANIZER_USER_ID) {
    throw new Error('MS_ORGANIZER_USER_ID not configured');
  }
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_ORGANIZER_USER_ID)}/onlineMeetings`;
  const body = {
    startDateTime: startTime,
    endDateTime: endTime,
    subject: subject || 'Engage by Elevate Meeting',
    lobbyBypassSettings: {
      scope: 'everyone',
      isDialInBypassEnabled: true
    }
  };
  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return {
    joinUrl: res.data.joinWebUrl,
    meetingId: res.data.id
  };
}

async function deleteMeeting(meetingId) {
  try {
    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_ORGANIZER_USER_ID)}/onlineMeetings/${meetingId}`;
    await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    // best effort
    console.error('Failed to delete Teams meeting:', err.message);
  }
}

module.exports = { createMeeting, deleteMeeting };
