-- SYNTHETIC FIXTURE — seeds source and criterion_definition rows namespaced
-- `fixture-` / `fixture_` so they cannot collide with the real catalogue in
-- docs/domain/scoring-criteria.md. Never inserted outside `--fixture` runs.
--
-- Three source rows and four criteria (one per technology, plus one hard
-- constraint applying to all three) so Phase 3's screens can show all three
-- technologies varying independently and demonstrate the ADR-0004 exclusion
-- path — the original single-criterion, PV-only fixture could not.
-- Weights match lib/scoring/illustrative-weights.ts's ILLUSTRATIVE_EQUAL_WEIGHT.

INSERT INTO source (id, dataset, publisher, licence, redistributable, retrieved_at)
VALUES
  ('fixture-land-cover', 'Synthetic fixture land cover', 'sela dev fixtures', 'n/a — not real data', true, now()),
  ('fixture-wind-resource-map', 'Synthetic fixture wind resource map', 'sela dev fixtures', 'n/a — not real data', true, now()),
  ('fixture-protection-registry', 'Synthetic fixture protection-area registry', 'sela dev fixtures', 'n/a — not real data', true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO criterion_definition (id, name_en, name_de, source_id, direction, weight, is_hard_constraint, applies_to, method_version)
VALUES
  (
    'fixture_land_cover_coverage',
    'Fixture land-cover coverage fraction',
    'Fixture-Bodenbedeckungsanteil',
    'fixture-land-cover',
    'higher_better',
    1.0,
    false,
    ARRAY['pv'],
    'fixture-v0'
  ),
  (
    'fixture_agripv_suitability',
    'Fixture agrivoltaics suitability fraction',
    'Fixture-Agri-PV-Eignungsanteil',
    'fixture-land-cover',
    'higher_better',
    1.0,
    false,
    ARRAY['agripv'],
    'fixture-v0'
  ),
  (
    'fixture_wind_resource',
    'Fixture wind resource fraction',
    'Fixture-Windressourcenanteil',
    'fixture-wind-resource-map',
    'higher_better',
    1.0,
    false,
    ARRAY['wind'],
    'fixture-v0'
  ),
  (
    'fixture_protection_status',
    'Fixture protection-area flag',
    'Fixture-Schutzgebietskennzeichen',
    'fixture-protection-registry',
    'lower_better',
    1.0,
    true,
    ARRAY['pv', 'agripv', 'wind'],
    'fixture-v0'
  )
ON CONFLICT (id) DO NOTHING;
