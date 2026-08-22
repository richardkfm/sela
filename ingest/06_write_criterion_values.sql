-- Step 6 (roadmap §4.2): write criterion_value rows, each with its
-- source_id — the rule lib/db/migrations/0002_domain_schema.sql makes
-- unviolatable (NOT NULL). confidence is fixed at 'medium' for this
-- fixture-scale sampling method; a real criterion's confidence reflects its
-- actual data quality/applicability and is set per-criterion, not as a
-- pipeline-wide constant.
--
-- Invoke with:
--   psql "$DATABASE_URL" -v method_version='...' -f 06_write_criterion_values.sql
--
-- Idempotent via the criterion_value unique constraint
-- (spatial_unit_id, criterion_id, method_version).

INSERT INTO criterion_value (spatial_unit_id, criterion_id, source_id, value, unit, confidence, method_version)
SELECT rs.spatial_unit_id, rs.criterion_id, rs.source_id, rs.raw_value, rs.unit, 'medium', :'method_version'
FROM staging.raw_sample rs
ON CONFLICT (spatial_unit_id, criterion_id, method_version) DO UPDATE
  SET value = EXCLUDED.value,
      unit = EXCLUDED.unit,
      confidence = EXCLUDED.confidence,
      computed_at = now();
