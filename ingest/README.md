# `ingest/`

The GDAL + PostGIS SQL pipeline (roadmap §4.2). Per ADR-0002, this is where geometry and raster
math live — `lib/scoring/` never touches either.

```
ingest/
  sources.manifest.json          machine-readable mirror of docs/data/sources.md's status column
  00_staging_schema.sql          idempotent staging schema (staging.raw_sample only — see its header)
  01_fetch.sh <source_id>        fetch — gated on sources.manifest.json reading "confirmed"
  02_reproject.sh <in> <out>     reproject to EPSG:25832 (ogr2ogr, falls back to gdalwarp)
  03_load.sh <file> <table>      load into staging.<table> via ogr2ogr -f PostgreSQL
  04_generate_grid.sql           ST_HexagonGrid, clipped to the pilot boundary (ADR-0001)
  05_sample.sql                  sample/intersect onto cells — one example query per criterion
  05b_sample_illustrative_variation.sql  fixture-only: synthetic per-cell variation for the
                                  remaining fixture criteria (Phase 3, 0.3.0) — see fixtures/README.md
  06_write_criterion_values.sql  write criterion_value rows, each with its source_id
  07_materialize_scores.ts       Phase 3 (0.3.0), TypeScript-side, run separately (see below):
                                  calls lib/scoring/ to populate suitability_verdict/outcome
  run.sh [--fixture]             orchestrates 00-06, in order
  fixtures/                      synthetic data proving the pipeline works — see fixtures/README.md
```

## Real ingestion is currently blocked

`./run.sh` (no flags) is the real pipeline. It stops at the first `01_fetch.sh` call: every
candidate dataset in `docs/data/sources.md` is still `to_confirm` or `unconfirmed`, and
`docs/architecture/roadmap-to-first-deployment.md` §2.2 forbids ingesting a dataset whose
redistributability is unverified. This is by design, not a bug — `01_fetch.sh` reads
`sources.manifest.json` (kept in sync with `docs/data/sources.md` by hand) and refuses to make a
network call for anything not `confirmed`.

To un-block a dataset:

1. Read its licence terms in full at the publisher's own current page and confirm whether derived
   outputs may be published (`docs/data/sources.md`'s "What Confirmed requires" section).
2. Update that dataset's row in `docs/data/sources.md` to `Confirmed`, and its entry in
   `sources.manifest.json` to `"status": "confirmed"`, in the same change.
3. Write the dataset's real fetch command in `01_fetch.sh` (a WFS `GetFeature` request, a
   Geofabrik download URL, ...) — confirming a licence is necessary but not sufficient.

## Verifying the pipeline without real data

```sh
export DATABASE_URL=postgresql://sela:sela@localhost:5432/sela
./ingest/run.sh --fixture
```

Runs the identical reproject → load → generate-grid → sample → write sequence against
`ingest/fixtures/` — synthetic, clearly-labelled, non-real data — so the mechanics (idempotency,
CRS handling, hex clipping, area-weighted sampling, `source_id` propagation) can be exercised and
tested in CI independently of the licence gate above. See `ingest/fixtures/README.md`. This path
is never used against a real deployment.

## Materializing scores (Phase 3, `0.3.0`)

`run.sh` stops after writing `criterion_value` rows; `suitability_verdict` and `outcome` stay
empty until a separate step calls `lib/scoring/`. That step is TypeScript, not SQL or shell,
deliberately: per `docs/architecture/adr-0002-geodata-stack.md` this is arithmetic and comparison
over already-computed values, not geometry or raster math, so it does not belong in this
GDAL-based container (which has no Node runtime) — it runs from the app/builder image instead:

```sh
export DATABASE_URL=postgresql://sela:sela@localhost:5432/sela
pnpm db:materialize -- --pilot-region=fixture-region
```

Against the fixture dataset this uses `lib/scoring/illustrative-weights.ts` — an arbitrary,
explicitly-labelled weighting, not a real scoring decision. See that file's header and
`CHANGELOG.md` `[0.3.0]`.
