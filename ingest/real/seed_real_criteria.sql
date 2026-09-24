-- Criterion definitions for the real pilot-region ingest (ingest/real/).
--
-- ILLUSTRATIVE WEIGHTS ON REAL MEASUREMENTS. The project owner decided on
-- 2026-09-23 (CLAUDE.md §3 gate) to run the illustrative scoring on the real
-- Uckermark data rather than leave the region unscored. That decision is what
-- these rows carry out, and it is also exactly what they must not hide:
--
--   * every VALUE these criteria read is a real, sourced measurement;
--   * every WEIGHT (1.0 each), the normalisation bounds and the suitability
--     threshold (lib/scoring/illustrative-weights.ts) are placeholders, as
--     arbitrary as the fixture's, and the interface says so on every screen;
--   * method_version 'illustrative-real-v0' marks them — a real, confirmed
--     weight set gets its own version, not an edit of these rows.
--
-- docs/domain/scoring-criteria.md still lists every weight as open. Nothing
-- here closes it.
--
-- Criteria follow the catalogue's ids, directions and hard-constraint flags.
-- pv_* criteria apply to agrivoltaics too (catalogue §2: "all PV criteria
-- above apply"), so without an agri-PV-specific criterion the two verdicts
-- coincide — that is stated in the interface rather than disguised.
-- Wind gets only its protection-area exclusion: wind resource has no
-- identified source yet, so wind is never scored, only ever excluded.

INSERT INTO criterion_definition (id, name_en, name_de, source_id, direction, weight, is_hard_constraint, applies_to, unit, method_version)
VALUES
  ('pv_irradiation_annual', 'Annual solar irradiation (2016–2025 mean)', 'Jährliche Globalstrahlung (Mittel 2016–2025)',
   'dwd-cdc-radiation', 'higher_better', 1.0, false, ARRAY['pv', 'agripv'], 'kWh/m²·a', 'illustrative-real-v0'),
  ('pv_land_cover', 'Current land-cover class (dominant CLC5 class)', 'Aktuelle Bodenbedeckung (vorherrschende CLC5-Klasse)',
   'bkg-clc5', 'non_monotonic', 1.0, false, ARRAY['pv', 'agripv'], 'CLC-Klasse', 'illustrative-real-v0'),
  ('pv_slope', 'Terrain slope (DGM200)', 'Geländeneigung (DGM200)',
   'bkg-dgm200', 'lower_better', 1.0, false, ARRAY['pv', 'agripv'], '°', 'illustrative-real-v0'),
  ('pv_protection_status', 'Protected-area exclusion (nature reserve, national park)', 'Schutzgebietsausschluss (Naturschutzgebiet, Nationalpark)',
   'lfu-bb-schutzgebiete', 'lower_better', 1.0, true, ARRAY['pv', 'agripv'], 'Flächenanteil', 'illustrative-real-v0'),
  ('wind_protection_status', 'Protected-area exclusion (nature reserve, national park)', 'Schutzgebietsausschluss (Naturschutzgebiet, Nationalpark)',
   'lfu-bb-schutzgebiete', 'lower_better', 1.0, true, ARRAY['wind'], 'Flächenanteil', 'illustrative-real-v0')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en, name_de = EXCLUDED.name_de, source_id = EXCLUDED.source_id,
  direction = EXCLUDED.direction, weight = EXCLUDED.weight, is_hard_constraint = EXCLUDED.is_hard_constraint,
  applies_to = EXCLUDED.applies_to, unit = EXCLUDED.unit, method_version = EXCLUDED.method_version;
