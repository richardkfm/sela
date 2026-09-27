-- A. Protection exclusion variants. Areas are planar EPSG:25832 (as the pipeline computes them).
\timing off
SET client_min_messages = warning;
DROP TABLE IF EXISTS scratch.cells;
CREATE TABLE scratch.cells AS
SELECT id, geom, ST_Centroid(geom) AS centre, ST_Area(geom) AS area
FROM spatial_unit WHERE pilot_region = 'uckermark-12073' AND kind = 'hex_grid';
CREATE INDEX ON scratch.cells USING gist (geom);
CREATE INDEX ON scratch.cells USING gist (centre);
ANALYZE scratch.cells;

-- Subdivided protection polygons, all categories (same subdivision as 20_sample.sql).
DROP TABLE IF EXISTS scratch.prot_sub;
CREATE TABLE scratch.prot_sub AS
SELECT category, ST_Subdivide(geom, 128) AS geom FROM staging.protection;
CREATE INDEX ON scratch.prot_sub USING gist (geom);
ANALYZE scratch.prot_sub;

-- Per cell: share inside union of NSG+NP (recomputed), share inside union of NSG+NP+FFH+SPA,
-- centroid-in flags.
DROP TABLE IF EXISTS scratch.cell_prot;
CREATE TABLE scratch.cell_prot AS
SELECT c.id,
  coalesce((SELECT ST_Area(ST_Intersection(c.geom, ST_Union(p.geom))) / c.area
            FROM scratch.prot_sub p WHERE p.category IN ('nsg','natp') AND ST_Intersects(c.geom, p.geom)), 0) AS share_strict,
  coalesce((SELECT ST_Area(ST_Intersection(c.geom, ST_Union(p.geom))) / c.area
            FROM scratch.prot_sub p WHERE p.category IN ('nsg','natp','ffh','spa') AND ST_Intersects(c.geom, p.geom)), 0) AS share_n2k,
  EXISTS (SELECT 1 FROM scratch.prot_sub p WHERE p.category IN ('nsg','natp') AND ST_Intersects(c.centre, p.geom)) AS centre_strict,
  EXISTS (SELECT 1 FROM scratch.prot_sub p WHERE p.category IN ('nsg','natp','ffh','spa') AND ST_Intersects(c.centre, p.geom)) AS centre_n2k
FROM scratch.cells c;
ALTER TABLE scratch.cell_prot ADD COLUMN pipeline_share double precision;
UPDATE scratch.cell_prot cp SET pipeline_share = r.raw_value FROM staging.raw_sample r
 WHERE r.spatial_unit_id = cp.id AND r.criterion_id = 'pv_protection_status';

\echo '--- sanity: recomputed NSG+NP share vs pipeline raw_sample'
SELECT count(*) cells, max(abs(least(share_strict,1) - pipeline_share)) max_abs_diff FROM scratch.cell_prot;

\echo '--- A1-A5 exclusion rules'
WITH t AS (SELECT count(*)::numeric n, 25980.762113533*count(*) FROM scratch.cell_prot),
r AS (
  SELECT '1 NSG+NP share>=0.5 (current)' r, count(*) FILTER (WHERE least(share_strict,1) >= 0.5) k FROM scratch.cell_prot
  UNION ALL SELECT '2 NSG+NP share>0', count(*) FILTER (WHERE share_strict > 0) FROM scratch.cell_prot
  UNION ALL SELECT '3 NSG+NP centroid inside', count(*) FILTER (WHERE centre_strict) FROM scratch.cell_prot
  UNION ALL SELECT '4 NSG+NP+FFH+SPA share>=0.5', count(*) FILTER (WHERE least(share_n2k,1) >= 0.5) FROM scratch.cell_prot
  UNION ALL SELECT '5 NSG+NP+FFH+SPA share>0', count(*) FILTER (WHERE share_n2k > 0) FROM scratch.cell_prot
)
SELECT r.r AS rule, r.k AS cells, round(100*r.k/t.n,2) AS pct_cells,
       round((r.k * (SELECT min(area) FROM scratch.cells) / 1e6)::numeric, 1) AS km2
FROM r, t ORDER BY 1;

\echo '--- boundary cells NSG+NP'
SELECT count(*) FILTER (WHERE share_strict > 0 AND share_strict < 0.5) AS "0<share<0.5",
       count(*) FILTER (WHERE share_strict >= 0.5 AND share_strict < 1 - 1e-9) AS "0.5<=share<1",
       count(*) FILTER (WHERE share_strict >= 1 - 1e-9) AS "share=1 (within 1e-9)"
FROM scratch.cell_prot;
\echo '--- same for NSG+NP+FFH+SPA'
SELECT count(*) FILTER (WHERE share_n2k > 0 AND share_n2k < 0.5) AS "0<share<0.5",
       count(*) FILTER (WHERE share_n2k >= 0.5 AND share_n2k < 1 - 1e-9) AS "0.5<=share<1",
       count(*) FILTER (WHERE share_n2k >= 1 - 1e-9) AS "share=1"
FROM scratch.cell_prot;
\echo '--- centroid rule vs share>=0.5 (NSG+NP) cross-tab'
SELECT centre_strict, (least(share_strict,1) >= 0.5) AS share_ge_half, count(*) FROM scratch.cell_prot GROUP BY 1,2 ORDER BY 1,2;

\echo '--- % of Landkreis area covered, union per category, clipped to the pilot boundary'
WITH b AS (SELECT geom FROM staging.pilot_boundary WHERE pilot_region = 'uckermark-12073'),
cats AS (
  SELECT category AS grp, ST_Union(geom) g FROM staging.protection GROUP BY category
  UNION ALL SELECT 'NSG+NP', ST_Union(geom) FROM staging.protection WHERE category IN ('nsg','natp')
  UNION ALL SELECT 'FFH+SPA', ST_Union(geom) FROM staging.protection WHERE category IN ('ffh','spa')
  UNION ALL SELECT 'NSG+NP+FFH+SPA', ST_Union(geom) FROM staging.protection WHERE category IN ('nsg','natp','ffh','spa')
  UNION ALL SELECT 'any of 6', ST_Union(geom) FROM staging.protection
)
SELECT grp, round((ST_Area(ST_Intersection(cats.g, b.geom))/1e6)::numeric,1) AS km2_in_lk,
       round((100*ST_Area(ST_Intersection(cats.g, b.geom))/ST_Area(b.geom))::numeric,2) AS pct_lk
FROM cats, b ORDER BY 1;
