#!/usr/bin/env bash
# Export all approved 1:1 meetings to CSV (Dubai/GST times).
# Optionally filters by day if you pass YYYY-MM-DD as the first arg.
#
# Usage:
#   bash scripts/export-approved-meetings.sh                # all days
#   bash scripts/export-approved-meetings.sh 2026-06-02     # just Day 1
set -euo pipefail

DB=/home/engagebyelevate/htdocs/engagebyelevate.com/server/db/engage.db
OUT=/root/approved-meetings-$(date +%Y%m%d-%H%M%S).csv

DAY_FILTER=""
if [ $# -ge 1 ]; then
  DAY_FILTER="AND m.day = '$1'"
fi

sqlite3 -header -csv "$DB" "
SELECT
  m.id,
  m.day,
  substr(datetime(m.start_time, '+4 hours'), 12, 5) AS start_gst,
  substr(datetime(m.end_time,   '+4 hours'), 12, 5) AS end_gst,
  ru.org_name      AS requester_org,
  ru.contact_name  AS requester_name,
  ru.email         AS requester_email,
  ri.org_name      AS recipient_org,
  ri.contact_name  AS recipient_name,
  ri.email         AS recipient_email,
  m.teams_join_url,
  m.responded_at
FROM meetings m
JOIN users ru ON ru.id = m.requester_id
JOIN users ri ON ri.id = m.recipient_id
WHERE m.status = 'approved' $DAY_FILTER
ORDER BY m.day, m.start_time, m.id
" > "$OUT"

ROWS=$(wc -l < "$OUT")
echo "Wrote $((ROWS - 1)) approved meeting rows (plus 1 header) to:"
echo "  $OUT"
echo ""
echo "First 3 rows:"
head -3 "$OUT"
echo ""
echo "To download via browser:"
echo "  cp $OUT /home/engagebyelevate/htdocs/engagebyelevate.com/public/_export.csv"
echo "  Open https://engagebyelevate.com/_export.csv"
echo "  rm /home/engagebyelevate/htdocs/engagebyelevate.com/public/_export.csv  (when done)"
