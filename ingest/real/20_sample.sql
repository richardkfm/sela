-- Step 20: sample the real sources onto the pilot region's cells.
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='uckermark-12073' -f 20_sample.sql
--
-- One staging.raw_sample row per cell and criterion. Idempotent via ON CONFLICT.
-- The reading method per criterion is chosen to match each source's resolution
-- against a 100 m cell (2.6 ha):
--
--   pv_irradiation_annual  1 km grid  → mean of ten annual values at the cell centre
--   pv_slope               200 m grid → value at the cell centre
--   pv_land_cover          vector     → the class covering the largest part of the cell
--   *_protection_status    vector     → share of the cell inside a Naturschutzgebiet or the Nationalpark

\set ON_ERROR_STOP on
-- ST_Value reports every centre that falls in a neighbouring tile's hull but outside its pixels;
-- those reads return NULL and are filtered below, so the notices are only noise.
SET client_min_messages = warning;

CREATE TEMP TABLE cells AS
SELECT id, geom, ST_Centroid(geom) AS centre, ST_Area(geom) AS area
FROM spatial_unit
WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid';
CREATE INDEX ON cells USING gist (geom);
ANALYZE cells;

-- Irradiation: the decided 2016–2025 trailing mean (sources.md §5.2), read in the
-- grid's own EPSG:31467 so nothing is resampled. A cell is only written when all
-- ten years have a value at its centre — a partial mean is a different quantity.
-- Both raster joins match the index expression (ST_ConvexHull(rast) &&) directly;
-- ST_Intersects(raster, geometry) is not inlined into an index condition and
-- turned this step from seconds into a scan of every tile per cell.
CREATE TEMP TABLE centres_gk3 AS
SELECT id, ST_Transform(centre, 31467) AS pt FROM cells;

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT c.id, 'pv_irradiation_annual', 'dwd-cdc-radiation', avg(v.value), 'kWh/m²·a'
FROM centres_gk3 c
CROSS JOIN LATERAL (
  SELECT ST_Value(r.rast, c.pt) AS value, r.year
  FROM staging.dwd_radiation r
  WHERE ST_ConvexHull(r.rast) && c.pt
) v
WHERE v.value IS NOT NULL
GROUP BY c.id
HAVING count(DISTINCT v.year) = 10
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

-- Slope in degrees from gdaldem (13_dgm200.sh).
INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT c.id, 'pv_slope', 'bkg-dgm200', avg(v.value), '°'
FROM cells c
CROSS JOIN LATERAL (
  SELECT ST_Value(s.rast, c.centre) AS value
  FROM staging.dgm200_slope s
  WHERE ST_ConvexHull(s.rast) && c.centre
) v
WHERE v.value IS NOT NULL
-- A centre exactly on a tile edge touches two tiles; both read the same pixel.
GROUP BY c.id
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

-- Land cover. CLC5 polygons can carry thousands of vertices; subdividing them
-- first keeps each intersection small. The dominant class and its share are
-- kept in staging.land_cover_dominant — the share decides confidence (step 21).
DROP TABLE IF EXISTS staging.clc5_sub;
CREATE TABLE staging.clc5_sub AS
SELECT clc18::int AS clc18, ST_Subdivide(geom, 128) AS geom FROM staging.clc5;
CREATE INDEX ON staging.clc5_sub USING gist (geom);
ANALYZE staging.clc5_sub;

DROP TABLE IF EXISTS staging.land_cover_dominant;
CREATE TABLE staging.land_cover_dominant AS
WITH parts AS (
  SELECT c.id, l.clc18, sum(ST_Area(ST_Intersection(c.geom, l.geom))) AS covered, c.area
  FROM cells c
  JOIN staging.clc5_sub l ON ST_Intersects(c.geom, l.geom)
  GROUP BY c.id, l.clc18, c.area
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY id ORDER BY covered DESC, clc18) AS rn FROM parts
)
SELECT id AS spatial_unit_id, clc18, covered / area AS share FROM ranked WHERE rn = 1;

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT spatial_unit_id, 'pv_land_cover', 'bkg-clc5', clc18, 'CLC-Klasse'
FROM staging.land_cover_dominant
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

-- Protected areas. Only Naturschutzgebiete and the Nationalpark count: their
-- ordinances generally prohibit building, so treating them as an exclusion is
-- at least the right *kind* of rule. FFH and SPA areas were counted too in a
-- first run and excluded 53 % of the Uckermark — but Natura 2000 requires an
-- assessment (FFH-Verträglichkeitsprüfung), not a ban, so the map would have
-- called land "ausgeschlossen" where development is legally possible. They
-- stay loaded in staging.protection for display and for a later, decided rule.
--
-- Every cell gets a value — 0 where nothing overlaps — because
-- the scoring engine treats a *missing* value as "not checked", never as "clear"
-- (lib/scoring/suitability.ts). The same share feeds the PV and the wind criterion.
DROP TABLE IF EXISTS staging.protection_sub;
CREATE TABLE staging.protection_sub AS
SELECT category, ST_Subdivide(geom, 128) AS geom
FROM staging.protection
WHERE category IN ('nsg', 'natp');
CREATE INDEX ON staging.protection_sub USING gist (geom);
ANALYZE staging.protection_sub;

CREATE TEMP TABLE protected_share AS
SELECT c.id,
       coalesce((
         SELECT ST_Area(ST_Intersection(c.geom, ST_Union(p.geom))) / c.area
         FROM staging.protection_sub p
         WHERE ST_Intersects(c.geom, p.geom)
       ), 0) AS share
FROM cells c;

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT id, criterion, 'lfu-bb-schutzgebiete', least(share, 1), 'Flächenanteil'
FROM protected_share CROSS JOIN (VALUES ('pv_protection_status'), ('wind_protection_status')) AS k(criterion)
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;
