-- ============================================================
-- Day-3 agenda update (event day, 2026-06-04)
-- ============================================================
-- Two existing TBC rows get final titles + adjusted audience flags.
-- teams_link is NOT touched — the URLs assigned earlier stay live.
--
--   15:20 GST (11:20 UTC)  "Session: TBC"  ->  Tourism Authority
--                                              of Thailand (TAT)
--                                              open to EVERYONE
--                                              (h:1 a:1 x:1)
--
--   16:40 GST (12:40 UTC)  "Session: TBC"  ->  Session: Virgin
--                                              Atlantic Holidays
--                                              open to hotels + exhibitors
--                                              (h:1 a:0 x:1)
--
-- show_online stays 0 on both (Day 3 is not streamed to the
-- Hotels-only online site).
-- ============================================================

BEGIN TRANSACTION;

UPDATE sessions SET
  title         = 'Session: Tourism Authority of Thailand',
  speaker       = 'TBC',
  organization  = 'Tourism Authority of Thailand',
  description   = 'Session with Tourism Authority of Thailand.',
  accepts_hotels    = 1,
  accepts_agencies  = 1,
  accepts_exhibitors = 1
WHERE day = '2026-06-04' AND start_time = '2026-06-04T11:20:00Z';

UPDATE sessions SET
  title         = 'Session: Virgin Atlantic Holidays',
  speaker       = 'TBC',
  organization  = 'Virgin Atlantic Holidays',
  description   = 'Session with Virgin Atlantic Holidays.',
  accepts_hotels    = 1,
  accepts_agencies  = 0,
  accepts_exhibitors = 1
WHERE day = '2026-06-04' AND start_time = '2026-06-04T12:40:00Z';

COMMIT;

-- ------------------------------------------------------------
-- Verification — should show the two updated rows
-- ------------------------------------------------------------
SELECT
  id,
  substr(start_time, 12, 5) AS start_utc,
  substr(end_time, 12, 5)   AS end_utc,
  substr(title, 1, 50)      AS title,
  accepts_hotels    AS h,
  accepts_agencies  AS a,
  accepts_exhibitors AS x,
  CASE WHEN teams_link IS NOT NULL AND teams_link <> '' THEN 'link OK' ELSE 'NO LINK' END AS link
FROM sessions
WHERE day = '2026-06-04'
  AND start_time IN ('2026-06-04T11:20:00Z', '2026-06-04T12:40:00Z')
ORDER BY start_time;
