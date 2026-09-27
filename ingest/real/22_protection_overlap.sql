-- Step 22: every protected area each cell overlaps, by name and share
-- (protection_overlap, migration 0006; ADR-0009). The evidence behind the
-- Prüfhinweise of decision memo Q1c/Q2d: FFH, SPA and LSG areas are named, not
-- excluded, and a Naturschutzgebiet overlapping less than half a cell is named
-- with its share. Biosphärenreservat overlaps are stored too; they are not
-- shown (memo Q1: BNatSchG § 25 not read at source).
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='uckermark-12073' -f 22_protection_overlap.sql
--
-- Every overlap is stored, however small; which ones the interface shows is a
-- rule in lib/scoring/protection-flags.ts (≥ 1 % of the cell). An area can be
-- several polygons under one code, so shares are taken against the union of
-- its parts. The LfU caveat stands for every row: overview data, digitised at
-- 1:10 000, not legally binding.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE cells AS
SELECT id, geom, ST_Area(geom) AS area
FROM spatial_unit
WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid';
CREATE INDEX ON cells USING gist (geom);
ANALYZE cells;

CREATE TEMP TABLE area_parts AS
SELECT category, area_code, name, ST_Subdivide(geom, 128) AS geom
FROM staging.protection;
CREATE INDEX ON area_parts USING gist (geom);
ANALYZE area_parts;

BEGIN;
DELETE FROM protection_overlap po USING spatial_unit su
WHERE su.id = po.spatial_unit_id AND su.pilot_region = :'pilot_region';

INSERT INTO protection_overlap (spatial_unit_id, category, area_code, name, share, source_id)
SELECT id, category, area_code, name, least(share, 1), 'lfu-bb-schutzgebiete'
FROM (
  SELECT c.id, p.category, p.area_code, p.name,
         ST_Area(ST_Intersection(c.geom, ST_Union(p.geom))) / c.area AS share
  FROM cells c
  JOIN area_parts p ON ST_Intersects(c.geom, p.geom)
  GROUP BY c.id, c.geom, c.area, p.category, p.area_code, p.name
) s
WHERE share > 0;
COMMIT;

SELECT category, count(*) AS overlaps, count(DISTINCT spatial_unit_id) AS cells
FROM protection_overlap po JOIN spatial_unit su ON su.id = po.spatial_unit_id
WHERE su.pilot_region = :'pilot_region'
GROUP BY category ORDER BY category;
