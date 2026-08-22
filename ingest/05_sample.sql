-- Step 5 (roadmap §4.2): sample rasters and intersect vectors onto cells.
-- This is the fixture-scale example — area-weighted vector intersection —
-- for `fixture_land_cover_coverage`. A real criterion (raster sampling via
-- ST_SummaryStats/ST_Value, or a different vector intersection) is added
-- here as its own INSERT once its source is loaded and its
-- criterion_definition exists (docs/domain/scoring-criteria.md).
--
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='...' -f 05_sample.sql
--
-- Idempotent via ON CONFLICT: re-running replaces the sampled value for a
-- cell rather than duplicating or summing it.

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT
  su.id,
  'fixture_land_cover_coverage',
  'fixture-land-cover',
  SUM(ST_Area(ST_Intersection(su.geom, lc.geom))) / NULLIF(ST_Area(su.geom), 0),
  'fraction'
FROM spatial_unit su
JOIN staging.land_cover_sample lc ON ST_Intersects(su.geom, lc.geom)
WHERE su.pilot_region = :'pilot_region'
  AND su.kind = 'hex_grid'
GROUP BY su.id
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value,
      unit = EXCLUDED.unit,
      source_id = EXCLUDED.source_id;
