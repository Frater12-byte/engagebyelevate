-- ============================================================
-- Day-2 Wynn Al Marjan Island townhall — added on event day 1
-- ============================================================
-- New PARALLEL session for Day 2 (2026-06-03):
--
--   Same start as the existing Informa session (13:20-14:00 GST).
--   While hotels are in Session: Informa, agencies + exhibitors
--   attend this new Wynn sponsorship townhall.
--
--   Audience mutually-exclusive on hotels vs agencies:
--     Informa  →  hotels yes, agencies no, exhibitors yes
--     Wynn D2  →  hotels no,  agencies yes, exhibitors yes
--   Exhibitors can attend either — both flags accept them.
--
--   Hotels-only online site (online.engagebyelevate.com) is NOT
--   affected: show_online=0 on the new Wynn row.
-- ============================================================

BEGIN TRANSACTION;

-- Defensive: reaffirm Informa's audience flags. Idempotent (matches
-- the values set in 2026-05-22-agenda-update.sql) — included only so
-- this migration's verification SELECT shows the full parallel pair.
UPDATE sessions
SET accepts_hotels = 1, accepts_agencies = 0, accepts_exhibitors = 1, show_online = 1
WHERE day = '2026-06-03'
  AND start_time = '2026-06-03T09:20:00Z'
  AND title LIKE '%Informa%';

INSERT INTO sessions (
  title,
  speaker,
  organization,
  description,
  day,
  start_time,
  end_time,
  location,
  type,
  teams_link,
  is_online,
  is_hybrid,
  visible,
  accepts_hotels,
  accepts_agencies,
  accepts_exhibitors,
  show_online
) VALUES (
  'Headline Sponsorship Session: Wynn Al Marjan Island',
  NULL,
  'Wynn Al Marjan Island',
  'Headline sponsorship session: Wynn Al Marjan Island.',
  '2026-06-03',
  '2026-06-03T09:20:00Z',
  '2026-06-03T10:00:00Z',
  'Auditorium',
  'keynote',
  'https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmZlOTc0NWUtM2NlMS00MjkyLTkzZmEtZWJhYzNmNjliYjFj%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22ca46c970-cd7f-462f-b66f-48bad8d2f837%22%7d',
  0,
  1,
  1,
  0,
  1,
  1,
  0
);

COMMIT;

-- ------------------------------------------------------------
-- Verification — should show both rows side by side at 09:20Z
-- ------------------------------------------------------------
SELECT
  substr(start_time, 12, 5) AS start_utc,
  substr(end_time, 12, 5)   AS end_utc,
  substr(title, 1, 55)      AS title,
  accepts_hotels    AS h,
  accepts_agencies  AS a,
  accepts_exhibitors AS x,
  show_online       AS o
FROM sessions
WHERE day = '2026-06-03'
  AND start_time = '2026-06-03T09:20:00Z'
ORDER BY id;
