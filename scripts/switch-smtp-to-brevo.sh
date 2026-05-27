#!/usr/bin/env bash
# Switch the main app's .env from GoDaddy SMTP to Brevo SMTP.
#
# Usage: SMTP_KEY='xsmtpsib-...' bash scripts/switch-smtp-to-brevo.sh
#
# The SMTP key is intentionally NOT in this file — pass it via env var
# so it never lands in git history.
set -euo pipefail

if [ -z "${SMTP_KEY:-}" ]; then
  echo "ERROR: SMTP_KEY env var not set." >&2
  echo "Usage:  SMTP_KEY='xsmtpsib-...' bash scripts/switch-smtp-to-brevo.sh" >&2
  exit 1
fi

ENV_FILE=/home/engagebyelevate/htdocs/engagebyelevate.com/.env

cd /home/engagebyelevate/htdocs/engagebyelevate.com
cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"

sed -i 's|^SMTP_HOST=.*|SMTP_HOST=smtp-relay.brevo.com|' "$ENV_FILE"
sed -i 's|^SMTP_PORT=.*|SMTP_PORT=587|' "$ENV_FILE"
sed -i 's|^SMTP_SECURE=.*|SMTP_SECURE=false|' "$ENV_FILE"
sed -i 's|^SMTP_USER=.*|SMTP_USER=a8c192001@smtp-brevo.com|' "$ENV_FILE"
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=${SMTP_KEY}|" "$ENV_FILE"
sed -i 's|^SMTP_FROM=.*|SMTP_FROM="Elevate World <hello@news.elevatedmc.com>"|' "$ENV_FILE"

echo "=== Updated SMTP config ==="
grep '^SMTP_' "$ENV_FILE" | sed -E 's/(PASS|KEY|SECRET)=.*/\1=***REDACTED***/'

echo ""
echo "=== Restarting engage ==="
pm2 restart engage --update-env
