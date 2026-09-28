# Decision memo — finding and grouping land (search, several cells, side by side, print)

**Version band:** `0.3.x` · **Status:** **implemented, pending the owner's confirmation in review.**
Decided on 2026-09-28 under the owner's instruction to work through the whole roadmap at once;
each choice stays inside the flows `docs/product/mvp.md` §6 already names (the roadmap's
scope-creep risk) and is open to revision in the pull request. · **Last updated:** 2026-09-28 ·
Step 5 of `docs/product/roadmap-pilot-demo.md`

---

## Decisions

### L1 — Search (flow F1): *Gemeinde* and coordinates, no address

- ***Gemeinde*** from the already-confirmed BKG VG25 archive, layer `vg25_gem` (the roadmap asked
  to check whether the fetched version carries it: it does — 30 *Gemeinden* for the Uckermark,
  `GF = 9`). Loaded by `ingest/real/17_municipalities.sh` into `municipality` (ADR-0010).
  Matching folds case, umlauts and punctuation; names that start with the text rank first.
  Choosing a *Gemeinde* frames and outlines it; nothing is selected, because a *Gemeinde* is a
  place to look, not a unit sela assesses.
- **Coordinates:** WGS84 decimal degrees in either order (latitudes and longitudes do not overlap
  inside Germany, so the order is read from the range and the reading is shown); German decimal
  commas; ETRS89/UTM with an explicit zone (32/33), a zone-prefixed easting, or a plain
  six-digit easting read as **zone 33** (Brandenburg's system) — and the reading says so. The
  point is placed in a cell by PostGIS; a point outside every cell says so.
- **No address search**: it needs a geocoder, a new data source behind its own gate.
- The parcel's ***Gemeinde*** is named in the selection panel: the one containing a point on the
  cell's surface, so a border cell is named once.

### L2 — Several cells chosen together

- **Shift-, Ctrl- or ⌘-click** on the map adds or removes a cell; the selection panel has the
  same as a button ("Zu mehreren Zellen hinzufügen"), which is the keyboard path.
- Drawn as an **ink wash under a solid ink edge**, distinct from the single selection's paper halo
  and from the dashed Prüfhinweis contour, and legible in greyscale.
- **At most 100 cells** (about 260 ha; the URL stays short). The group lives in the URL
  (`/site?ids=…`), so it can be linked, printed and reopened. A group never spans two regions.
- Not done: a drawn polygon, and "the whole *Gemeinde* as a site" (a municipality overview is a
  different product question).

### L3 — The site summary (`/site`): counts and sums, never a new verdict

- Cells per class per technology; each Prüfhinweis area and each mapped biotope with the number
  of cells it touches; land-cover classes with cells and area; irradiation and slope as ranges.
- Outcomes: per-hectare quantities (carbon stock, GHG balance, capacity, yield) are **summed over
  the cells' areas** into site totals (t C, t CO₂-Äq./a, MWp, MWh/a); states of the land
  (percolation, soil moisture) are **area-weighted means**. Which applies is declared per metric
  by its method (`siteAggregation`).
- A total covers **only the cells the method modelled**, and says over how many; cells where the
  method finds nothing to measure, or does not cover, are counted, never added as zero.
- Ranges are summed bound by bound. The lowest confidence among the cells is shown.
- A change against the status quo is given **only when both totals cover the same cells**.
- Illustrative placeholder rows (the fixture) are never summed.

### L4 — Cells side by side (flow F6, `/compare`)

- **2 to 6 cells** as columns (beyond six, neither a screen nor A4 stays readable), one scenario at
  a time with a switch. Rows: the three classes, Prüfhinweise, mapped biotopes, land cover,
  irradiation, slope, and each cited outcome under the chosen scenario with its change against the
  same cell's status quo.
- **No ranking, no order, no totals.** The page says why: whether a cell is "better" depends on
  what one weighs (`CLAUDE.md` §4.5).

### L5 — Printable comparison (flow F5)

- The scenario comparison, the site summary and the side-by-side comparison have a **Drucken**
  button and a print stylesheet: controls are left off the page, and a printed footer carries the
  **date, the method versions, every source's notice and the advisory note** — an export that
  cannot cite itself does not render (`mvp.md` F5).

## Open

- **Owner confirmation** of L1–L5.
- *Flurstück* geometry (ADR-0001) remains the real answer to "a council names parcels, not
  cells"; multi-cell selection is the stop-gap.
- Address search (a geocoder is a data-source gate).

## Risks

- **Summing invites precision the cells do not have.** Mitigated: ranges stay ranges, coverage is
  stated on every total, and the method page explains the rules.
- **Scope creep:** kept to F1, F5, F6 and the roadmap's multi-cell item; no municipality
  overview, no drawing tools.
