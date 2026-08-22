# ADR-0003 — Basemap: self-hosted PMTiles from OSM, desaturated in-repo

**Status:** Accepted · **Band:** `0.2.0` · **Date:** 2026-08-22 · **Closes:** U8 (`docs/product/mvp.md` §9, `docs/product/design-language.md` §11)

---

## Context

`docs/product/design-language.md` §4.1 requires the basemap to be desaturated so that data,
never the map, carries colour and attention. Three basemap options were considered: OSM-derived
vector tiles self-hosted from the project's own infrastructure, a commercial provider (e.g.
Mapbox, MapTiler), or an official German source (e.g. BKG's own basemap services).

A commercial provider adds a recurring external dependency and cost with unclear terms for a
public-interest, potentially high-traffic tool. An official German source was not ruled out on
principle but was not further evaluated for this ADR; it remains open for later reconsideration
if PMTiles proves insufficient for German-specific labelling or *Bundesland* boundary accuracy.

## Decision

**Self-hosted PMTiles**, built from OpenStreetMap data via Geofabrik extracts (licensed ODbL),
styled desaturated in-repo per `docs/product/design-language.md` §4.1. Fonts (glyphs) and
sprites are self-hosted alongside the tile archive — **not** fetched from a third-party CDN at
runtime. A container that reaches out to an external font or sprite host at request time is not
self-contained, and undermines the reproducibility goal of `docker compose up` on a clean
machine (`docs/architecture/roadmap-to-first-deployment.md` §1).

The style JSON is authored and versioned in this repository, not pulled from a hosted style
service, so it can be reviewed against the design language like any other UI change.

## Consequences

**Gained:**
- No third-party basemap API key, quota, or billing relationship required to run or deploy sela.
- Full control over desaturation and label density, which a hosted style would only expose
  through a narrower customisation surface.
- The deployment stays reproducible: one application container serves both the app and its tiles
  (serving mechanics are Phase 3 — `docs/architecture/roadmap-to-first-deployment.md` §5.2).

**Given up, and not hidden:**
- **An ODbL attribution duty follows the data everywhere it appears** — every screen showing the
  map, and every exported scenario card (`docs/product/design-language.md` §7), must carry OSM
  attribution. This is a standing UI and export requirement from Phase 3 onward, not a one-time
  footer to add later.
- The project takes on responsibility for tile freshness and rebuild cadence that a hosted
  provider would otherwise absorb. This is accepted as a one-time build step against a Geofabrik
  extract for the pilot region, revisited if update cadence becomes a product requirement.
- Official German basemap sources (BKG) were not evaluated in depth for this decision. If
  *Bundesland*-specific labelling accuracy becomes a stated requirement, this ADR should be
  revisited rather than silently overridden.

**Scope of this ADR:** fixes the basemap *provider and licence*. Building the actual PMTiles
archive, the Next.js route handler that serves `z/x/y` tiles from it, and the desaturated style
JSON are Phase 3 implementation work (`docs/architecture/roadmap-to-first-deployment.md` §5.2),
not part of the Phase 1 skeleton.
