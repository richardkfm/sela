-- Step 5b, fixture-only: additional synthetic per-cell variation for the
-- three fixture criteria 05_sample.sql doesn't cover
-- (fixture_agripv_suitability, fixture_wind_resource,
-- fixture_protection_status). Derived deterministically from each cell's
-- centroid position within the fixture boundary's own bounding box —
-- never random() — so re-running this step reproduces identical values
-- (idempotency). This is illustrative demo variation, not a measured
-- criterion: see ingest/fixtures/README.md and
-- lib/scoring/illustrative-weights.ts.
--
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='...' -f 05b_sample_illustrative_variation.sql
--
-- Idempotent via ON CONFLICT, same as 05_sample.sql.

WITH bbox AS (
  SELECT ST_Envelope(ST_Collect(geom)) AS env
  FROM spatial_unit
  WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid'
), positioned AS (
  SELECT
    su.id,
    (ST_X(ST_Centroid(su.geom)) - ST_XMin(bbox.env)) / NULLIF(ST_XMax(bbox.env) - ST_XMin(bbox.env), 0) AS nx,
    (ST_Y(ST_Centroid(su.geom)) - ST_YMin(bbox.env)) / NULLIF(ST_YMax(bbox.env) - ST_YMin(bbox.env), 0) AS ny,
    -- Rank by distance from the boundary's origin corner — used below to
    -- flag the single closest cell as protected regardless of how many
    -- cells the grid has, rather than a fixed distance threshold that a
    -- small or sparse grid could miss entirely.
    ROW_NUMBER() OVER (
      ORDER BY
        (ST_X(ST_Centroid(su.geom)) - ST_XMin(bbox.env)) / NULLIF(ST_XMax(bbox.env) - ST_XMin(bbox.env), 0)
        + (ST_Y(ST_Centroid(su.geom)) - ST_YMin(bbox.env)) / NULLIF(ST_YMax(bbox.env) - ST_YMin(bbox.env), 0)
    ) AS distance_rank
  FROM spatial_unit su, bbox
  WHERE su.pilot_region = :'pilot_region' AND su.kind = 'hex_grid'
)
INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT id, 'fixture_agripv_suitability', 'fixture-land-cover', COALESCE(nx, 0.5), 'fraction'
FROM positioned
UNION ALL
SELECT id, 'fixture_wind_resource', 'fixture-wind-resource-map', COALESCE(ny, 0.5), 'fraction'
FROM positioned
UNION ALL
-- The single cell nearest the boundary origin is flagged "protected" — at
-- least one cell demonstrates the ADR-0004 exclusion path end to end,
-- however many cells the grid has.
SELECT
  id,
  'fixture_protection_status',
  'fixture-protection-registry',
  CASE WHEN distance_rank = 1 THEN 1 ELSE 0 END,
  'boolean'
FROM positioned
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value,
      unit = EXCLUDED.unit,
      source_id = EXCLUDED.source_id;
