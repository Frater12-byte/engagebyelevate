#!/usr/bin/env bash
# Test SMTP credentials against whatever's currently in .env, using swaks.
# Usage:  bash scripts/test-smtp.sh [recipient@example.com]
# Default recipient: francesco.terragni@elevatedmc.com
#
# Parses SMTP_* values from .env via grep instead of sourcing it directly,
# because the .env contains a bcrypt hash ($2b$10$...) that breaks
# `. ./.env` under set -u.
set -eo pipefail

ENV_FILE=/home/engagebyelevate/htdocs/engagebyelevate.com/.env

read_env() {
  grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'
}

SMTP_HOST=$(read_env SMTP_HOST)
SMTP_PORT=$(read_env SMTP_PORT)
SMTP_USER=$(read_env SMTP_USER)
SMTP_PASS=$(read_env SMTP_PASS)

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
