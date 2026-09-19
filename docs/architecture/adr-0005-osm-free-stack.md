# ADR-0005 — Take OpenStreetMap out of sela: basemap.de for the map, CLC5 for settlement geometry

**Status:** Accepted · **Band:** `0.3.x` · **Date:** 2026-09-19 · **Closes:** U7 (`docs/product/mvp.md` §9) · **Amends:** ADR-0003

---

## Context

`docs/data/sources.md` §4 recorded an open decision with three options, and it has been open
since 2026-09-18. The question: reading the ODbL legal code, a `criterion_value` table built from
OpenStreetMap settlement geometry is most defensibly a **Derivative Database**, not a Produced
Work. If so, §4.4 (share-alike) and §4.6 (offer a machine-readable copy of the derivative database
or of the alterations) attach to **sela's own scoring database** — the one that otherwise holds
only GeoNutzV, `dl-de/by-2-0` and CC BY 4.0 rows carrying no such term. §4.6 follows the scenario
cards too, since they are Produced Works *from* a Derivative Database.

sela touches OSM in two places, and they are not the same:

1. **The basemap** (ADR-0003) — a self-hosted PMTiles archive built from a Geofabrik extract.
2. **`wind_settlement_setback`** — settlement geometry intersected onto hex cells and written into
   `criterion_value`. This is the one that puts OSM-derived rows inside sela's own database.

The three options were: (a) publish the derived database under ODbL, (b) keep OSM out of
`criterion_value`, (c) take legal advice first. When they were written, (b) carried unpriced
research — no substitute dataset had been identified — and left an ODbL obligation on the basemap
archive regardless.

Both of those caveats are now resolved (`docs/data/sources.md` §4.1, 2026-09-19):

- **Settlement geometry has a licence-clean substitute already in hand.** BKG CLC5 classes 111 and
  112 (*Durchgängig* / *Nicht durchgängig städtische Prägung*) under `dl-de/by-2-0`; the archive is
  already fetched and pinned for `pv_land_cover`. BKG DLM250 `AX_Ortslage` under GeoNutzV is a
  second option.
- **The basemap has one too, and it has been rendered.** BKG **basemap.de** is CC BY 4.0, needs no
  account, and its WMTS serves a `GLOBAL_WEBMERCATOR` matrix set that MapLibre consumes as plain
  XYZ. ADR-0003 itself left this door open: *"An official German source was not ruled out on
  principle but was not further evaluated for this ADR; it remains open for later
  reconsideration."*

## Decision

**Option (b), taken to its conclusion: OpenStreetMap leaves sela's stack entirely.**

1. **Basemap:** BKG **basemap.de Web Raster**, style `de_basemapde_web_raster_grau`, served from
   the published WMTS. This **amends ADR-0003**, which stands as the record of why self-hosting was
   chosen and what is given up by not doing it.
2. **Settlement geometry** for `wind_settlement_setback`: BKG **CLC5 classes 111/112**. Class 121
   (*Industrie- und Gewerbeflächen*) is **excluded** — a setback to *Wohnbebauung* is not a setback
   to an industrial estate.
3. **`osm-geofabrik` is withdrawn**, not merely left unconfirmed. Its manifest status says so, and
   `ingest/basemap/build.sh` is superseded rather than deleted — see Consequences.

This is not a finding that option (a) was wrong. It is a judgement that a **perpetual,
irreversible licence obligation on sela's entire scoring database** is a larger cost than a
**documented, disclosable accuracy limit on one criterion** — and that `CLAUDE.md` §4.5 requires
that accuracy limit to be visible in the interface anyway, so it is a cost sela was always going
to pay in honesty rather than one it now incurs.

## Consequences

**What this buys.** No share-alike term touches sela's database. §4.6's machine-readable-access
duty never attaches, to the database or to the scenario cards derived from it. sela may still
choose to publish `criterion_value` openly — `CLAUDE.md` §4.1 points that way — but it will be a
decision, not an obligation inherited from a basemap.

**What it costs, stated plainly.**

- **Settlement geometry gets coarser.** CLC5 has a **5 ha minimum mapping unit**: an isolated
  farmstead or a hamlet below 5 ha is not represented at all, and class 112 encloses the gardens,
  yards and roads inside a settlement so its outline sits outside the built edge by an unquantified
  margin. A setback measured from it is a *different quantity* from one measured against building
  geometry. This must surface as `criterion_value.confidence` and in the criterion's evidence view,
  not be hidden.
- **The basemap is now a third-party runtime dependency**, which is exactly what ADR-0003 rejected.
  `docker compose up` no longer yields a self-contained map. This is a real regression against the
  reproducibility goal, accepted because the alternative is an ODbL obligation on everything else.
  `SELA_BASEMAP=pmtiles` still works if an archive is built, so the self-hosted path is retained,
  not removed.
- **The basemap carries baked-in labels.** The PMTiles style deliberately carried none until a
  self-hosted glyph pipeline existed. Raster tiles arrive already lettered, so
  `design-language.md` §4.1's control over map typography is given up for now.
- **`ingest/basemap/build.sh` is superseded but retained.** It is the only implementation of the
  ADR-0003 path, it worked during `0.3.0`, and deleting it would make reverting this ADR expensive.
  It is not wired into the default pipeline.

**What must still be true.** basemap.de is CC BY 4.0, which is an *attribution* licence: the
notice `© GeoBasis-DE / BKG (<Jahr>) CC BY 4.0` is mandatory on every screen and every export.
Trading share-alike for attribution is only a win if the attribution is actually rendered — see
`docs/data/sources.md` §7 condition 4.

**Reversibility.** The basemap is one environment variable. The settlement source is a criterion
definition and a sampling query. If legal advice later concludes a derived `criterion_value` is a
Produced Work after all, option (a) is still available and nothing here forecloses it.
