# Engage by Elevate

Matchmaking platform for **Engage by Elevate 2026** — three days of curated 1:1 meetings between hotels and travel agencies, Dubai, June 1–3, 2026.

## What it does

- **Self-serve registration** for hotels and agencies (no admin approval needed)
- **Magic-link authentication** — no passwords, access links emailed on demand
- **Live, two-sided meeting booking** — either side can request, the other approves
- **Unique Microsoft Teams links** auto-generated per approved meeting via Graph API
- **48-hour slot lock** — pending requests auto-expire, approved meetings can't be cancelled within the window
- **Agenda-aware scheduling** — the opening keynote, tour operator sessions, tourism board sessions, and lunch are automatically blocked out across everyone's calendar
- **Public directory** of all participants with profiles
- **Email notifications** at every step: signup, request, approve, decline, cancel
- **N8N integration** for reminders and daily admin digests

## Event structure (baked into the app)

| Day | Date | Hotels | Agents | Agenda |
|---|---|---|---|---|
| 1 | Jun 1 | UAE | All | Samir opening (11:00) + 2 tour operator keynotes + Tourism Board 1 |
| 2 | Jun 2 | UAE | All | Tourism Boards 2 & 3 |
| 3 | Jun 3 | International (Thailand, Qatar, …) | All | Tourism Boards 4 & 5 |

Meeting slots are 20 minutes, 1:1, Mon–Wed 09:00–17:00 local (Dubai, UTC+4), with lunch 13:00–14:00 blocked.

## Tech stack

- **Node.js 18+** with Express
- **SQLite** via `better-sqlite3` (zero-config, file-based — easy to back up, migrate to MySQL later if needed)
- **Vanilla HTML/CSS/JS frontend** — no build step, no framework tax, loads instantly
- **Nodemailer** over SMTP for email
- **Microsoft Graph API** for Teams meeting link generation
- **N8N** (optional, separate) for scheduled automations

## Repo layout

```
engage-elevate/
├── server/
│   ├── index.js                 # Express app entry
│   ├── db/
│   │   ├── init.js              # Schema definition
│   │   ├── connection.js        # Singleton DB accessor
│   │   └── seed.js              # Seeds agenda + tourism boards + admin
│   ├── middleware/
│   │   └── auth.js              # JWT session check
│   ├── routes/
│   │   ├── auth.js              # /auth/signup, /auth/magic, /auth/verify
│   │   ├── meetings.js          # /api/me/*, /api/meetings/*
│   │   ├── public.js            # /api/public/* (unauthed directory)
│   │   └── n8n.js               # /api/n8n/* (webhook-secret protected)
│   └── services/
│       ├── slots.js             # 20-min slot generator
│       ├── meetings.js          # Two-sided booking logic + 48h lock
│       ├── teams.js             # MS Graph client for Teams links
│       └── email.js             # Nodemailer + branded templates
├── public/                      # Static frontend
│   ├── index.html               # Landing page
│   ├── signup.html              # Hotel/agent registration
│   ├── login.html               # Magic link request
│   ├── dashboard.html           # Authenticated: schedule + meetings + profile
│   ├── directory.html           # Public participant browser
│   ├── agenda.html              # Public event schedule
│   ├── profile.html             # Single org public profile
│   ├── css/main.css             # Editorial design system
│   └── js/common.js             # Shared frontend helpers
├── n8n-workflows/               # JSON workflows ready to import
│   ├── 01-meeting-reminder-24h.json
│   └── 02-daily-admin-digest.json
├── docs/
│   ├── DEPLOYMENT.md            # Hostinger VPS setup (PM2, Nginx, SSL)
│   ├── GRAPH_API_SETUP.md       # Microsoft Teams integration setup
│   └── CLAUDE.md                # Working with Claude Code on this repo
├── package.json
├── .env.example
└── README.md
```

## Quick start (local dev)

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/engage-elevate.git
cd engage-elevate

# 2. Install deps
npm install

# 3. Configure
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET; SMTP can be dummy for local dev

# 4. Initialize database and seed the agenda
npm run init-db
npm run seed

# 5. Run
npm run dev
# Open http://localhost:3000
```

## Deploying to Hostinger VPS

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full walkthrough: PM2, Nginx reverse proxy on `145.223.88.138`, Let's Encrypt SSL for `engagebyelevate.com`, and pointing the DNS.

## Microsoft Teams setup

Teams links are generated per meeting via the Graph API. This needs a one-time Azure AD app registration — see [`docs/GRAPH_API_SETUP.md`](docs/GRAPH_API_SETUP.md).

Without Graph credentials, the app still works — meetings just get approved without a Teams link, which the organizer can paste in manually.

## Working with Claude Code

See [`docs/CLAUDE.md`](docs/CLAUDE.md) for context and conventions. Short version: it's a vanilla Node.js/Express app with no transpilation, so you can read any file and it runs as-is.

## License

Private — Engage by Elevate 2026.
