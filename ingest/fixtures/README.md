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
| `seed_fixture_definitions.sql` | A `fixture-land-cover` source row and a `fixture_land_cover_coverage` criterion_definition, weight 1, not a hard constraint |
