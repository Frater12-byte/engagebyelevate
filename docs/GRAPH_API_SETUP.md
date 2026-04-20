# Microsoft Graph API Setup — Teams meeting links

The app generates a unique Microsoft Teams meeting link for every approved meeting by calling the Microsoft Graph API `/onlineMeetings` endpoint. This requires a one-time setup in Azure Entra (formerly Azure AD).

**Time estimate:** 15 minutes, plus waiting for admin consent if you're not the tenant admin.

**Cost:** Free — uses the free tier of Microsoft Graph. The organizer account needs a Teams license (e.g. Microsoft 365 Business Basic, ~$6/user/month), but it's one account, not one per user.

## What we're setting up

- An **Azure app registration** that the server can authenticate as
- A **client secret** (password) for that app
- **Application permission** `OnlineMeetings.ReadWrite.All` granted to that app
- An **application access policy** that scopes the app to create meetings on behalf of one specific user (the "organizer")

The last step is required by Microsoft — even with the permission granted, Graph will reject `onlineMeetings` POSTs unless the app is explicitly authorized for the target user.

## Prerequisites

- A Microsoft 365 tenant (work/school account, not personal)
- An organizer mailbox with a Teams license — e.g. `meetings@yourdomain.com`
- Admin rights, or a tenant admin who can grant consent
- PowerShell 7+ on your machine (for the last policy step)

## Step-by-step

### 1. Create the app registration

1. Go to https://entra.microsoft.com
2. **Identity → Applications → App registrations → New registration**
3. Name: `Engage by Elevate`
4. Supported account types: **Accounts in this organizational directory only (Single tenant)**
5. Redirect URI: leave blank
6. Click **Register**

You'll land on the app's Overview page. Copy these three values into your `.env`:

- **Application (client) ID** → `MS_CLIENT_ID`
- **Directory (tenant) ID** → `MS_TENANT_ID`

### 2. Create a client secret

1. In the app, go to **Certificates & secrets → Client secrets → New client secret**
2. Description: `Engage production secret`
3. Expires: `24 months` (set a calendar reminder to rotate)
4. Click **Add**
5. **Copy the `Value` column immediately** — it's only shown once. This is your `MS_CLIENT_SECRET`.

### 3. Grant the API permission

1. In the app, go to **API permissions → Add a permission**
2. Select **Microsoft Graph**
3. Select **Application permissions** (not Delegated)
4. Search for `OnlineMeetings.ReadWrite.All`
5. Tick it and click **Add permissions**
6. Back on the permissions list, click **Grant admin consent for [your tenant]**
7. The row's status should flip to a green checkmark

If you're not an admin, send the link to one — they need to click the consent button.

### 4. Pick the organizer account

Decide which user Graph should create meetings as. This is the person who'll show up as the meeting organizer in Teams. Two options:

**Option A:** Use an existing user mailbox (e.g. `events@yourdomain.com`). Make sure they have a Teams license.

**Option B:** Create a dedicated service account (recommended for production):
- Go to https://admin.microsoft.com → Users → Active users → Add user
- Name: `Engage Events`, username: `engage@yourdomain.com`
- Assign **Microsoft 365 Business Basic** (or equivalent with Teams)

Copy this user's **User Principal Name** (the full email) into `.env`:

```
MS_ORGANIZER_USER_ID=engage@yourdomain.com
```

### 5. Apply the application access policy

This is the step everyone forgets. Microsoft requires that for app-only Teams calls, you explicitly scope the app to specific users.

Open PowerShell 7 and run:

```powershell
# Install the Teams module if you don't have it
Install-Module -Name MicrosoftTeams -Force -AllowClobber

# Connect as a tenant admin
Connect-MicrosoftTeams

# Create a policy that whitelists our app
New-CsApplicationAccessPolicy `
    -Identity "Engage-MeetingPolicy" `
    -AppIds "<YOUR_MS_CLIENT_ID>" `
    -Description "Engage by Elevate meeting creation"

# Grant the policy to the organizer user
Grant-CsApplicationAccessPolicy `
    -PolicyName "Engage-MeetingPolicy" `
    -Identity "engage@yourdomain.com"
```

Replace `<YOUR_MS_CLIENT_ID>` with the Application (client) ID from step 1, and the email with your organizer user.

**Propagation:** the grant takes up to 30 minutes to take effect across Microsoft's infrastructure. If step 6 fails with a 403, wait 30 min and retry.

### 6. Test

SSH to the server (or run locally), and test from the Node REPL:

```bash
cd /var/www/engage-elevate
node
```

```javascript
require('dotenv').config();
const teams = require('./server/services/teams');

teams.createMeeting({
  subject: 'Test',
  startTime: new Date(Date.now() + 3600000).toISOString(),
  endTime: new Date(Date.now() + 5400000).toISOString(),
  attendeeEmails: ['you@example.com']
}).then(r => console.log('SUCCESS', r)).catch(e => console.error('FAILED', e.response?.data || e.message));
```

Expected output:

```
SUCCESS { joinUrl: 'https://teams.microsoft.com/l/meetup-join/...', meetingId: '...' }
```

If it fails:

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong client secret or tenant ID | Re-check `.env` values |
| `403 Forbidden` with `Application is not allowed...` | Access policy not applied or still propagating | Re-run step 5; wait 30 min |
| `403 Forbidden` with `OnlineMeetings.ReadWrite.All` | Admin consent not granted | Back to step 3, click the consent button |
| `404` on the user endpoint | Wrong `MS_ORGANIZER_USER_ID` | Use the full UPN, not just the username |

### 7. Rotate the secret before it expires

Azure will email the app owners 30 days before expiry. To rotate:

1. Create a new secret (step 2 above)
2. Put it in a new `.env` variable on the server
3. Restart PM2 (`pm2 reload engage`)
4. Confirm the app still creates meetings
5. Delete the old secret in Azure

## What if I can't set this up in time?

The app is designed to degrade gracefully. If the Graph API call fails, the meeting is **still approved** — the `teams_join_url` column just stays null. The dashboard will show a "Link pending" badge instead of a join button, and the organizer can paste a link manually (e.g. a static Teams room link).

To fully disable Teams integration (if you won't use it at all), just leave the `MS_*` variables blank in `.env`. The server logs will say `Teams link generation failed: Microsoft Graph credentials not configured` — non-fatal.

## Security notes

- The client secret is as sensitive as a password. Don't commit it, don't paste it in Slack, rotate it if leaked.
- The application access policy only lets this app create meetings *as the organizer user*. Even if the secret leaks, an attacker can't read mailboxes, create users, or access Graph resources beyond online meetings for that one account.
- Consider using a **certificate** instead of a client secret for extra security. See Microsoft's docs on certificate auth for Graph app-only access.
