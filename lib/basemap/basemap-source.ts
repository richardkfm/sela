// Which basemap the app is actually serving, and the attribution that comes
// with it. One module so `app/api/tiles/style.json/route.ts` (the live map)
// and `app/api/unit/[id]/card/route.tsx` (the export) can never disagree
// about what is under the data — ADR-0003 puts the attribution duty on
// every screen *and* every export, so a second hard-coded credit string is
// a bug waiting to happen.
//
// **basemap.de is the basemap, per ADR-0005** (2026-09-19), which amends
// ADR-0003. It is CC BY 4.0 with no share-alike, needs no account, and is
// the official German basemap, so the pilot region is its home turf. The
// reason it is the default is not convenience: ADR-0005 takes OpenStreetMap
// out of sela's stack entirely so that ODbL's share-alike term cannot reach
// sela's own scoring database. A basemap built from an OSM extract would put
// it straight back.
//
// ADR-0003's self-hosted PMTiles archive is **retained, not removed** —
// `SELA_BASEMAP=pmtiles` still serves it, and `ingest/basemap/build.sh` is
// still the way to build one. ADR-0005 records what switching costs: a
// third-party runtime dependency where ADR-0003 wanted self-containment,
// and baked-in labels where the PMTiles style deliberately had none.
//
// CARTO — what `richardkfm/alpha` used — stays selectable but **watermarks
// every unauthenticated tile with "API KEY REQUIRED"**, confirmed by
// rendering it on 2026-09-19. Set SELA_CARTO_API_KEY to use it for real.
// Note it is OSM-derived, so selecting it reintroduces an ODbL attribution
// duty (not share-alike — a hosted basemap never enters criterion_value).

import { getPmtilesReader } from "@/lib/basemap/pmtiles-reader";

export type BasemapKind = "pmtiles" | "basemapde" | "carto" | "none";

export interface BasemapDescriptor {
  kind: BasemapKind;
  /** Plain text, for rendered exports that cannot carry links. */
  attribution: string;
  /** With links, for MapLibre's attribution control. */
  attributionHtml: string;
}

const CARTO_ATTRIBUTION = "© OpenStreetMap contributors © CARTO";
const PMTILES_ATTRIBUTION = "© OpenMapTiles © OpenStreetMap contributors";

// basemap.de's terms name the year of last data retrieval; for a live tile
// service that is simply now. Computed rather than hard-coded so the notice
// cannot quietly go stale in January.
function basemapDeAttribution(): string {
  return `© GeoBasis-DE / BKG (${new Date().getFullYear()}) CC BY 4.0`;
}

/**
 * `SELA_BASEMAP` selects the source:
 *   auto (default) — basemap.de, per ADR-0005
 *   pmtiles        — ADR-0003's self-hosted archive; flat background if absent
 *   basemapde      — same as auto, stated explicitly
 *   carto          — CARTO (watermarked without SELA_CARTO_API_KEY)
 *   none           — flat background, no basemap at all
 *
 * `auto` deliberately does **not** prefer a PMTiles archive just because one
 * happens to be on disk. Under ADR-0005 that archive is OSM-derived, so
 * silently preferring it would reintroduce the dependency the ADR removed —
 * and it would do so invisibly, on whichever machines happen to have built
 * one. Serving it is a choice that has to be made out loud.
 *
 * An unrecognised value falls back to `auto` with a warning rather than
 * throwing: a typo in an env var should not take the map down.
 */
export function resolveBasemapKind(archivePresent: boolean): BasemapKind {
  const requested = (process.env.SELA_BASEMAP ?? "auto").toLowerCase();

  switch (requested) {
    case "pmtiles":
      return archivePresent ? "pmtiles" : "none";
    case "carto":
      return "carto";
    case "none":
      return "none";
    case "auto":
    case "basemapde":
      return "basemapde";
    default:
      console.warn(`unrecognised SELA_BASEMAP='${requested}' — falling back to 'auto'`);
      return "basemapde";
  }
}

export function describeBasemap(kind: BasemapKind): BasemapDescriptor {
  switch (kind) {
    case "pmtiles":
      return {
        kind,
        attribution: PMTILES_ATTRIBUTION,
        attributionHtml:
          '© <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      };
    case "basemapde":
      return {
        kind,
        attribution: basemapDeAttribution(),
        attributionHtml:
          `© GeoBasis-DE / <a href="https://www.bkg.bund.de">BKG</a> (${new Date().getFullYear()}) <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>`,
      };
    case "carto":
      return {
        kind,
        attribution: CARTO_ATTRIBUTION,
        attributionHtml:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      };
    case "none":
      return { kind, attribution: "", attributionHtml: "" };
  }
}

/** The basemap this process will actually serve, archive presence included. */
export function getActiveBasemap(): BasemapDescriptor {
  return describeBasemap(resolveBasemapKind(getPmtilesReader() !== null));
}

/**
 * CARTO serves the same tiles from four subdomains. MapLibre has no `{s}`
 * token (that is Leaflet's), so the subdomains are expanded into four tile
 * URLs and MapLibre spreads requests across them itself.
 *
 * `light_nolabels` rather than `light_all`: design-language.md §4.1 wants a
 * desaturated basemap "so that data carries all colour", and the labels are
 * baked into these raster tiles — a labelled style could not be toned down
 * later. It also matches the PMTiles style, which carries no labels either.
 */
export function cartoTileUrls(): string[] {
  const key = process.env.SELA_CARTO_API_KEY;
  const query = key ? `?api_key=${encodeURIComponent(key)}` : "";
  return ["a", "b", "c", "d"].map(
    (sub) => `https://${sub}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png${query}`,
  );
}

/**
 * basemap.de's WMTS, requested as plain XYZ. Note the path order: WMTS is
 * {TileMatrix}/{TileRow}/{TileCol}, i.e. **z/y/x**, where MapLibre's own
 * template is z/x/y — getting this backwards yields tiles from the wrong
 * hemisphere rather than an error.
 *
 * `_grau` rather than `_farbe`: design-language.md §4.1 wants a desaturated
 * basemap "so that data carries all colour". GLOBAL_WEBMERCATOR is the
 * matrix set that matches MapLibre's own tiling; the service also publishes
 * DE_EPSG_25832_ADV, which does not.
 */
export const BASEMAPDE_TILE_URLS = [
  "https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png",
];
