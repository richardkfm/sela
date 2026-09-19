// Which basemap the app is actually serving, and the attribution that comes
// with it. One module so `app/api/tiles/style.json/route.ts` (the live map)
// and `app/api/unit/[id]/card/route.tsx` (the export) can never disagree
// about what is under the data — ADR-0003 puts the attribution duty on
// every screen *and* every export, so a second hard-coded credit string is
// a bug waiting to happen.
//
// ADR-0003 chose a self-hosted PMTiles archive and explicitly rejected
// CDN-fetched map assets. The remote options below do not overturn that
// decision: they are **temporary development fallbacks**, added 2026-09-19
// at the project owner's request so the map shows real geography while
// `ingest/basemap/build.sh` cannot run (download.geofabrik.de is blocked by
// the current environment's egress policy — docs/data/sources.md §6).
// Before anything public ships, either the PMTiles archive is built or
// ADR-0003 is amended deliberately. See docs/data/sources.md §4.1.
//
// The default fallback is **basemap.de**, not CARTO, for three reasons:
// it is CC BY 4.0 with no share-alike (verified — docs/data/sources.md
// §4.1), it needs no account, and it is the official German basemap so the
// pilot region is its home turf. CARTO — what `richardkfm/alpha` used — is
// kept selectable but **watermarks every unauthenticated tile with "API KEY
// REQUIRED"**, confirmed by rendering it on 2026-09-19. Set
// SELA_CARTO_API_KEY to use it for real.

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
 *   auto (default) — the PMTiles archive if one is present, else basemap.de
 *   pmtiles        — the archive only; a flat background if it is absent
 *   basemapde      — force basemap.de even when an archive exists
 *   carto          — force CARTO (watermarked without SELA_CARTO_API_KEY)
 *   none           — flat background, no basemap at all
 *
 * An unrecognised value falls back to `auto` with a warning rather than
 * throwing: a typo in an env var should not take the map down.
 */
export function resolveBasemapKind(archivePresent: boolean): BasemapKind {
  const requested = (process.env.SELA_BASEMAP ?? "auto").toLowerCase();

  switch (requested) {
    case "pmtiles":
      return archivePresent ? "pmtiles" : "none";
    case "basemapde":
      return "basemapde";
    case "carto":
      return "carto";
    case "none":
      return "none";
    case "auto":
      return archivePresent ? "pmtiles" : "basemapde";
    default:
      console.warn(`unrecognised SELA_BASEMAP='${requested}' — falling back to 'auto'`);
      return archivePresent ? "pmtiles" : "basemapde";
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
