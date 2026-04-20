# Claude Code context — Engage by Elevate

This file tells Claude Code how to work effectively in this repo.

## Project overview

Matchmaking web app for a 3-day hotel × agency speed-dating event in Dubai (June 1–3, 2026). Users register, browse a directory, and book 20-minute 1:1 meetings. Hotels and agencies can both initiate; the other side must approve. Approved meetings get a unique Microsoft Teams link.

## Stack

- **Runtime:** Node.js 18+ (the VPS runs 20 LTS)
- **Backend:** Express, better-sqlite3, jsonwebtoken, nodemailer, axios
- **Frontend:** Vanilla HTML/CSS/JS — no React, no bundler, no build step
- **DB:** SQLite (file at `server/db/engage.db`) — WAL mode, foreign keys on
- **Email:** Nodemailer → SMTP (Hostinger mail server)
- **Teams:** Microsoft Graph API (app-only auth with client credentials)
- **Process manager:** PM2 on the VPS
- **Reverse proxy:** Nginx with Let's Encrypt

## Architecture in 30 seconds

1. User signs up → a row in `users`. We immediately pre-generate their 20-minute slots in the `slots` table for the days they're eligible for (UAE hotels = days 1&2, international = day 3, agents = all three).
2. Slots that overlap with agenda sessions (opening, keynotes, tourism boards, lunch) are marked `blocked` at generation time.
3. When user A requests a meeting with user B, we check both have a `free` slot at that time, flip both slots to `held`, and create a `meetings` row with status `pending`.
4. On approve: slots go `booked`, we call Microsoft Graph to create an online meeting, store `teams_join_url` on the meetings row, and email both sides.
5. On decline/cancel/expire: slots go back to `free`.
6. A cron loop in `server/index.js` expires pending meetings once the start time is within 48 hours.

## Invariants that must not break

- **One slot per user per start-time** (enforced by the UNIQUE index on `slots(user_id, start_time)`).
- **Meetings must be hotel ↔ agent** — same-type meetings are rejected in `meetings.requestMeeting`.
- **Slot status transitions** are centralized in `server/services/meetings.js`. Don't mutate slot status from anywhere else.
- **48h lock** is enforced in `isSlotLocked()`. Don't add new code paths that bypass it.
- **Magic tokens are single-use-ish** — currently reusable for the full event duration so organizers can re-click. If you change this, update the `sendMagicLink` flow to resend after each use.

## File conventions

- All backend modules use CommonJS (`require` / `module.exports`). Don't introduce ESM.
- Times stored in the DB are ISO 8601 with timezone, always. Never store bare local time.
- The event timezone is `+04:00` (Dubai). The `slots.js` generator hardcodes this — if you add international venues, parameterize per-day.
- Use `dayjs` for all date math. It's already in dependencies.
- No TypeScript. No transpilation. `node server/index.js` runs the code as-written.
- Frontend pages are independent HTML files with inline `<script>` blocks. Shared helpers are in `public/js/common.js`. Don't add bundlers.

## Database

- `server/db/init.js` is the schema. `server/db/connection.js` is the singleton accessor. All other code gets the db via `getDb()`.
- Migrations are **not** automated yet — if you change the schema, either wipe `engage.db` and re-seed (fine pre-launch) or write an `ALTER TABLE` in `init.js` guarded by a `try/catch`.
- The DB file goes in `.gitignore`. Don't commit it.

## Commands

```bash
npm run dev          # nodemon reload on change
npm start            # production mode
npm run init-db      # create the schema (safe to re-run)
npm run seed         # load agenda + tourism boards + admin user
```

## Common tasks and where they live

| I want to... | Look here |
|---|---|
| Change the agenda | `server/db/seed.js`, then `npm run seed` |
| Change how slots are generated | `server/services/slots.js` (`DAY_CONFIG`, `eligibleDaysFor`) |
| Change meeting booking rules | `server/services/meetings.js` |
| Change email content | `server/services/email.js` |
| Add a new API endpoint | Pick the right file in `server/routes/`, wire it up in `server/index.js` if it's a new route file |
| Change page layout | The relevant `public/*.html` — inline scripts are deliberate |
| Change the design system | `public/css/main.css` (CSS variables at the top) |
| Add an N8N workflow | Drop a `.json` into `n8n-workflows/` and document it in the README |

## What NOT to do

- Don't add a frontend framework or bundler. The zero-build decision is intentional for Hostinger deployability.
- Don't add a password login flow. Magic links are the auth model.
- Don't hardcode SMTP/Graph credentials. They come from `.env`.
- Don't store plain text anywhere that could be an injection target. All user input that gets rendered goes through `escapeHtml()` (frontend) or parameterized queries (backend).
- Don't skip the 48h lock check when adding new meeting-mutation endpoints.

## Deploy flow (summary)

1. Commit & push to main branch.
2. SSH to Hostinger VPS (`145.223.88.138`).
3. `cd /var/www/engage-elevate && git pull && npm install && pm2 reload engage`.
4. Nginx and SSL are already set up — see `docs/DEPLOYMENT.md`.

## When things break

- **Emails not sending:** check `email_log` table — `status` and `error` columns have the nodemailer error.
- **Teams links missing:** the meeting is still approved, just without a link. Check the app logs for the Graph API error. Usually a missing application access policy (see `docs/GRAPH_API_SETUP.md`).
- **Slots not appearing:** the user's region may not match any event day. Check `users.region` and `eligibleDaysFor()` in `slots.js`.
- **"Slot already taken":** expected race condition — refresh the availability view.
