// Desaturated basemap style (design-language.md §4.1: "so that data
// carries all colour"), generated from lib/design/tokens.ts rather than
// hand-duplicated so it can't visually drift from the rest of the design
// system. No symbol/text layers — this style carries no labels in 0.3.0,
// so no glyph/sprite pipeline is needed to satisfy ADR-0003's "self-hosted,
// never CDN-fetched" rule: there is simply nothing external to fetch.
// Labels are a later addition once a self-hosted glyph pipeline exists.
//
// When no basemap archive is present (getPmtilesReader() returns null) the
// style falls back to CARTO raster tiles, or to a flat ground colour if the
// fallback is switched off — see lib/basemap/basemap-source.ts for the
// SELA_BASEMAP switch and for why a CDN fallback exists at all under
// ADR-0003.

import { NextResponse } from "next/server";
import {
  BASEMAPDE_TILE_URLS,
  cartoTileUrls,
  describeBasemap,
  resolveBasemapKind,
} from "@/lib/basemap/basemap-source";
import { getPmtilesReader } from "@/lib/basemap/pmtiles-reader";
import { surfaceTokens } from "@/lib/design/tokens";

export const runtime = "nodejs";

const TILE_URL_TEMPLATE = "/api/tiles/{z}/{x}/{y}";
const SOURCE_ID = "basemap";

// Muted line/fill colours for a handful of the OpenMapTiles schema's
// source-layers (what ingest/basemap/build.sh's Planetiler build produces),
// derived from the same ground/surface tokens the rest of the app uses —
// never a bespoke basemap palette living only here.
function paletteLayers() {
  const water = "#c9d6dc";
  const landcover = "#eceae4";
  const landuse = "#e6e3db";
  const building = surfaceTokens.surface1.light;
  const boundary = surfaceTokens.textSecondary.light;
  const transportation = "#d8d5cc";

  return [
    { id: "landcover", type: "fill", source: SOURCE_ID, "source-layer": "landcover", paint: { "fill-color": landcover } },
    { id: "landuse", type: "fill", source: SOURCE_ID, "source-layer": "landuse", paint: { "fill-color": landuse } },
    { id: "water", type: "fill", source: SOURCE_ID, "source-layer": "water", paint: { "fill-color": water } },
    { id: "building", type: "fill", source: SOURCE_ID, "source-layer": "building", paint: { "fill-color": building, "fill-opacity": 0.6 } },
    {
      id: "transportation",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "transportation",
      paint: { "line-color": transportation, "line-width": 0.75 },
    },
    {
      id: "boundary",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "boundary",
      paint: { "line-color": boundary, "line-width": 0.5, "line-opacity": 0.5 },
    },
  ] as const;
}

export async function GET(request: Request) {
  const reader = getPmtilesReader();
  const basemap = describeBasemap(resolveBasemapKind(reader !== null));
  const backgroundLayer = {
    id: "background",
    type: "background" as const,
    paint: { "background-color": surfaceTokens.ground.light },
  };

  if (basemap.kind === "none") {
    return NextResponse.json({
      version: 8,
      name: "sela basemap (none)",
      sources: {},
      layers: [backgroundLayer],
    });
  }

  // ADR-0003 puts a standing attribution duty on every screen carrying a
  // basemap, and on every export (see app/api/unit/[id]/card/route.tsx).
  // The string comes from basemap-source.ts so the two cannot drift.
  if (basemap.kind === "basemapde" || basemap.kind === "carto") {
    const remote =
      basemap.kind === "basemapde"
        ? { tiles: BASEMAPDE_TILE_URLS, maxzoom: 18 }
        : { tiles: cartoTileUrls(), maxzoom: 20 };
    return NextResponse.json({
      version: 8,
      name: `sela basemap (${basemap.kind} fallback — not ADR-0003's self-hosted archive)`,
      sources: {
        [SOURCE_ID]: {
          type: "raster",
          tiles: remote.tiles,
          tileSize: 256,
          maxzoom: remote.maxzoom,
          attribution: basemap.attributionHtml,
        },
      },
      // No paletteLayers(): those style the OpenMapTiles vector schema, and
      // raster tiles arrive already rendered. The background still sits
      // underneath so a tile that fails to load leaves ground colour rather
      // than a hole.
      layers: [
        backgroundLayer,
        { id: "basemap-raster", type: "raster", source: SOURCE_ID, paint: { "raster-opacity": 1 } },
      ],
    });
  }

  const header = await reader!.getHeader();
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    version: 8,
    name: "sela basemap",
    sources: {
      [SOURCE_ID]: {
        type: "vector",
        tiles: [`${origin}${TILE_URL_TEMPLATE}`],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        attribution: basemap.attributionHtml,
      },
    },
    layers: [backgroundLayer, ...paletteLayers()],
  });
}
