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
  run.sh [--fixture]             real: fetch, seed, then real/ (below); --fixture: 00-06 on fixtures/
  real/                          the real pilot-region pipeline (boundary, CLC5, DWD, DGM200,
                                  LfU protection → criterion_value) — see real/README.md
  seed_real_sources.sql          source rows and their verified Quellenvermerke
  fixtures/                      synthetic data proving the pipeline works — see fixtures/README.md
```

## Real ingestion

`./run.sh` (no flags) is the real pipeline, end to end, for `PILOT_REGION` (default
`uckermark-12073`). As of 2026-09-23 it fetches five sources, skips two, and writes
`criterion_value` rows for four criteria (`real/README.md`):

| Source id | Status | |
|---|---|---|
| `bkg-clc5` | `confirmed` | fetched and ingested — `pv_land_cover`; `dl-de/by-2-0`, no share-alike |
| `bkg-vg25` | `confirmed` | fetched — **CC BY 4.0** (not `dl-de/by-2-0`; same publisher, different licence), supplies the pilot boundary |
| `dwd-cdc-radiation` | `confirmed` | fetched and ingested — `pv_irradiation_annual`; CC BY 4.0, no share-alike |
| `bkg-dgm200` | `confirmed` | fetched and ingested — `pv_slope`; `dl-de/by-2-0`, pinned by the publisher's md5 |
| `lfu-bb-schutzgebiete` | `confirmed` | fetched (WFS) and ingested — both protection exclusions, Brandenburg only; `dl-de/by-2-0` |
| `bfn-schutzgebiete` | `to_confirm` | licence cleared (GeoNutzV); `geodienste.bfn.de` returns 403. Substituted by LfU for the pilot |
| `osm-geofabrik` | **`withdrawn`** | ADR-0005: OSM left the stack. Not unconfirmed — deliberately not used |

A full run from nothing downloads ≈ 1 GB and takes a few minutes on top of that; the per-cell
sampling (`real/20_sample.sql`) takes about 75 s for the Uckermark's 117 191 cells. The grid step
takes a per-region advisory lock, so two concurrent runs cannot duplicate the grid (this happened
once — `docs/data/sources.md` §6).

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
| 5 | the transfer itself failed (e.g. a WFS response cut off); the previous files are left in place | aborts |

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
3. Give it a `fetch` block in `sources.manifest.json` pinning the exact artefact. Three shapes
   exist — `single-file` (one URL, `pinnedBytes`, and `pinnedLastModified` or `publisherMd5`),
   `annual-series` (a filename template over a year range), and `wfs` (an endpoint, layer names
   and a WGS 84 bbox; each layer lands in its own GeoPackage, with its feature count and sha256 in
   the provenance file). A source that fits none needs a new `kind` handled in `01_fetch.sh`'s
   `case`; confirming a licence is necessary but not sufficient.
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

For the real region the same step runs the same illustrative weighting on real measurements
(`docs/domain/scoring-criteria.md` §6):

```sh
pnpm db:materialize -- --pilot-region=uckermark-12073
```

`--outcomes=illustrative|none` decides whether the illustrative *outcome* generator runs. It
defaults to `illustrative` for the fixture and `none` for every other region: invented gains
against real land would be a claim about that land, so the real region's comparison shows *noch
nicht modelliert* instead. Verdicts are replaced per region in one transaction, in batches of
5 000, so a failed run leaves the previous verdicts in place.
