#!/usr/bin/env bash
# Test SMTP credentials against whatever's currently in .env, using swaks.
# Usage:  bash scripts/test-smtp.sh [recipient@example.com]
# Default recipient: francesco.terragni@elevatedmc.com
set -euo pipefail

cd /home/engagebyelevate/htdocs/engagebyelevate.com
set -a; . ./.env; set +a

TO="${1:-francesco.terragni@elevatedmc.com}"

echo "Testing SMTP auth against $SMTP_HOST:$SMTP_PORT"
echo "  user: $SMTP_USER"
echo "  to:   $TO"
echo ""

swaks \
  --auth-user "$SMTP_USER" \
  --auth-password "$SMTP_PASS" \
  --server "$SMTP_HOST:$SMTP_PORT" \
  --tls \
  --from "$SMTP_USER" \
  --to "$TO" \
  --quit-after AUTH 2>&1 | tail -20
