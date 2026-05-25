-- ============================================================
-- Engage by Elevate 2026 — Teams join links populated (2026-05-25)
--
-- SAFE: only updates the teams_link column on the `sessions` table
-- for the 17 public sessions whose Teams meetings have been created.
-- No new columns, no new rows, no other tables touched.
-- ============================================================

BEGIN TRANSACTION;

-- Day 1 — 2026-06-02
UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_YWZhNDJmNTQtMzExNS00MzkyLTk1NGEtOGQxMTZjYWFmM2Y5%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-02' AND start_time='2026-06-02T07:00:00Z'; -- Opening at ETH

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZGQ4NjkxZGItYzVhZC00ZDc1LTgwMGEtZTRiNjUzZjY3Yjcz%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-02' AND start_time='2026-06-02T09:20:00Z'; -- Wynn Al Marjan Island

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_MTVmNWY5NmItMzAyMS00OWZjLTlkYWUtMzNhNzlkNjk5M2Iz%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-02' AND start_time='2026-06-02T10:30:00Z'; -- Coffee Corner D1 #1

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_YTAwYzdkOTEtMjkzNS00ZGVlLWI4MDktZTBiZjMwYjhhNTQ0%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-02' AND start_time='2026-06-02T11:20:00Z'; -- Panel: Virgin Atlantic etc.

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_ODYwOWExMmItYmZkOS00YzM3LWE5MTktZTNhY2U2MzIzNGZm%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-02' AND start_time='2026-06-02T12:40:00Z'; -- Voyage Privé

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZGU1MjY4ZjktNWY5NS00YmMzLWJhMWItNzVhYjJlZTRkNDEx%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-02' AND start_time='2026-06-02T14:00:00Z'; -- Coffee Corner D1 #2

-- Day 2 — 2026-06-03
UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_YTJmMGVjNmEtYTFjZi00NWFkLTkyZGItMDE1OTk5YTkyMTc1%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-03' AND start_time='2026-06-03T07:30:00Z'; -- RAKTDA

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_MDU4ODlkYzgtMmNkNy00ZTMxLTkzYWUtNDAyNDZlYzJiNTVm%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-03' AND start_time='2026-06-03T09:20:00Z'; -- Informa

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_NWUzZGE2OWYtYWI4Ni00NTE4LWE4ZGItYjhhODcwNGFkYzlk%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-03' AND start_time='2026-06-03T11:20:00Z'; -- Miral

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_MjlmODdiN2YtZWM1YS00NDE4LWExMWItYzEyMGYyMWQyYjYy%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-03' AND start_time='2026-06-03T13:00:00Z'; -- Coffee Corner D2

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_OTk2ZjNhZTAtNDQ2NC00ZjNiLTljZmEtMTBjMTJjYmYwOTJk%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-03' AND start_time='2026-06-03T15:00:00Z'; -- Closing at ETH

-- Day 3 — 2026-06-04 (in-person only; teams_link still useful for hybrid attendees of the day)
UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_YTFiNzRjMDktOGRhMy00YWUzLWE5Y2ItNzFhZDk0ZWIwN2Yx%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-04' AND start_time='2026-06-04T07:00:00Z'; -- Opening (Stuart)

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmRhZWE4YjQtOGQyNS00ZGU0LWI1YjQtZmMxODhmNWFiZDE0%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-04' AND start_time='2026-06-04T07:40:00Z'; -- Workplace Set-Up

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZWNjOTNjZjMtYWY5My00NjM1LTkyMmEtMWRjMDk2NmRhZDAw%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-04' AND start_time='2026-06-04T09:20:00Z'; -- Visit Qatar

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_MmVjN2MzNzUtZDYzZC00YjE3LWFhZmMtZTMxNWIyZTBhYzcy%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-04' AND start_time='2026-06-04T11:20:00Z'; -- Session TBC #1

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZWFiMmQzZjctYzQ3OS00ZGMyLTgwNWItNTgwOGY4NWVmYjZk%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-04' AND start_time='2026-06-04T12:40:00Z'; -- Session TBC #2

UPDATE sessions SET teams_link='https://teams.microsoft.com/l/meetup-join/19%3ameeting_NTY4NTU0NjktOTJlMC00NDI1LTg0YzctYzkyODk0NjE4ZmVi%40thread.v2/0?context=%7b%22Tid%22%3a%22a936c0f6-55c3-4ab4-9e1b-fc698449cd78%22%2c%22Oid%22%3a%22a5a924ae-5b42-4b87-97b9-8489a6811321%22%7d'
WHERE day='2026-06-04' AND start_time='2026-06-04T15:00:00Z'; -- Closing

COMMIT;

-- Verification: list all sessions with a teams_link, redacted prefix for visibility
SELECT day, substr(start_time, 12, 5) AS start_utc, substr(title, 1, 50) AS title,
       CASE WHEN teams_link IS NOT NULL THEN '✓ link set' ELSE '— no link' END AS link
FROM sessions
WHERE day BETWEEN '2026-06-02' AND '2026-06-04'
ORDER BY day, start_time;
