-- Step 21: write the real criterion_value rows, with confidence per criterion.
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='uckermark-12073' -v method_version='real-v0' -f 21_write_values.sql
--
-- Confidence is a statement about the input's resolution and method against a
-- 100 m cell, stated here once rather than per screen (design-language.md §8):
--   pv_irradiation_annual  medium — 1 km grid; DWD's own ±6 % method uncertainty (sources.md §5.2)
--   pv_slope               low    — 200 m grid: one value spans several cells
--   pv_land_cover          medium where the dominant class covers ≥ half the cell, low otherwise;
--                                   CLC5 has a 5 ha minimum mapping unit
--   *_protection_status    medium — digitised at 1:10 000, "nicht rechtsverbindlich" per LfU

\set ON_ERROR_STOP on

INSERT INTO criterion_value (spatial_unit_id, criterion_id, source_id, value, unit, confidence, method_version)
SELECT rs.spatial_unit_id, rs.criterion_id, rs.source_id, rs.raw_value, rs.unit,
       CASE
         WHEN rs.criterion_id = 'pv_slope' THEN 'low'
         WHEN rs.criterion_id = 'pv_land_cover' THEN CASE WHEN lc.share >= 0.5 THEN 'medium' ELSE 'low' END
         ELSE 'medium'
       END,
       :'method_version'
FROM staging.raw_sample rs
JOIN spatial_unit su ON su.id = rs.spatial_unit_id AND su.pilot_region = :'pilot_region'
LEFT JOIN staging.land_cover_dominant lc ON lc.spatial_unit_id = rs.spatial_unit_id
ON CONFLICT (spatial_unit_id, criterion_id, method_version) DO UPDATE
  SET value = EXCLUDED.value, unit = EXCLUDED.unit, confidence = EXCLUDED.confidence,
      source_id = EXCLUDED.source_id, computed_at = now();
