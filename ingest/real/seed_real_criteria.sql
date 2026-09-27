-- Criterion definitions for the real pilot-region ingest (ingest/real/).
--
-- ILLUSTRATIVE WEIGHTS ON REAL MEASUREMENTS, WITH THE STEP 1 RULES DECIDED.
-- On 2026-09-23 the project owner chose to run illustrative scoring on the real
-- Uckermark data rather than leave the region unscored; on 2026-09-27 they
-- decided the four placeholder rules underneath it (roadmap Step 1,
-- docs/domain/decision-memo-scoring-rules.md). These rows carry both:
--
--   * every VALUE these criteria read is a real, sourced measurement;
--   * decided (lib/scoring/pv-rules.ts): only Naturschutzgebiete and the
--     Nationalpark exclude, from half the cell on; irradiation on national
--     p1–p99 bounds; land cover as three tiers — a *category*, not a score;
--   * still placeholders (lib/scoring/illustrative-weights.ts): every WEIGHT
--     (1.0 each), the slope bounds and the suitability threshold — the
--     interface says so on every screen;
--   * method_version 'illustrative-real-v1' marks this set. 'illustrative-real-v1'
--     (the first run, with a graded land-cover score) is recorded in
--     docs/domain/scoring-criteria.md §6; confirmed weights get their own version.
--
-- Criteria follow the catalogue's ids, directions and hard-constraint flags.
-- pv_* criteria apply to agrivoltaics too (catalogue §2: "all PV criteria
-- above apply"), so without an agri-PV-specific criterion the two verdicts
-- coincide — that is stated in the interface rather than disguised.
-- Wind gets only its protection-area exclusion: wind resource has no
-- identified source yet, so wind is never scored, only ever excluded.

INSERT INTO criterion_definition (id, name_en, name_de, source_id, direction, weight, is_hard_constraint, is_category, applies_to, unit, method_version)
VALUES
  ('pv_irradiation_annual', 'Annual solar irradiation (2016–2025 mean)', 'Jährliche Globalstrahlung (Mittel 2016–2025)',
   'dwd-cdc-radiation', 'higher_better', 1.0, false, false, ARRAY['pv', 'agripv'], 'kWh/m²·a', 'illustrative-real-v1'),
  ('pv_land_cover', 'Current land-cover class (dominant CLC5 class), in three tiers', 'Aktuelle Bodenbedeckung (vorherrschende CLC5-Klasse), in drei Stufen',
   'bkg-clc5', 'non_monotonic', 0, false, true, ARRAY['pv', 'agripv'], 'CLC-Klasse', 'illustrative-real-v1'),
  ('pv_slope', 'Terrain slope (DGM200)', 'Geländeneigung (DGM200)',
   'bkg-dgm200', 'lower_better', 1.0, false, false, ARRAY['pv', 'agripv'], '°', 'illustrative-real-v1'),
  ('pv_protection_status', 'Protected-area exclusion (nature reserve, national park)', 'Schutzgebietsausschluss (Naturschutzgebiet, Nationalpark)',
   'lfu-bb-schutzgebiete', 'lower_better', 1.0, true, false, ARRAY['pv', 'agripv'], 'Flächenanteil', 'illustrative-real-v1'),
  ('wind_protection_status', 'Protected-area exclusion (nature reserve, national park)', 'Schutzgebietsausschluss (Naturschutzgebiet, Nationalpark)',
   'lfu-bb-schutzgebiete', 'lower_better', 1.0, true, false, ARRAY['wind'], 'Flächenanteil', 'illustrative-real-v1')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en, name_de = EXCLUDED.name_de, source_id = EXCLUDED.source_id,
  direction = EXCLUDED.direction, weight = EXCLUDED.weight, is_hard_constraint = EXCLUDED.is_hard_constraint, is_category = EXCLUDED.is_category,
  applies_to = EXCLUDED.applies_to, unit = EXCLUDED.unit, method_version = EXCLUDED.method_version;
