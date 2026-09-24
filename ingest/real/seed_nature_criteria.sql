-- Criterion definitions for the outcome methods of docs/domain/scoring-criteria.md §4
-- (peat-climate-ipcc2013-v1, water-arcegmo-v1), decided by the project owner on
-- 2026-09-24.
--
-- These are INPUTS TO OUTCOMES, not suitability criteria. They carry no weight:
-- weight is 0 and applies_to names scenarios, never a technology, so
-- lib/scoring/suitability.ts never reads them (it selects by technology) and the
-- method page's weighted table leaves them out. How each one enters an outcome
-- is stated by its method in lib/scoring/nature/, not by a weight.
--
-- direction is required by the schema. All are non_monotonic: none of these
-- numbers is "better" when higher on its own — more stored carbon is more at
-- stake, not a better site, and neither more percolation nor more root-zone
-- moisture is better in general (§4.2).

INSERT INTO criterion_definition (id, name_en, name_de, source_id, direction, weight, is_hard_constraint, applies_to, unit, method_version)
VALUES
  ('peat_share', 'Share of the cell on peat soil (LBGR 2021)', 'Flächenanteil Moorboden (LBGR 2021)',
   'lbgr-bb-moorbodenkarte', 'non_monotonic', 0, false, ARRAY['status_quo', 'preserve', 'restore'], 'Flächenanteil', 'nature-v1'),
  ('peat_organic_unassessed_share', 'Share on Moorgley, Anmoorgley or unclassified soil (not modelled in v1)',
   'Flächenanteil Moor-/Anmoorgley oder unklassifiziert (in v1 nicht modelliert)',
   'lbgr-bb-moorbodenkarte', 'non_monotonic', 0, false, ARRAY['status_quo', 'preserve', 'restore'], 'Flächenanteil', 'nature-v1'),
  ('peat_carbon_stock', 'Organic carbon stock in peat soil, 2021 potential (LBGR)', 'Kohlenstoffvorrat im Moorboden, potentiell 2021 (LBGR)',
   'lbgr-bb-moorbodenkarte', 'non_monotonic', 0, false, ARRAY['status_quo', 'preserve', 'restore'], 't C/ha', 'nature-v1'),
  ('water_percolation', 'Percolation, 1991–2020 mean (ArcEGMO)', 'Versickerung, Mittel 1991–2020 (ArcEGMO)',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['status_quo', 'preserve', 'restore'], 'mm/a', 'nature-v1'),
  ('water_root_zone_moisture', 'Root-zone soil moisture to 150 cm, 1991–2020 mean (ArcEGMO)',
   'Bodenfeuchte in der Wurzelzone bis 150 cm, Mittel 1991–2020 (ArcEGMO)',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['status_quo', 'preserve', 'restore'], '%nFK', 'nature-v1'),
  ('water_wet_ref_percolation', 'Percolation of wet peatlands in the region, median (approximation)',
   'Versickerung feuchter Moore in der Region, Median (Näherung)',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['restore'], 'mm/a', 'nature-v1'),
  ('water_wet_ref_percolation_p25', 'Percolation of wet peatlands in the region, lower quartile',
   'Versickerung feuchter Moore in der Region, unteres Quartil',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['restore'], 'mm/a', 'nature-v1'),
  ('water_wet_ref_percolation_p75', 'Percolation of wet peatlands in the region, upper quartile',
   'Versickerung feuchter Moore in der Region, oberes Quartil',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['restore'], 'mm/a', 'nature-v1'),
  ('water_wet_ref_moisture', 'Root-zone soil moisture of wet peatlands in the region, median (approximation)',
   'Bodenfeuchte feuchter Moore in der Region, Median (Näherung)',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['restore'], '%nFK', 'nature-v1'),
  ('water_wet_ref_moisture_p25', 'Root-zone soil moisture of wet peatlands in the region, lower quartile',
   'Bodenfeuchte feuchter Moore in der Region, unteres Quartil',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['restore'], '%nFK', 'nature-v1'),
  ('water_wet_ref_moisture_p75', 'Root-zone soil moisture of wet peatlands in the region, upper quartile',
   'Bodenfeuchte feuchter Moore in der Region, oberes Quartil',
   'lfu-bb-wasserhaushalt', 'non_monotonic', 0, false, ARRAY['restore'], '%nFK', 'nature-v1')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en, name_de = EXCLUDED.name_de, source_id = EXCLUDED.source_id,
  direction = EXCLUDED.direction, weight = EXCLUDED.weight, is_hard_constraint = EXCLUDED.is_hard_constraint,
  applies_to = EXCLUDED.applies_to, unit = EXCLUDED.unit, method_version = EXCLUDED.method_version;
