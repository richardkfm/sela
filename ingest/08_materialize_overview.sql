-- Step 8 (ADR-0012): after the verdicts, the per-region aggregates the explorer
-- reads instead of counting a million cells per request —
--
--   * unit_overview: the display pyramid below the cell zoom. For every
--     overview level (lib/map/tiles.ts OVERVIEW_LEVELS: 1 000 m and 5 000 m),
--     ST_HexagonGrid over the region's cells; each hexagon counts the cells
--     whose centroid it contains, per class and technology, and records the
--     most frequent class with its share. A tie goes to the more restrictive
--     class, so an overview never reads more buildable than its cells.
--   * region_verdict_count: the legend's numbers per technology.
--   * region_source: the sources the region's criterion values cite.
--   * region.unit_count: how many cells the region shows.
--
-- Written for the grid region and for every Landkreis of it that has cells
-- (by AGS prefix, spatial_unit.ags). Invoke with:
--   psql "$DATABASE_URL" -v grid_region='…' -v method_version='…' -f 08_materialize_overview.sql
-- Idempotent: each run replaces what it wrote for these regions and this
-- method version. No number is ever computed on an overview hexagon.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- The regions this grid serves: itself, and its Kreise that have cells.
CREATE TEMP TABLE target_region AS
SELECT r.id AS region_id, NULL::text AS kreis_ags
FROM region r WHERE r.id = :'grid_region'
UNION ALL
SELECT r.id, r.ags
FROM region r
WHERE r.kind = 'kreis' AND r.parent_id = :'grid_region'
  AND EXISTS (SELECT 1 FROM spatial_unit su WHERE su.pilot_region = :'grid_region' AND left(su.ags, 5) = r.ags);

-- Fresh statistics: the verdicts were just written in bulk, and a plan made on
-- stale counts turned the join below into nested loops on a Land.
ANALYZE suitability_verdict;
ANALYZE spatial_unit;

-- One row per cell with its three verdicts; cells without a verdict row read "unscored".
CREATE TEMP TABLE cell_verdict AS
SELECT su.id, su.ags, ST_Centroid(su.geom) AS centre,
       coalesce(pv.verdict, 'unscored') AS v_pv,
       coalesce(ag.verdict, 'unscored') AS v_agripv,
       coalesce(wi.verdict, 'unscored') AS v_wind,
       coalesce(pv.protection_flag_count, 0) > 0 AS f_pv,
       coalesce(ag.protection_flag_count, 0) > 0 AS f_agripv
FROM spatial_unit su
LEFT JOIN suitability_verdict pv ON pv.spatial_unit_id = su.id AND pv.technology = 'pv' AND pv.method_version = :'method_version'
LEFT JOIN suitability_verdict ag ON ag.spatial_unit_id = su.id AND ag.technology = 'agripv' AND ag.method_version = :'method_version'
LEFT JOIN suitability_verdict wi ON wi.spatial_unit_id = su.id AND wi.technology = 'wind' AND wi.method_version = :'method_version'
WHERE su.pilot_region = :'grid_region';
CREATE INDEX ON cell_verdict USING gist (centre);
CREATE INDEX ON cell_verdict (left(ags, 5));
ANALYZE cell_verdict;

-- Ties between classes go to the more restrictive one.
CREATE TEMP TABLE verdict_rank (verdict text PRIMARY KEY, rank int);
INSERT INTO verdict_rank VALUES
  ('excluded', 0), ('not_considered', 1), ('unsuitable', 2), ('restricted', 3), ('unscored', 4), ('suitable', 5), ('unrestricted', 6);

BEGIN;

DELETE FROM unit_overview WHERE region_id IN (SELECT region_id FROM target_region) AND method_version = :'method_version';
DELETE FROM region_verdict_count WHERE region_id IN (SELECT region_id FROM target_region) AND method_version = :'method_version';
DELETE FROM region_source WHERE region_id IN (SELECT region_id FROM target_region);

-- Cells per target region (a Kreis sees the grid's cells with its prefix).
CREATE TEMP TABLE region_cell AS
SELECT t.region_id, c.*
FROM target_region t
JOIN cell_verdict c ON t.kreis_ags IS NULL OR left(c.ags, 5) = t.kreis_ags;
CREATE INDEX ON region_cell (region_id);
CREATE INDEX ON region_cell USING gist (centre);
ANALYZE region_cell;

-- Overview hexagons, both levels. The grid is anchored at the CRS origin, so a
-- Kreis's hexagons coincide with its Land's.
-- Cell grid and overview grids share the origin, so a cell's centre can lie
-- exactly on a coarser hexagon's edge: ST_Intersects (not ST_Contains) finds
-- it, and DISTINCT ON counts it once, in the lower-indexed hexagon.
CREATE TEMP TABLE overview_cell AS
SELECT DISTINCT ON (t.region_id, lvl.level_m, c.id)
       t.region_id, lvl.level_m, h.i, h.j, h.geom, c.v_pv, c.v_agripv, c.v_wind, c.f_pv, c.f_agripv
FROM target_region t
CROSS JOIN (VALUES (1000), (5000)) AS lvl(level_m)
CROSS JOIN LATERAL (
  SELECT ST_Extent(rc.centre) AS extent FROM region_cell rc WHERE rc.region_id = t.region_id
) e
CROSS JOIN LATERAL ST_HexagonGrid(lvl.level_m, ST_SetSRID(e.extent::geometry, 25832)) AS h(geom, i, j)
JOIN region_cell c ON c.region_id = t.region_id AND ST_Intersects(h.geom, c.centre)
ORDER BY t.region_id, lvl.level_m, c.id, h.i, h.j;
CREATE INDEX ON overview_cell (region_id, level_m, i, j);
ANALYZE overview_cell;

CREATE TEMP TABLE overview_class AS
SELECT region_id, level_m, i, j, technology, verdict, count(*) AS n
FROM overview_cell
CROSS JOIN LATERAL (VALUES ('pv', v_pv), ('agripv', v_agripv), ('wind', v_wind)) AS tv(technology, verdict)
GROUP BY region_id, level_m, i, j, technology, verdict;
-- The per-hexagon counts below look this table up once per hexagon.
CREATE INDEX ON overview_class (region_id, level_m, i, j);
ANALYZE overview_class;

CREATE TEMP TABLE overview_dominant AS
SELECT DISTINCT ON (oc.region_id, oc.level_m, oc.i, oc.j, oc.technology)
       oc.region_id, oc.level_m, oc.i, oc.j, oc.technology, oc.verdict, oc.n
FROM overview_class oc
JOIN verdict_rank vr ON vr.verdict = oc.verdict
ORDER BY oc.region_id, oc.level_m, oc.i, oc.j, oc.technology, oc.n DESC, vr.rank;

INSERT INTO unit_overview (region_id, level_m, i, j, geom, n_cells, counts,
                           d_pv, d_agripv, d_wind, s_pv, s_agripv, s_wind, n_flag_pv, n_flag_agripv, method_version)
SELECT g.region_id, g.level_m, g.i, g.j, g.geom, g.n_cells,
       (SELECT jsonb_object_agg(technology, per_class)
        FROM (
          SELECT technology, jsonb_object_agg(verdict, n) AS per_class
          FROM overview_class oc
          WHERE oc.region_id = g.region_id AND oc.level_m = g.level_m AND oc.i = g.i AND oc.j = g.j
          GROUP BY technology
        ) x),
       d.pv_verdict, d.agripv_verdict, d.wind_verdict,
       d.pv_n::real / g.n_cells, d.agripv_n::real / g.n_cells, d.wind_n::real / g.n_cells,
       g.n_flag_pv, g.n_flag_agripv, :'method_version'
FROM (
  SELECT region_id, level_m, i, j, min(geom::text)::geometry AS geom, count(*) AS n_cells,
         count(*) FILTER (WHERE f_pv) AS n_flag_pv, count(*) FILTER (WHERE f_agripv) AS n_flag_agripv
  FROM overview_cell GROUP BY region_id, level_m, i, j
) g
JOIN (
  SELECT region_id, level_m, i, j,
         max(verdict) FILTER (WHERE technology = 'pv') AS pv_verdict, max(n) FILTER (WHERE technology = 'pv') AS pv_n,
         max(verdict) FILTER (WHERE technology = 'agripv') AS agripv_verdict, max(n) FILTER (WHERE technology = 'agripv') AS agripv_n,
         max(verdict) FILTER (WHERE technology = 'wind') AS wind_verdict, max(n) FILTER (WHERE technology = 'wind') AS wind_n
  FROM overview_dominant GROUP BY region_id, level_m, i, j
) d USING (region_id, level_m, i, j);

-- The legend's counts, including "unscored".
INSERT INTO region_verdict_count (region_id, technology, verdict, n, method_version)
SELECT region_id, technology, verdict, count(*), :'method_version'
FROM region_cell
CROSS JOIN LATERAL (VALUES ('pv', v_pv), ('agripv', v_agripv), ('wind', v_wind)) AS tv(technology, verdict)
GROUP BY region_id, technology, verdict;

-- The sources each region's cells cite.
INSERT INTO region_source (region_id, source_id)
SELECT DISTINCT rc.region_id, cv.source_id
FROM region_cell rc
JOIN criterion_value cv ON cv.spatial_unit_id = rc.id;

UPDATE region r SET unit_count = c.n
FROM (SELECT region_id, count(*) AS n FROM region_cell GROUP BY region_id) c
WHERE c.region_id = r.id;

COMMIT;

SELECT region_id, level_m, count(*) AS hexagons, sum(n_cells) AS cells
FROM unit_overview
WHERE region_id IN (SELECT region_id FROM target_region) AND method_version = :'method_version'
GROUP BY 1, 2 ORDER BY 1, 2;
