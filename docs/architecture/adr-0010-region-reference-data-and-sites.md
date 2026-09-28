# ADR-0010 — Region reference tables, an energy method, sites of several cells, and the ingest image base

**Status:** Accepted under the owner's delegation of 2026-09-28, pending confirmation in review ·
**Band:** `0.3.x` · **Date:** 2026-09-28 · **Amends:** the schema (migrations
`0008_municipality.sql`, `0009_habitat_overlap.sql`), `lib/scoring/nature/method.ts`,
`docker/Dockerfile.ingest`

---

## Context

Roadmap Steps 3–6 (`docs/product/roadmap-pilot-demo.md`) were implemented together on
2026-09-28. Four of their changes are architecture under `CLAUDE.md` §3:

1. Search by *Gemeinde* (Step 5, `docs/domain/decision-memo-finding-land.md`) needs the
   *Gemeinde* boundaries in the database.
2. Nature capital as categories (Step 4, `docs/domain/decision-memo-habitat.md`) needs the
   Biotopkataster's biotopes per cell — region data, like `protection_overlap` (ADR-0009).
3. Summarising several cells as one site (Step 5) needs to know, per outcome metric, whether it
   may be summed over area or only averaged.
4. Building the ingest image for the first time (Step 6) showed that its base could not work.

## Decision

1. **`municipality`** (`0008`): AGS, pilot region, name, kind (VG25 `BEZ`), MultiPolygon in
   EPSG:25832, source. Written by `ingest/real/17_municipalities.sh` from VG25 `vg25_gem`. A cell
   is placed in the *Gemeinde* containing `ST_PointOnSurface` of the cell, at read time
   (`lib/db/queries/municipalities.ts`) — no per-cell column, so a boundary change is one re-load.
2. **`habitat_overlap`** (`0009`): one row per cell and Biotopkataster biotope, for areas (share),
   lines (length) and points (presence), with type, protection code and text, FFH habitat type,
   conservation grade, mapping method and dates. Every overlap is stored; **which rows are shown
   is code** (`lib/scoring/habitat.ts`), as for `protection_overlap`. Written by
   `ingest/real/18_biotopkataster.sh` and `23_habitat_overlap.sql`. Region data: no
   `method_version`.
3. **Two fields on `OutcomeMetricInfo`** (the per-metric description every cited method carries):
   - `siteAggregation: "sum_per_ha" | "area_mean"` — required. `lib/scoring/site.ts` sums
     per-hectare quantities over the cells' areas and converts the unit (`t C/ha` → `t C`,
     `t CO₂-Äq./ha·a` → `t CO₂-Äq./a`, `MWh/ha·a` → `MWh/a`, `MWp/ha` → `MWp`; an unknown unit
     throws), and area-weights states of the land. Totals cover only modelled cells and say how
     many; deltas only over identical cell sets.
   - `notApplicableByScenarioDe` — optional: a *trifft nicht zu* reason per scenario, where one
     metric has different reasons in different scenarios (the energy method: "keine neue Anlage in
     diesem Szenario" vs. "ausgeschlossen oder nicht vorgesehen").
4. **The energy outcome is a cited outcome method like the others** (ADR-0008):
   `lib/scoring/energy/pv-yield.ts`, `pv-yield-v1`, registered in `CITED_OUTCOME_METHODS`, with
   its factors and citations in `outcome_method.parameters` and its inputs in `outcome_input`. It
   reads the PV rules module, so it cannot disagree with the classification.
5. **The ingest image is based on Ubuntu 24.04** with the distribution's GDAL 3.8.4, PostGIS
   3.4.2 tools and `postgresql-client-16` — the packages the Uckermark pipeline was verified
   with. The previous base (`ghcr.io/osgeo/gdal:alpine-small-3.9.2` plus `apk add postgis`) broke
   every GDAL tool: Alpine's PROJ replaced the image's own (`Error relocating
   /usr/lib/libgdal.so.35: proj_coordinate_metadata_create: symbol not found`).

## Consequences

- A cited method must declare `siteAggregation` for every metric; the type checker enforces it.
- Screens that show a cell read two more tables. Where a region has no Biotopkataster data, the
  parcel page says "noch nicht eingelesen" and every other surface leaves habitat out — none says
  "kein Biotop".
- The ingest image grows (Ubuntu base) but is reproducible with one package manager.
- CI (`.github/workflows/ci.yml`) installs the same Ubuntu packages on the runner for the fixture
  ingest.

## Alternatives considered

- **A `municipality_ags` column on `spatial_unit`** — faster reads, but a boundary change would
  rewrite every cell; the join is cheap at a few dozen *Gemeinden*.
- **Store only counts per cell for habitat** — smaller, but the parcel page must name the biotope
  and its grade, and a display rule change would need a re-ingest.
- **Aggregate sites in SQL** — possible, but the rules (units, coverage, same-cell deltas) are
  product rules and belong with the tested pure code, next to `outcome-display.ts`.
- **Pin Alpine's PROJ or build PostGIS from source in the GDAL image** — more moving parts than
  one distribution that already provides all three.
