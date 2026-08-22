# Roadmap — from planning documents to a deployable web app

**Version band:** `0.2.x` → `0.3.0` · **Status:** agreed · **Last updated:** 2026-08-22

This document plans the route from the `0.1.0` planning artefacts to a sela that runs with
`docker compose up` and serves real land in a real German pilot region. It refines
`docs/product/mvp.md`; it does not widen it.

---

## 1. Where we start

The repository holds planning documents only. No stack had been chosen, and four questions
inside the `CLAUDE.md` §3 confirmation gate blocked any implementation. They are now decided.

| Decision | Choice | Closes |
|---|---|---|
| Stack | Full TypeScript — Next.js (App Router), PostGIS, MapLibre GL | ADR-0002 |
| First deployable | Real pilot-region data from the start — no mock scoring | — |
| Spatial unit | Generated grid, behind an abstraction so `Flurstück` is an addition, not a rewrite | U1 |
| Basemap | Self-hosted PMTiles (OSM-derived), styled desaturated in-repo | U8 |

The target is a `docker compose up` that serves a usable sela: a map of a pilot region where a
user selects land, sees all four scenarios compared on identical dimensions, and can click any
number down to its source, licence, weight and confidence.

Three phases follow. **Phase 1 already ends in a Docker-deployable app** — an empty one. The
container path is proven on day one rather than discovered to be broken at the end.

## 2. Two risks, stated up front

### 2.1 TypeScript is weakest exactly where "real data from the start" is heaviest

Raster sampling and vector reprojection have no serious TypeScript ecosystem. The mitigation is
architectural, not heroic:

> **TypeScript never computes geometry or raster math.**

A separate `ingest` container runs GDAL command-line tools (`ogr2ogr`, `gdalwarp`,
`gdal_translate`) and PostGIS SQL. TypeScript orchestrates the steps and reads the results. If
that boundary holds, the stack choice costs nothing. If it leaks, Phase 2 stalls. This is
recorded as a binding rule in ADR-0002, not as a preference.

### 2.2 Choosing real data puts U7 on the critical path

We cannot ingest a dataset whose redistributability is unverified — `CLAUDE.md` §5 forbids even
asserting a licence we have not checked. Therefore `docs/data/sources.md` is a **Phase 1**
deliverable that **gates Phase 2**, and only datasets with a verified open licence enter the
pilot.

### 2.3 Stated assumption — the pilot region

The pilot is one *Landkreis* in Brandenburg: high real PV and wind pressure, good state open
data. The region is a single config value plus a boundary polygon; changing it is a re-run of
ingestion, not a code change. Confirm or substitute at the start of Phase 2.

---

## 3. Phase 1 — Decide, record, and stand up the box (`0.2.0`)

**Done when:** `docker compose up` on a clean machine serves a Next.js page and a migrated
PostGIS database, and every architectural decision behind it is written down.

### 3.1 Decisions of record

| File | Content |
|---|---|
| `docs/architecture/adr-0001-spatial-unit.md` | Generated 100 m hex grid via PostGIS `ST_HexagonGrid`, clipped to the pilot boundary. Records what is given up: **a grid cell is not what a municipality names in a council session** (`mvp.md` §2). The `spatial_unit` abstraction is the mitigation; the ALKIS per-*Bundesland* fee barrier is the reason. Closes **U1**. |
| `docs/architecture/adr-0002-geodata-stack.md` | Next.js + PostGIS + MapLibre, and the TypeScript/geoprocessing boundary from §2.1 as a binding rule. |
| `docs/architecture/adr-0003-basemap.md` | Self-hosted PMTiles. ODbL attribution duty on every screen *and* every export. Glyphs and sprites self-hosted too — a container that fetches fonts from a CDN is not self-contained. Closes **U8**. |
| `docs/domain/glossary.md` | DE/EN vocabulary: parcel, spatial unit, scenario, criterion, outcome dimension, confidence. |
| `docs/data/sources.md` | **The gate on Phase 2.** One row per dataset: publisher, version, retrieval date, resolution, coverage, licence, and whether derived outputs may be redistributed. |

Candidates carried into the inventory, with the licence position established so far:

| Dataset | Use | Licence position |
|---|---|---|
| BfN Schutzgebiete (WFS, `geodienste.bfn.de/ogc/wfs/schutzgebiet`) | Protection areas → hard constraints | dl-de/by-2-0 |
| BKG CORINE Land Cover 5 ha 2018 (CLC5) | Land cover, current use | dl-de/by-2-0 |
| OSM via Geofabrik | Basemap; settlements for wind setbacks | ODbL |
| DWD CDC radiation grids (1 km, annual global radiation) | Solar irradiation | **To confirm before ingest** — terms not yet read in full |

CLC5's 2018 vintage is recorded as a stated data-currency limitation rather than passing
silently.

### 3.2 The application skeleton

```
app/                    Next.js App Router
  (map)/                map explorer route group
  method/               method page
  api/
lib/
  db/                   schema + SQL migrations
  scoring/              pure scoring functions (Phase 2)
  design/tokens.ts      semantic tokens from design-language §4.2
ingest/                 GDAL + SQL pipeline (Phase 2)
docker/
  Dockerfile            multi-stage, next.config output:'standalone'
  Dockerfile.ingest     GDAL-based, run-once not long-lived
compose.yaml            app · db (postgis/postgis:16-3.4) · ingest (profile)
```

**Design tokens land in Phase 1, not later.** `design-language.md` §10 requires components to be
written against roles (`--scenario-preserve`, `--surface-1`), never raw hex. Introducing tokens
after the first components exist means rewriting them. The §4.2 palette is defined in both
modes, including the non-colour encodings — hatch, crosshatch, solid, stipple — which §4.3
establishes are what make the palette *legal* rather than decorative.

**Verification:** clean clone → `docker compose up` → app responds, migrations applied, PostGIS
enabled. `docker compose down -v && docker compose up` reproduces it.

---

## 4. Phase 2 — Real land, real numbers, no interface yet (`0.2.1`)

**Done when:** for a real cell in the pilot *Landkreis*, an API response returns all four
scenarios across the shared outcome dimensions, and every number carries a criterion with a
source, licence, weight and confidence.

Keeping this phase headless is deliberate: it makes the scoring testable in isolation, before
any pixel can hide a gap in it.

### 4.1 Schema — where the product principles become constraints

The load-bearing idea: **the rules in `CLAUDE.md` are enforced by the database, not by
discipline.**

| Table | Columns of note | The rule it makes unviolatable |
|---|---|---|
| `source` | dataset, publisher, version, retrieved_at, licence, `redistributable` | — |
| `criterion_definition` | id, name_en, name_de, `source_id`, direction, weight, applies_to | — |
| `criterion_value` | spatial_unit_id, criterion_id, value, unit, confidence | `source_id NOT NULL` ⇒ *"a criterion without a source and licence does not enter a score"* (`mvp.md` §8.2) |
| `outcome` | spatial_unit_id, scenario, dimension, value, unit, confidence, `status` | `status ∈ ('modelled','not_modelled')` ⇒ *"not yet modelled"* is a real state, never zero, never silently omitted (`mvp.md` §8.3, `design-language.md` §8) |
| `spatial_unit` | id, `kind`, geom | `kind` is what makes `Flurstück` an added row type rather than a migration |

Storage in EPSG:25832 (ETRS89 / UTM 32N) for metric operations; served as EPSG:4326/3857.
Scenarios: `status_quo`, `develop_pv`, `develop_agripv`, `develop_wind`, `preserve`, `restore`.

### 4.2 Ingestion

`ingest/` is a sequence of numbered, individually re-runnable steps:

1. fetch (separate from load, so the pipeline re-runs offline)
2. reproject with GDAL
3. load to PostGIS
4. generate the hex grid — `ST_HexagonGrid` clipped to the pilot boundary
5. sample rasters and intersect vectors onto cells
6. write `criterion_value` rows with their `source_id`

Each step is idempotent, so one failed dataset does not force a full re-run.

### 4.3 Scoring

Pure TypeScript functions in `lib/scoring/` — no I/O, no database. Input: criterion values.
Output: per-technology suitability, **the single limiting criterion** (flow F2), and outcome
deltas against the `status_quo` baseline. Every output row records a `method_version`.

Two open questions must close here:

- **U4 — hard constraints as filters or as scored penalties.** Recommendation: *filter, with the
  reason surfaced*. A cell inside a Naturschutzgebiet returns "excluded", naming the constraint,
  rather than a low score. A low score invites arguing the weight; an exclusion states the law.
  Record as ADR-0004 — it changes both the interface and sela's legal exposure.
- **U2 — nature-capital indicators.** Ship only what is citable to an established method. Where
  an indicator is not defensible for v0.1 it is `not_modelled`, which §4.1 already makes a
  first-class answer rather than a gap.

**Verification:** unit tests over the scoring functions including the limiting-criterion logic
and the `not_modelled` path; an integration test asserting that no `outcome` row traces to a
`criterion_value` without a source; manual inspection of a known cell.

---

## 5. Phase 3 — The deployable web app (`0.3.0`)

**Done when:** `docker compose up` on a clean machine gives a usable sela — and a screenshot of
the comparison screen could be published in an article without redesign
(`design-language.md` §12).

### 5.1 Screens (`mvp.md` §7)

| Screen | Route | Note |
|---|---|---|
| Map explorer | `/` | Map-first: the map is the surface, not a widget. Near-empty on first load. |
| Parcel detail | `/unit/[id]` | Verdicts with the limiting criterion visible **without scrolling**. |
| Scenario comparison | `/unit/[id]/compare` | The centrepiece. Four scenarios, identical dimensions. |
| Evidence view | `/criterion/[id]` | Reachable from **every** displayed value — flow F4 with no dead ends. |
| Method page | `/method` | Rendered from the same `criterion_definition` rows the scoring reads, so it cannot drift from the code in effect. |

### 5.2 Basemap

The PMTiles archive is baked into the image and served by a Next route handler that reads the
archive with the `pmtiles` package and returns individual `z/x/y` tiles. This avoids HTTP Range
plumbing and keeps the deployment to one application container. The style JSON is authored
in-repo and desaturated per `design-language.md` §4.1; glyphs and sprites are self-hosted.

### 5.3 Export (flow F5)

Scenario card at 1200×630 and 1:1 via `next/og` — no headless browser in the production image.
The provenance footer is generated from the same `source` rows, and the route **returns an error
rather than an image when provenance is missing**. This implements *"a card that cannot cite
itself must not render"* (`design-language.md` §7) as behaviour rather than as a note.

### 5.4 The two bars that are usually deferred, and will not be

- **Greyscale.** `design-language.md` §4.3 measured green, blue and status-quo grey collapsing to
  within 4 percentage points of each other in monochrome. A test renders the export, converts it
  to greyscale, and asserts the scenario fills remain distinguishable. Council packets get
  photocopied; this is the moment that matters.
- **Accessibility.** Automated WCAG 2.2 AA checks on every screen, an explicit keyboard path to
  map selection (§9 — a map that only answers a mouse excludes the people the tool is explicitly
  for), and a reachable table view from every chart.

**Verification, end to end:** clean clone → `docker compose up` → run the ingest profile → open
the app → select a real cell → see all four scenarios → click any number → reach its source and
licence → export a card → convert it to greyscale and read it. Browser tests cover this path,
with the greyscale and accessibility assertions in the same suite.

---

## 6. What these phases do not touch

Open questions that stay open, and are not resolved by assumption:

| # | Question | Status after Phase 3 |
|---|---|---|
| U1 | Spatial unit | Closed — ADR-0001 |
| U2 | Nature-capital indicators | Partially closed — what is defensible ships, the rest is `not_modelled` |
| U3 | Grid-connection capacity in scope | Open |
| U4 | Constraints as filters or penalties | Closed — ADR-0004 |
| U5 | Anonymous vs. account-gated | Open |
| U6 | Disclaimer posture | Open — but the advisory disclaimer appears on the comparison screen and on every export from Phase 3 onward, rather than being added before launch |
| U7 | Per-source licensing | Closed for the pilot datasets only |
| U8 | Basemap provider | Closed — ADR-0003 |
| U9 | Wordmark and public name | Open |
