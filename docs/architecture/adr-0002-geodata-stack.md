# ADR-0002 — Stack: Next.js + PostGIS + MapLibre, with GDAL walled off from TypeScript

**Status:** Accepted · **Band:** `0.2.0` · **Date:** 2026-08-22

---

## Context

`docs/product/mvp.md` was written stack-agnostic. `docs/architecture/roadmap-to-first-deployment.md`
committed to a full-TypeScript stack so the team works in one language across app and API, and to
loading **real pilot-region data from the start** rather than shipping against mock scoring.

Those two commitments are in tension. Raster sampling (DWD radiation grids onto grid cells) and
vector reprojection/intersection (protection areas, land cover, onto the same cells) are exactly
where the TypeScript geospatial ecosystem is weakest — there is no mature, correctness-audited
equivalent to GDAL or PostGIS's own geometry engine written in or for Node.

## Decision

- **Application and API:** Next.js (App Router), TypeScript, deployed with `next.config`'s
  `output: 'standalone'` for a minimal production image.
- **Storage and spatial computation:** PostGIS (`postgis/postgis:16-3.4`). Geometry, spatial
  joins, and the hex-grid generation (ADR-0001) run in SQL, not in application code.
- **Rendering:** MapLibre GL JS on the client.
- **A binding rule, not a preference:**

  > **TypeScript never computes geometry or raster math.**

  A separate `ingest` container runs GDAL command-line tools (`ogr2ogr`, `gdalwarp`,
  `gdal_translate`) and PostGIS SQL to fetch, reproject, and load source data. TypeScript's role
  is limited to orchestrating that pipeline and reading the results it produces — never to
  reimplementing what GDAL or PostGIS already do correctly. `lib/scoring/` (Phase 2) is pure
  TypeScript over already-computed `criterion_value` rows: arithmetic and comparison, never
  geometry.

## Consequences

**Gained:**
- One language for the application, API, and scoring logic, which is what makes the explainability
  requirement (`CLAUDE.md` §4.1) tractable to build and review — the code that decides what a
  user sees and the code that computes it live in the same type system.
- Geometry and raster correctness is inherited from GDAL/PostGIS, both extensively used and
  audited in production GIS, rather than re-derived in a less mature ecosystem.

**Risk, stated in the open rather than discovered late** (carried from
`docs/architecture/roadmap-to-first-deployment.md` §2.1): if the TypeScript/GDAL boundary leaks —
if application code starts reaching for geometry logic because it is more convenient than calling
back into SQL or the ingest pipeline — Phase 2 (real scoring against real data) stalls. Holding
this boundary is a review-time discipline, not a one-time architectural guarantee, and is called
out explicitly in code review for anything touching `lib/scoring/` or `app/api/`.

**Given up:** a single unified language does not extend to geoprocessing; contributors need
enough SQL and GDAL CLI familiarity to work on `ingest/`. This is accepted as the cost of "real
data from the start" rather than deferred to a later, harder migration.

**Scope of this ADR:** fixes the technology choices and the TypeScript/geoprocessing boundary.
The database schema (ADR-driven in Phase 2, per `docs/architecture/roadmap-to-first-deployment.md`
§4.1) and the ingest pipeline steps (§4.2) are separate, later decisions built on top of this one.
