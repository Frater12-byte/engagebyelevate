# Deployment — Hostinger VPS

Target server: `145.223.88.138` (engagebyelevate.com)

This guide sets up Node.js + PM2 + Nginx + Let's Encrypt SSL on a fresh Ubuntu VPS.

## 1. One-time server prep

SSH in as root (or a sudoer):

```bash
ssh root@145.223.88.138
```

### Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential git
node -v   # should print v20.x
```

`build-essential` is required because `better-sqlite3` compiles native bindings on install.

### Install PM2

```bash
npm install -g pm2
pm2 startup systemd    # follow the command it prints
```

### Install Nginx and Certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

## 2. Deploy the app

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone (once you've pushed to GitHub)
git clone https://github.com/YOUR_ORG/engage-elevate.git
cd engage-elevate

# Install dependencies
npm install --production

# Create production env
cp .env.example .env
nano .env
```

**Fill in `.env`:**

- `BASE_URL=https://engagebyelevate.com`
- `NODE_ENV=production`
- `JWT_SECRET=` (run `openssl rand -hex 32` to generate)
- SMTP settings (Hostinger gives you these with the domain's email)
- Microsoft Graph credentials (see `GRAPH_API_SETUP.md`)
- `N8N_WEBHOOK_SECRET=` (run `openssl rand -hex 32`)

**Initialize the DB and seed:**

```bash
npm run init-db
npm run seed
```

**Start with PM2:**

```bash
pm2 start server/index.js --name engage
pm2 save
```

Confirm it's running:

```bash
pm2 status
curl http://localhost:3000/health    # should return {"status":"ok"}
```

## 3. Nginx reverse proxy

Create `/etc/nginx/sites-available/engagebyelevate.com`:

```nginx
server {
    listen 80;
    server_name engagebyelevate.com www.engagebyelevate.com;

    # For Certbot validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Everything else → Node
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 10M;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/engagebyelevate.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## 4. Point DNS

In your domain registrar's DNS settings for `engagebyelevate.com`:

| Record | Name | Value |
|---|---|---|
| A | @ | 145.223.88.138 |
| A | www | 145.223.88.138 |

Wait a few minutes for propagation. Test with `dig engagebyelevate.com +short` — should return `145.223.88.138`.

## 5. SSL via Let's Encrypt

Once DNS is pointing correctly:

```bash
certbot --nginx -d engagebyelevate.com -d www.engagebyelevate.com
# Answer: redirect HTTP to HTTPS (option 2)
```

Certbot will auto-edit your Nginx config and set up renewal. Test renewal:

```bash
certbot renew --dry-run
```

## 6. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## 7. Ongoing deployments

From then on, deploys are:

```bash
ssh root@145.223.88.138
cd /var/www/engage-elevate
git pull
npm install --production
pm2 reload engage
```

Or set up a GitHub Actions workflow that SSHes in and runs those commands on push to `main`.

## 8. Backups

The entire app state is in `server/db/engage.db` (plus the `-wal` and `-shm` files while running). Back it up daily:

```bash
# /etc/cron.daily/backup-engage
#!/bin/bash
BACKUP_DIR=/var/backups/engage
mkdir -p $BACKUP_DIR
sqlite3 /var/www/engage-elevate/server/db/engage.db ".backup $BACKUP_DIR/engage-$(date +%Y%m%d).db"
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
```

```bash
chmod +x /etc/cron.daily/backup-engage
```

## 9. Useful PM2 commands

```bash
pm2 logs engage              # tail logs
pm2 logs engage --err        # errors only
pm2 restart engage           # full restart
pm2 reload engage            # zero-downtime reload
pm2 monit                    # live dashboard
pm2 describe engage          # configuration detail
```

## 10. Health checks

- `https://engagebyelevate.com/health` should return `{"status":"ok"}`
- `https://engagebyelevate.com/api/public/stats` should return registration counts
- PM2 should show the process uptime increasing
- `tail -f /var/log/nginx/access.log` during traffic

## Troubleshooting

**"EACCES: permission denied" on DB:** PM2 is running as a different user than the one that ran `init-db`. Either run PM2 as that user, or `chown` the db file.

**"Graph API 403":** Application access policy not configured. See `GRAPH_API_SETUP.md` step 7.

**"SMTP connection timeout":** Hostinger's mail server is at `smtp.hostinger.com`, port `465` (SSL). Verify in the Hostinger control panel that the email account exists and the password is correct.

**Site loads but API 404s:** You're probably serving from `/var/www/engage-elevate/public` statically via Nginx. Don't — Node has to handle routing. The Nginx config above proxies everything to Node.
