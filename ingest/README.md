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
  06_write_criterion_values.sql  write criterion_value rows, each with its source_id
  run.sh [--fixture]             orchestrates the above, in order
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
