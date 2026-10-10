-- Step 24 (ADR-0012): stamp every cell of the region with the AGS of the
-- Gemeinde containing a point on its surface — the one rule by which a cell
-- on a municipal border belongs to one Gemeinde (ADR-0010), now stored once
-- rather than joined on every read. Kreis = left(ags, 5), Land = left(ags, 2):
-- a Landkreis view over a Land's grid is this prefix (lib/db/queries/regions.ts).
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='…' -f 24_stamp_ags.sql
--
-- A cell outside every loaded Gemeinde keeps a null AGS and is shown by the
-- grid region only. Re-runnable: every cell of the region is re-stamped.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

UPDATE spatial_unit su
SET ags = m.ags
FROM municipality m
WHERE su.pilot_region = :'pilot_region'
  AND m.pilot_region = :'pilot_region'
  AND ST_Contains(m.geom, ST_PointOnSurface(su.geom));

SELECT count(*) FILTER (WHERE ags IS NOT NULL) AS stamped,
       count(*) FILTER (WHERE ags IS NULL) AS outside_every_gemeinde,
       count(DISTINCT left(ags, 5)) AS kreise
FROM spatial_unit WHERE pilot_region = :'pilot_region';
