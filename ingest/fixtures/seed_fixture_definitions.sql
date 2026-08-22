-- SYNTHETIC FIXTURE — seeds a source and criterion_definition namespaced
-- `fixture-` / `fixture_` so they cannot collide with the real catalogue in
-- docs/domain/scoring-criteria.md. Never inserted outside `--fixture` runs.

INSERT INTO source (id, dataset, publisher, licence, redistributable, retrieved_at)
VALUES ('fixture-land-cover', 'Synthetic fixture land cover', 'sela dev fixtures', 'n/a — not real data', true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO criterion_definition (id, name_en, name_de, source_id, direction, weight, is_hard_constraint, applies_to, method_version)
VALUES (
  'fixture_land_cover_coverage',
  'Fixture land-cover coverage fraction',
  'Fixture-Bodenbedeckungsanteil',
  'fixture-land-cover',
  'higher_better',
  1.0,
  false,
  ARRAY['pv'],
  'fixture-v0'
)
ON CONFLICT (id) DO NOTHING;
