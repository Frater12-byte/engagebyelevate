-- ============================================================
-- Engage by Elevate 2026 — Agenda update (2026-05-22)
--
-- SAFE: only the `sessions` table is touched.
--   - Users, organisations, 1:1 meetings, magic_tokens, slots,
--     tourism_boards, exhibitors, audit_log, email_log: NOT touched.
--   - Existing session rows: titles/speakers/orgs/descriptions
--     updated where the new agenda renamed them; start/end times
--     are NOT changed (verified against the new agenda).
--   - Three new "Add-on session: Coffee Corner" rows inserted.
--   - D3 Closing end_time extended from 19:30 to 20:00 GST.
--
-- Wrapped in a transaction so partial failure rolls back.
-- ============================================================

BEGIN TRANSACTION;

-- ------------------------------------------------------------
-- 1. SCHEMA: add audience-filter columns + online-visibility flag
-- ------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN accepts_hotels     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN accepts_agencies   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN accepts_exhibitors INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN show_online        INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. DAY 1 — Tuesday 2 June 2026
-- ------------------------------------------------------------

UPDATE sessions SET
  title='Opening Session at Elevate Tourism Hub',
  speaker='Samir Hamadeh (Founder & CEO – Elevate World), Stuart Dale (Chief Commercial Officer – Elevate World) & Francesco Terragni (Chief Technology Officer – Elevate World)',
  organization='Elevate World',
  description='Welcome and opening of Engage by Elevate 2026.',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-02' AND start_time='2026-06-02T07:00:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-02' AND start_time='2026-06-02T07:40:00Z'; -- Workplace Set-Up

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-02' AND start_time='2026-06-02T08:00:00Z'; -- Meetings 12:00–13:20

UPDATE sessions SET
  title='Headline Sponsorship Session: Wynn Al Marjan Island',
  speaker='TBC',
  organization='Wynn Al Marjan Island',
  description='Headline sponsorship session: Wynn Al Marjan Island.',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-02' AND start_time='2026-06-02T09:20:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-02' AND start_time='2026-06-02T10:00:00Z'; -- Meetings 14:00–15:20

UPDATE sessions SET
  title='Panel Session: Virgin Atlantic Holidays, If Only/Elegant Resorts, Destinology, and On The Beach',
  speaker='TBC',
  organization=NULL,
  description='Panel session.',
  accepts_hotels=1, accepts_agencies=0, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-02' AND start_time='2026-06-02T11:20:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-02' AND start_time='2026-06-02T12:20:00Z'; -- Break

UPDATE sessions SET
  title='Session: Voyage Privé',
  speaker='Charles Guilhamon (CEO – Voyage Privé)',
  organization='Voyage Privé',
  description='Session with Voyage Privé.',
  accepts_hotels=1, accepts_agencies=0, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-02' AND start_time='2026-06-02T12:40:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-02' AND start_time='2026-06-02T13:10:00Z'; -- Meetings 17:10–19:00

-- New: two Add-on Coffee Corner sessions on Day 1
INSERT INTO sessions
  (title, speaker, organization, description, day, start_time, end_time, location, type,
   is_online, is_hybrid, visible,
   accepts_hotels, accepts_agencies, accepts_exhibitors, show_online)
VALUES
  ('Add-on session: Coffee Corner', 'TBC', NULL, 'Coffee Corner.',
   '2026-06-02', '2026-06-02T10:30:00Z', '2026-06-02T10:50:00Z', 'Auditorium', 'keynote',
   0, 1, 1,  1, 0, 1, 1),
  ('Add-on session: Coffee Corner', 'TBC', NULL, 'Coffee Corner.',
   '2026-06-02', '2026-06-02T14:00:00Z', '2026-06-02T14:20:00Z', 'Auditorium', 'keynote',
   0, 1, 1,  1, 0, 1, 1);

-- ------------------------------------------------------------
-- 3. DAY 2 — Wednesday 3 June 2026
-- ------------------------------------------------------------

UPDATE sessions SET
  title='Session: Ras Al Khaimah Tourism Development Authority (RAKTDA)',
  speaker='Carlo Kazan (Assistant Director – Destination Tourism Development)',
  organization='Ras Al Khaimah Tourism Development Authority',
  description='Session with RAKTDA.',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-03' AND start_time='2026-06-03T07:30:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-03' AND start_time='2026-06-03T08:00:00Z'; -- Meetings 12:00–13:20

UPDATE sessions SET
  title='Session: Informa',
  speaker='Wouter Molman (Chief Commercial Officer – India, Middle East, Türkiye and Africa at Informa Markets)',
  organization='Informa',
  description='Session with Informa.',
  accepts_hotels=1, accepts_agencies=0, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-03' AND start_time='2026-06-03T09:20:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-03' AND start_time='2026-06-03T10:00:00Z'; -- Meetings 14:00–15:20

UPDATE sessions SET
  title='Session: Miral (Yas Island Abu Dhabi)',
  speaker='TBC',
  organization='Miral',
  description='Session with Miral (Yas Island Abu Dhabi).',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-03' AND start_time='2026-06-03T11:20:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-03' AND start_time='2026-06-03T11:40:00Z'; -- Break

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-03' AND start_time='2026-06-03T12:00:00Z'; -- Meetings 16:00–19:00

UPDATE sessions SET
  title='Closing Session at Elevate Tourism Hub',
  speaker='Samir Hamadeh (Founder & CEO – Elevate World)',
  organization='Elevate World',
  description='Closing session at Elevate Tourism Hub.',
  accepts_hotels=1, accepts_agencies=0, accepts_exhibitors=1, show_online=1
WHERE day='2026-06-03' AND start_time='2026-06-03T15:00:00Z';

-- New: Add-on Coffee Corner on Day 2
INSERT INTO sessions
  (title, speaker, organization, description, day, start_time, end_time, location, type,
   is_online, is_hybrid, visible,
   accepts_hotels, accepts_agencies, accepts_exhibitors, show_online)
VALUES
  ('Add-on session: Coffee Corner', 'TBC', NULL, 'Coffee Corner.',
   '2026-06-03', '2026-06-03T13:00:00Z', '2026-06-03T13:20:00Z', 'Auditorium', 'keynote',
   0, 1, 1,  1, 0, 1, 1);

-- ------------------------------------------------------------
-- 4. DAY 3 — Thursday 4 June 2026
-- ------------------------------------------------------------

UPDATE sessions SET
  title='Opening Session',
  speaker='Stuart Dale (Chief Commercial Officer – Elevate World)',
  organization='Elevate World',
  description='Opening session for international day.',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T07:00:00Z';

UPDATE sessions SET
  location='Auditorium',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T07:40:00Z'; -- Workplace Set-Up

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T08:00:00Z'; -- Meetings 12:00–13:20

UPDATE sessions SET
  title='Session: Visit Qatar',
  speaker='Franziska Maynard (Regional Manager Europe (DACH and Nordics) – Visit Qatar)',
  organization='Visit Qatar',
  description='Session with Visit Qatar.',
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T09:20:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T10:00:00Z'; -- Meetings 14:00–15:20

UPDATE sessions SET
  title='Session: TBC',
  speaker='TBC',
  organization=NULL,
  description=NULL,
  accepts_hotels=1, accepts_agencies=0, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T11:20:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T12:20:00Z'; -- Break

UPDATE sessions SET
  title='Session: TBC',
  speaker='TBC',
  organization=NULL,
  description=NULL,
  accepts_hotels=1, accepts_agencies=0, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T12:40:00Z';

UPDATE sessions SET
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T13:10:00Z'; -- Meetings 17:10–19:00

UPDATE sessions SET
  title='Closing Session',
  speaker='Stuart Dale (Chief Commercial Officer – Elevate World)',
  organization='Elevate World',
  description='Final closing session.',
  end_time='2026-06-04T16:00:00Z', -- extended from 19:30 to 20:00 GST per the new agenda
  accepts_hotels=1, accepts_agencies=1, accepts_exhibitors=1, show_online=0
WHERE day='2026-06-04' AND start_time='2026-06-04T15:00:00Z';

COMMIT;

-- ------------------------------------------------------------
-- 5. VERIFICATION (read-only — safe to re-run)
-- ------------------------------------------------------------
SELECT day, start_time, end_time, substr(title, 1, 60) AS title,
       accepts_hotels AS h, accepts_agencies AS a, accepts_exhibitors AS x,
       show_online AS o
FROM sessions
WHERE day BETWEEN '2026-06-02' AND '2026-06-04'
ORDER BY day, start_time;
