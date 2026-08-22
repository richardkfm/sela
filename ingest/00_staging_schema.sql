-- Idempotent staging area. `staging` holds raw/reprojected/loaded data on
-- its way into the domain schema (lib/db/migrations/0002_domain_schema.sql)
-- — nothing here is queried by the application.
--
-- Only `raw_sample` is declared here: it is written by our own SQL
-- (05_sample.sql). The source-shaped tables (`pilot_boundary`,
-- `land_cover_sample`, and whatever a real dataset's staging table is
-- called) are created by 03_load.sh's `ogr2ogr -overwrite` directly from
-- each source file's own schema — declaring them here too would just be a
-- second definition to keep in sync with the first.

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.raw_sample (
  spatial_unit_id uuid NOT NULL REFERENCES spatial_unit (id),
  criterion_id    text NOT NULL,
  source_id       text NOT NULL,
  raw_value       double precision NOT NULL,
  unit            text,
  PRIMARY KEY (spatial_unit_id, criterion_id)
);
