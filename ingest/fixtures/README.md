# `ingest/fixtures/`

**Synthetic data. None of this is real.** Every geometry, class code, and value in this directory
is a hand-authored stand-in for a pilot-region dataset, used only to prove the ingestion pipeline's
mechanics (reprojection, grid generation, sampling, writing sourced `criterion_value` rows) end to
end without depending on a dataset whose licence hasn't been confirmed yet.

This exists because `docs/data/sources.md` gates real ingestion — as of this writing, no candidate
dataset's licence position reads **Confirmed** — and `docs/architecture/roadmap-to-first-deployment.md`
§2.2 forbids ingesting a dataset whose redistributability is unverified. `CLAUDE.md` §5 forbids
even asserting a licence that has not been verified. Using a fixture instead of a real dataset is
how Phase 2's schema, grid generation, sampling, and scoring machinery can be built and tested now
without pretending the licence gate has closed.

**Rules for anything in this directory:**

- Never used by `ingest/run.sh` except with the explicit `--fixture` flag.
- Never loaded into a deployed database — `--fixture` is a local/CI development path, not part of
  `docker compose --profile ingest run ingest`'s default (real) invocation.
- Geometry is deliberately arbitrary, round-numbered, and chosen so it cannot be mistaken for a
  real place (see each file's own header comment).
- Criterion and source ids are prefixed `fixture_` / `fixture-` specifically so they cannot collide
  with the real catalogue in `docs/domain/scoring-criteria.md`.

| File | Contents |
|---|---|
| `pilot_boundary.geojson` | A synthetic ~1.1 km × 1.1 km boundary polygon at "null island" (0,0), EPSG:4326 |
| `land_cover_sample.geojson` | A synthetic land-cover-shaped polygon nested inside the boundary, same CRS and location, so the two genuinely overlap once both are reprojected by the same `02_reproject.sh` step a real vector source would go through |
| `seed_fixture_definitions.sql` | Three source rows and four criterion_definition rows, weight 1 each: `fixture_land_cover_coverage` (pv), `fixture_agripv_suitability` (agripv), `fixture_wind_resource` (wind), and `fixture_protection_status` — a hard constraint applying to all three, so the ADR-0004 exclusion path is exercised |

### Phase 3 (`0.3.0`) additions

`ingest/05b_sample_illustrative_variation.sql` (invoked by `run.sh --fixture` alongside
`05_sample.sql`) derives the `fixture_agripv_suitability`, `fixture_wind_resource`, and
`fixture_protection_status` values deterministically from each hex cell's centroid position within
the fixture boundary's own bounding box — never `random()`, so idempotency holds. The cell(s)
nearest the boundary's origin corner are flagged as protected, so at least one unit demonstrates
`verdict = 'excluded'` once `ingest/07_materialize_scores.ts` runs. All of this stays inside the
existing `fixture_` / `fixture-` namespace and the null-island boundary — nothing here makes the
fixture look more like a real pilot region.
