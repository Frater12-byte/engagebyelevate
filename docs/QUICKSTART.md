# Quick start — pushing this to GitHub & using Claude Code

Your repo: **https://github.com/Frater12-byte/engagebyelevate**

## 1. Push this code to your repo

Download the zip from this conversation, then:

```bash
# Extract the zip
unzip engage-elevate.zip
cd engage-elevate

# Initialize git and connect to your repo
git init
git branch -M main
git remote add origin https://github.com/Frater12-byte/engagebyelevate.git

# Stage everything (the .gitignore already excludes secrets and node_modules)
git add .
git commit -m "Initial commit: matchmaking platform with booking engine, Teams integration, and N8N webhooks"

# Push
git push -u origin main --force
```

The `--force` is only because your repo may already have a README from GitHub's "Initialize this repository" checkbox. Once done, don't use `--force` again.

## 2. Clone it locally to work with Claude Code

On whichever machine you want to develop on (your laptop, preferably):

```bash
git clone https://github.com/Frater12-byte/engagebyelevate.git
cd engagebyelevate

# Install Claude Code if you haven't
npm install -g @anthropic-ai/claude-code

# Open Claude Code in this directory
claude
```

Claude Code will automatically read `docs/CLAUDE.md` and have full context on the architecture, invariants, and conventions. You can start giving it instructions like:

- *"Add a CSV export of all meetings to the admin API"*
- *"Change the meeting duration from 20 to 30 minutes"*
- *"Add an 'I'm no longer attending' button on the dashboard"*
- *"The design feels too serif-heavy — propose a sans-serif alternative"*
- *"Write a migration to add a 'notes' column to meetings"*

## 3. First local run

Before going to Hostinger, run it locally to make sure everything works:

```bash
# Install deps (this compiles better-sqlite3 natively)
npm install

# Copy env template — for local dev you only need JWT_SECRET
cp .env.example .env

# Edit .env: set JWT_SECRET to anything long, e.g.
# JWT_SECRET=local-dev-secret-do-not-use-in-production-12345678

# Initialize the database
npm run init-db
npm run seed

# Run
npm run dev
```

Open http://localhost:3000. You should see the landing page. Click **Register**, create a fake hotel, and the system will show you a magic link in the server console (since SMTP isn't configured for local dev — we'll fix that for production).

## 4. Deploy to Hostinger

See `docs/DEPLOYMENT.md` for the full walkthrough. Quick version:

```bash
ssh root@145.223.88.138
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential git nginx certbot python3-certbot-nginx
npm install -g pm2

cd /var/www
git clone https://github.com/Frater12-byte/engagebyelevate.git
cd engagebyelevate
npm install --production

cp .env.example .env
nano .env   # fill in real values

npm run init-db && npm run seed
pm2 start server/index.js --name engage
pm2 save
pm2 startup systemd    # follow the command it prints
```

Then set up Nginx + SSL as in `docs/DEPLOYMENT.md` step 3–5.

## 5. Point the domain

In your DNS provider for `engagebyelevate.com`:
- `A` record, `@` → `145.223.88.138`
- `A` record, `www` → `145.223.88.138`

Wait 5 minutes, then run certbot as described.

## 6. What to work on first

Based on priority for the June 1 event:

1. **Deploy and verify the basic flow end-to-end** (register → get magic link → book meeting → approve → join). Do this with two test accounts before touching anything else.
2. **Set up Microsoft Graph** (`docs/GRAPH_API_SETUP.md`). Without this, Teams links are missing, which is fixable but annoying.
3. **Update the seed agenda** with real speaker names, real tour operator names, and real tourism board details. Edit `server/db/seed.js`, then `npm run seed` on the VPS (safely re-runnable).
4. **Invite the 80 agents and 100+ hotels** — just point them at `engagebyelevate.com/signup.html`.
5. **Import the N8N workflows** if you're running N8N — see `n8n-workflows/*.json`.

## Using Claude Code effectively

- **Give it context:** Claude Code reads `docs/CLAUDE.md` automatically, so it knows the invariants. But for specific tasks, drop relevant file paths in your prompt.
- **Review before committing:** Claude Code edits files directly. Run `git diff` before `git add`.
- **Test changes locally** before pushing to the VPS. The `npm run dev` hot-reload makes this fast.
- **Don't let it add a framework.** The zero-build choice is intentional for Hostinger deployability. If Claude suggests React or a bundler, push back.
- **Database changes need care.** If Claude changes `server/db/init.js`, wipe your local `engage.db` and re-seed — production needs the same treatment or a migration.
