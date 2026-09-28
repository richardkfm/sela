-- Criterion definitions for the real pilot-region ingest (ingest/real/).
--
-- THE FIRST CONFIRMED PV METHOD, real-pv-v1 (roadmap Step 2, decided by the
-- project owner on 2026-09-28; docs/domain/decision-memo-pv-method.md). PV is
-- classified, never scored:
--
--   * every VALUE these criteria read is a real, sourced measurement;
--   * Naturschutzgebiete and the Nationalpark exclude, from half the cell on
--     (Step 1, memo Q1c/Q2d);
--   * land cover is a *category* in three written tiers — it places the cell
--     as nicht vorgesehen / eingeschränkt / ohne Einschränkung (Step 1, Q3b);
--   * irradiation and slope carry WEIGHT 0: they are shown as measured values
--     (irradiation with its national quartile, slope at low confidence), never
--     combined into a score — no citable weight or threshold exists, and the
--     measured verdicts swung from 0 % to 100 % with plausible parameters.
--
-- 'illustrative-real-v0' (graded land-cover score) and 'illustrative-real-v1'
-- (Step 1 rules under an illustrative score) are recorded in
-- docs/domain/scoring-criteria.md §6.
--
-- pv_* criteria apply to agrivoltaics too (catalogue §2), so without an
-- agri-PV-specific criterion the two coincide — stated in the interface.
-- Wind gets only its protection-area exclusion: wind resource has no
-- identified source yet, so wind is never scored, only ever excluded.

INSERT INTO criterion_definition (id, name_en, name_de, source_id, direction, weight, is_hard_constraint, is_category, applies_to, unit, method_version)
VALUES
  ('pv_irradiation_annual', 'Annual solar irradiation (2016–2025 mean)', 'Jährliche Globalstrahlung (Mittel 2016–2025)',
   'dwd-cdc-radiation', 'higher_better', 0, false, false, ARRAY['pv', 'agripv'], 'kWh/m²·a', 'real-pv-v1'),
  ('pv_land_cover', 'Current land-cover class (dominant CLC5 class), in three tiers', 'Aktuelle Bodenbedeckung (vorherrschende CLC5-Klasse), in drei Stufen',
   'bkg-clc5', 'non_monotonic', 0, false, true, ARRAY['pv', 'agripv'], 'CLC-Klasse', 'real-pv-v1'),
  ('pv_slope', 'Terrain slope (DGM200)', 'Geländeneigung (DGM200)',
   'bkg-dgm200', 'lower_better', 0, false, false, ARRAY['pv', 'agripv'], '°', 'real-pv-v1'),
  ('pv_protection_status', 'Protected-area exclusion (nature reserve, national park)', 'Schutzgebietsausschluss (Naturschutzgebiet, Nationalpark)',
   'lfu-bb-schutzgebiete', 'lower_better', 1.0, true, false, ARRAY['pv', 'agripv'], 'Flächenanteil', 'real-pv-v1'),
  ('wind_protection_status', 'Protected-area exclusion (nature reserve, national park)', 'Schutzgebietsausschluss (Naturschutzgebiet, Nationalpark)',
   'lfu-bb-schutzgebiete', 'lower_better', 1.0, true, false, ARRAY['wind'], 'Flächenanteil', 'real-exclusion-v1')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en, name_de = EXCLUDED.name_de, source_id = EXCLUDED.source_id,
  direction = EXCLUDED.direction, weight = EXCLUDED.weight, is_hard_constraint = EXCLUDED.is_hard_constraint, is_category = EXCLUDED.is_category,
  applies_to = EXCLUDED.applies_to, unit = EXCLUDED.unit, method_version = EXCLUDED.method_version;
