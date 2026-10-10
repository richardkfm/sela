# ADR-0012 — Regions as a hierarchy, cells stamped with their AGS, an overview pyramid for the map

**Status:** Accepted under the owner's instruction of 2026-10-10 ("add Saxony and Brandenburg as a
whole, keep the small sector view"), **pending confirmation in review** · **Band:** `0.3.x` ·
**Date:** 2026-10-10 · **Amends:** ADR-0001 (grid per region), ADR-0007 (tiles), ADR-0010 (the
*Gemeinde* join), the schema (migration `0010_regions_and_overview.sql`), `lib/pilot-region.ts`

---

## Context

Until now sela held one real region — the Landkreis Uckermark, 117 191 cells — as a free-text key
on `spatial_unit.pilot_region` and a TypeScript registry. Every region-scoped read counted or
scanned that region's cells; the explorer served every cell at every zoom from 9, where "the whole
Uckermark fits the screen". `docs/product/roadmap-planning-tool.md` asks for both Länder in
full: Brandenburg is 29 697 km² and Sachsen 18 478 km² (VG25, 2026-10-10), about 1.1 million and
0.7 million 100 m cells. Three things do not survive that scale:

1. **Region identity.** A planner looks for a Landkreis or a *Gemeinde* inside a Land; the
   Uckermark must stay reachable as the sector view it is today (the owner's "keep the small
   sector view"). A region therefore has a parent, and a Landkreis is a view over its Land's cells,
   not necessarily its own grid.
2. **Serving.** A z7 tile over a Land holds a million cells; nothing below the cell zoom can be
   served as cells.
3. **Counting.** The legend's counts and the credited sources were computed per request over the
   region's cells; over a million rows that is hundreds of milliseconds per page load.

## Decision

1. **`region` table.** `id` (`<slug>-<ags>`: `brandenburg-12`, `sachsen-14`, `uckermark-12073`,
   `fixture-region`), `kind` (`land` | `kreis` | `fixture`), `ags`, `name`, `bez` (VG25 BEZ),
   `parent_id`, `geom` (the VG25 boundary, CC BY 4.0), `source_id`, `unit_count`. Written by
   `ingest/real/19_regions.sh` for the region being ingested, its Land and every Landkreis of
   that Land (from the VG25 archive); the fixture by `run.sh --fixture`. Migration `0010` registers
   whatever an existing install holds (`uckermark-12073` as a Landkreis of `brandenburg-12`,
   anything unknown as a fixture). The TypeScript registry keeps only what an id says by itself
   (kind, level, Land, jurisdictions) and the static Land configuration (`LAENDER`: which
   protected-area source, which outcome inputs have a source).
2. **`spatial_unit.ags`.** Each cell is stamped at ingest (`24_stamp_ags.sql`) with the 8-digit AGS of
   the *Gemeinde* containing a point on its surface — ADR-0010's rule, stored once. Land =
   `left(ags, 2)`, Kreis = `left(ags, 5)`, both indexed. ADR-0010 chose a read-time join to keep a
   boundary change cheap; at a million cells the join is the cost, and a boundary change is one
   re-run of step 24. `municipalitiesForUnits` now joins on the stamp.
3. **A region scope.** Every region-scoped read takes a `RegionScope` — the grid region, and for a
   Landkreis of a Land grid its AGS prefix — resolved once per request from the `region` row
   (`lib/db/queries/regions.ts`). A Landkreis with its own grid (the shipped Uckermark) and a
   Landkreis as a sector of Brandenburg look the same to every query.
4. **An overview pyramid.** `unit_overview`: per region, per level (1 000 m and 5 000 m, `ST_HexagonGrid`
   over the region's cell centres), one row per hexagon with its cell count, the count per class
   per technology (`counts` jsonb), the most frequent class per technology (`d_pv`, `d_agripv`,
   `d_wind`) and its share (`s_*`), and the flagged cells. Ties go to the more restrictive class.
   Built in SQL by `ingest/08_materialize_overview.sql` after the verdicts, from the cells. Tiles
   below `CELL_MIN_ZOOM` (11) are cut from it (z ≤ 7: 5 km; z 8–10: 1 km) under the same `v_*`
   keys the cells use, so the map's paint rules serve both; cells are drawn from z11 and are
   interactive from z12 as before. Display only — nothing is computed on an overview hexagon.
5. **Materialised per-region aggregates.** `region_verdict_count` (the legend), `region_source`
   (the attribution control) and `region.unit_count` are written with the overview, for the grid
   region and each Landkreis in it. Reads fall back to counting live only on an install that has
   migrated but not re-materialised.
6. **Ingest by region id.** `REGION=brandenburg-12 | sachsen-14 | uckermark-12073 | <slug>-<ags>`
   (`PILOT_REGION` still works). The federal sources are fetched for every region; the Land's own
   sources follow from the AGS (`run.sh`). Boundaries for both Länder and the Uckermark are
   committed in `ingest/regions/`; any other Landkreis is cut from the VG25 archive on the fly by
   the same script. The grid step decides "covered" against the boundary cut into pieces of at most
   256 vertices (`ST_Subdivide`), set-based: every hexagon is paired with the pieces it touches; one
   wholly inside a piece is covered (a predicate, nearly every interior cell); for the rest the
   pieces' intersections must add up to the whole area — the same cells `ST_CoveredBy` against the
   whole polygon gives, without detoasting a 75 000-vertex Land boundary for each of a million
   hexagons (the Sachsen run spent 26 minutes in that step without finishing; correlated subqueries
   over the pieces planned badly too). The Uckermark: 117 191 cells either way, in 6 seconds. The
   dedupe gained a `&&` so the GiST index answers before `ST_Equals`.
7. **The materialiser runs in chunks** of 50 000 units (`07_materialize_scores.ts`): a Land's
   criterion values do not fit in memory at once. Only the fixture's weighted criteria need every
   value up front (the limiting-criterion reference); real regions are classified cell by cell.

## Consequences

- A Landkreis seen as a sector of a Land grid has a few hundred more edge cells than the same
  Landkreis on its own grid: the Land grid keeps a cell straddling the Kreis border (covered by the
  Land, stamped with a *Gemeinde* inside the Kreis) that the Kreis grid drops (`ST_CoveredBy`
  against the Kreis). No number depends on it; the cell counts differ and say so.
- A cell outside every loaded *Gemeinde* has a null AGS and is shown by its grid region only.
- The overview is the most likely misreading on a projector: a 5 km hexagon in amber is "the most
  frequent class of its cells", not "buildable". The legend says so whenever the map is below the
  cell zoom, the hover gives the share, and the encoding is the cells' own
  (`docs/product/design-language.md` §4.2b).
- `public/pilot-uckermark.geojson` is gone: a boundary is region data, served from the row
  (`/api/region/[id]/outline`), never a static file that can drift from it.
- An install that migrates without re-materialising shows no overview below z11 and says so; the
  installer materialises after every ingest.
- Memory: the per-region protection overlaps are still read whole for the flag count; for
  Brandenburg that is a few million small rows. Measured for Sachsen (roadmap-planning-tool.md
  §7); Brandenburg's run is estimated, not measured.

## Alternatives considered

- **One grid per Landkreis, no Land grid.** Keeps every region small, but a Land-wide overview
  would then be 18 separately aligned grids and the Land's counts a union of 18 — and a
  *Gemeinde* search across a Land would span 18 regions. The Land grid with Kreis views is simpler
  for every read.
- **A `kreis_ags` column instead of the full AGS.** Half the stamp; but the *Gemeinde* is what the
  parcel page names and what the export carries, and the Kreis is its prefix.
- **Aggregate at request time with `ST_HexagonGrid` in the tile query.** Correct and index-free,
  but a z6 tile would aggregate a million rows per request. The pyramid is written once per
  materialisation, which is when the verdicts change anyway.
- **Choropleths per *Gemeinde* or Landkreis at the overview.** Reads as a ranking of
  administrative units — exactly what sela does not do (`CLAUDE.md` §4.5). Hexagons of the cells'
  own classes carry no administrative claim.
- **Dominant class by plain majority with ties to the first in sort order.** A tie between
  *ausgeschlossen* and *ohne Einschränkung* would then read as buildable half the time; the
  restrictive tie-break errs the honest way.
