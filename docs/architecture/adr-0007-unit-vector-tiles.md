# ADR-0007 — Units reach the map as vector tiles cut by PostGIS

**Status:** Accepted · **Band:** `0.3.x` · **Date:** 2026-09-23 · **Amends:** nothing; extends ADR-0001 and ADR-0002

---

## Context

Until now the explorer loaded every unit of the pilot region in one GeoJSON response
(`/api/units`). The fixture has 400 units, so that was fine. The real Uckermark grid (ADR-0001,
100 m hexagons over the Landkreis) has **117 191**. As GeoJSON with three verdicts per unit, that
is tens of megabytes in one request, parsed on the main thread before the map can draw anything.

The serving strategy is architecture (`CLAUDE.md` §3). The project owner chose on 2026-09-23:
**vector tiles cut by PostGIS.** The two alternatives discussed below — a pre-built archive, and a
coarser aggregate for overview zooms — are recorded so a later change knows why they were not taken.

## Decision

### 1. `ST_AsMVT` on request, one route

`GET /api/units/tiles/{z}/{x}/{y}?region=…` (`app/api/units/tiles/[z]/[x]/[y]/route.ts`) returns
one Mapbox Vector Tile with a single layer, `units`, cut by `ST_TileEnvelope` + `ST_AsMVTGeom` +
`ST_AsMVT` (`lib/db/queries/regions.ts` → `unitTile`). An empty tile is `204 No Content`; a bad
region or zoom is `400`. Responses carry `Cache-Control: public, max-age=60`, short on purpose:
a re-materialisation must show up within a minute, and nothing about a verdict tile is immutable.

**Why not PMTiles:** a pre-built archive is faster to serve, but it is a second copy of every
verdict that has to be rebuilt in lock-step with `suitability_verdict` after every scoring run. A
stale archive would show the public a verdict the database no longer holds. On-request tiles cannot
disagree with the database. If load ever requires it, a cache in front of this route is the
cheaper step and keeps that guarantee.

**Why not an aggregate layer:** an overview that averages cells into coarser shapes is a new
derived quantity, and a new derived quantity is a scoring question (§3). Tiles show the same
per-cell verdicts at every zoom; only the level of detail in *transport* changes.

### 2. ADR-0002's boundary holds

TypeScript does no geometry. The Mercator geometry comes from PostGIS as a **stored generated
column** (migration `0004_tile_geometry.sql`):

```sql
geom_3857 geometry(Polygon, 3857) GENERATED ALWAYS AS (ST_Transform(geom, 3857)) STORED
```

Transforming ~30 000 polygons per overview tile on every request would make the transform the
dominant cost. A generated column cannot drift from `geom`, because nobody writes it. It is
display-only: every analysis still reads `geom` in EPSG:25832.

### 3. Zoom gating — what a tile carries depends on what can be done with it

| Zoom | Carries | Why |
|---|---|---|
| < 9 | nothing (the route refuses) | the whole Landkreis fits one z9 view |
| 9–11 | geometry + one verdict per technology (`v_pv`, `v_agripv`, `v_wind`) | at 53° N a 100 m cell is under 1 px at z9 and about 9 px at z11; colour is all that can be read |
| 12–16 | + unit `id` and scores (`s_pv`, …) | a cell is large enough to click, hover and list |
| > 16 | overzoomed from 16 | a 100 m cell is already about 70 px wide at z16 |

Dropping ids below z12 cut the z10 tile from 1.9 MB to 630 KB — the UUIDs were most of it.
Measured locally: a z9 tile ≈ 0.7 s / 534 KB, a z12 tile ≈ 0.02 s / 46 KB.

The explorer follows the same line (`INTERACTIVE_MIN_ZOOM`, `lib/map/tiles.ts`): below z12 a
click zooms in rather than selecting, and the keyboard list says to zoom in. **The keyboard path
(design-language.md §9) is kept, not weakened:** the list shows the units in view — the same set
the map draws — capped at 40 entries with a count of the rest, so it stays short enough to tab
through.

### 4. Counts come from the database, not from the tiles

The legend's counts per verdict come from `/api/units/stats` (`countVerdicts`), not from summing
loaded tile features. Tiles overlap at their buffers and only cover the viewport, so a count built
from them would be wrong in a way nobody would notice.

## Consequences

- The fixture region uses the same path; `/api/units` (GeoJSON) remains for tests and the fixture
  only and is no longer read by the explorer.
- The second geometry costs 17 MB for the Uckermark — the same as `geom` itself — in a 58 MB
  `spatial_unit` table (measured 2026-09-23). Accepted.
- Tile generation at z9 is the slowest request in the app (≈ 0.7 s). Acceptable for a pilot; a
  CDN or a tile cache is the next step if it is not, not a change of source of truth.
- The map's attribution control now credits every source whose values reach the tiles
  (`sources.md` §7 condition 4), since the tiles carry derived data from all of them.
