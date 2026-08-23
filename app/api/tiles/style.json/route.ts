// Desaturated basemap style (design-language.md §4.1: "so that data
// carries all colour"), generated from lib/design/tokens.ts rather than
// hand-duplicated so it can't visually drift from the rest of the design
// system. No symbol/text layers — this style carries no labels in 0.3.0,
// so no glyph/sprite pipeline is needed to satisfy ADR-0003's "self-hosted,
// never CDN-fetched" rule: there is simply nothing external to fetch.
// Labels are a later addition once a self-hosted glyph pipeline exists.
//
// Degrades to a flat ground-colour background with no vector source when
// no basemap archive is present (getPmtilesReader() returns null) — see
// ingest/basemap/build.sh and lib/basemap/pmtiles-reader.ts.

import { NextResponse } from "next/server";
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
  const backgroundLayer = {
    id: "background",
    type: "background" as const,
    paint: { "background-color": surfaceTokens.ground.light },
  };

  if (!reader) {
    return NextResponse.json({
      version: 8,
      name: "sela basemap (no archive present)",
      sources: {},
      layers: [backgroundLayer],
    });
  }

  const header = await reader.getHeader();
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    version: 8,
    name: "sela basemap",
    // ADR-0003: standing ODbL attribution duty on every screen carrying
    // this basemap, and on every export (see app/api/unit/[id]/card/route.tsx).
    sources: {
      [SOURCE_ID]: {
        type: "vector",
        tiles: [`${origin}${TILE_URL_TEMPLATE}`],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        attribution: "© OpenMapTiles © OpenStreetMap contributors",
      },
    },
    layers: [backgroundLayer, ...paletteLayers()],
  });
}
