-- Phase 1 (0.2.0): enable PostGIS. The domain schema (spatial_unit, source,
-- criterion_definition, criterion_value, outcome) is Phase 2 work per
-- docs/architecture/roadmap-to-first-deployment.md §4.1 and is deliberately
-- not included here.

CREATE EXTENSION IF NOT EXISTS postgis;
