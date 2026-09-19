# `ingest/`

The GDAL + PostGIS SQL pipeline (roadmap §4.2). Per ADR-0002, this is where geometry and raster
math live — `lib/scoring/` never touches either.

```
ingest/
  sources.manifest.json          machine-readable mirror of docs/data/sources.md's status column,
                                  plus the pinned artefact (URL, byte count, Last-Modified) per
                                  confirmed source
  00_staging_schema.sql          idempotent staging schema (staging.raw_sample only — see its header)
  01_fetch.sh <source_id>        fetch — gated on sources.manifest.json reading "confirmed";
                                  writes data/raw/<source_id>/ + fetch-provenance.json
  02_reproject.sh <in> <out>     reproject to EPSG:25832 (ogr2ogr, falls back to gdalwarp)
  02b_extract_pilot_boundary.sh  cut one Landkreis out of the fetched VG25 archive
  pilot/                         the real pilot-region boundary — see pilot/README.md
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

## Real ingestion is partially open

`./run.sh` (no flags) is the real pipeline. As of 2026-09-19 it fetches two of the four candidate
datasets and reports the other two as skipped:

| Source id | Status | |
|---|---|---|
| `bkg-clc5` | `confirmed` | fetched — `dl-de/by-2-0`, no share-alike |
| `bkg-vg25` | `confirmed` | fetched — **CC BY 4.0** (not `dl-de/by-2-0`; same publisher, different licence), supplies the pilot boundary |
| `dwd-cdc-radiation` | `confirmed` | fetched — CC BY 4.0, no share-alike |
| `bfn-schutzgebiete` | `to_confirm` | licence cleared (GeoNutzV); `geodienste.bfn.de` returns 403 |
| `osm-geofabrik` | `to_confirm` | ODbL share-alike decision open — `docs/data/sources.md` §4 |

`docs/architecture/roadmap-to-first-deployment.md` §2.2 forbids ingesting a dataset whose
redistributability is unverified, so `01_fetch.sh` reads `sources.manifest.json` (kept in sync with
`docs/data/sources.md` by hand) and refuses to make a network call for anything not `confirmed`.
A gated source is **skipped, not fatal** — `run.sh` continues and prints a summary, so a
partially-confirmed manifest is still a usable pipeline.

`01_fetch.sh` exit codes, which `run.sh` distinguishes:

| Code | Meaning | `run.sh` |
|---|---|---|
| 0 | fetched, or already present and verified | counted as fetched |
| 1 | blocked by the licence gate | skipped |
| 2 | unknown source id | aborts |
| 3 | confirmed, but no fetch implemented yet | skipped |
| 4 | the artefact returned does not match the pinned one | aborts |

Exit 4 is the one that matters most: a publisher re-issuing a file under the same URL would
otherwise change sela's inputs silently. `01_fetch.sh` compares byte count (and `Last-Modified`
where pinned) against `sources.manifest.json` **before** writing anything, and every fetch records
each artefact's sha256 in `data/raw/<source_id>/fetch-provenance.json`.

Fetched data lands in `data/raw/`, which is git-ignored. **Being fetched is not being publishable**
— `docs/data/sources.md` §7 condition 4 requires each source's *Quellenvermerk* to be rendered in
the interface before its data reaches a public screen.

To un-block a dataset:

1. Read its licence terms in full at the publisher's own current page and confirm whether derived
   outputs may be published (`docs/data/sources.md`'s "What Confirmed requires" section).
2. Update that dataset's row in `docs/data/sources.md` to `Confirmed`, and its entry in
   `sources.manifest.json` to `"status": "confirmed"`, in the same change.
3. Give it a `fetch` block in `sources.manifest.json` pinning the exact artefact. Two shapes exist
   so far — `single-file` (one URL, `pinnedBytes`, `pinnedLastModified`) and `annual-series` (a
   filename template over a year range). A source that fits neither (a WFS `GetFeature` request,
   for instance) needs a new `kind` handled in `01_fetch.sh`'s `case`; confirming a licence is
   necessary but not sufficient.
4. Pin deliberately. `pinnedBytes` is what makes exit 4 possible, and a source pinned to nothing
   is a source that can change under you between runs without anyone noticing.

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
