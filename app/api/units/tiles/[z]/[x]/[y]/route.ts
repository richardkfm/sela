// Vector tiles of a region's units (ADR-0007). `/api/units/tiles/{z}/{x}/{y}?region=…`
// returns one Mapbox Vector Tile, layer `units`, with every technology's verdict
// on each feature. Cut and encoded by PostGIS (lib/db/queries/regions.ts).

import { unitTile } from "@/lib/db/queries/regions";
import { MAX_UNIT_TILE_ZOOM, MIN_UNIT_TILE_ZOOM } from "@/lib/map/tiles";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params;
  const zoom = Number(z);
  const col = Number(x);
  const row = Number(y.replace(/\.pbf$/, ""));
  const region = new URL(request.url).searchParams.get("region");
  if (
    !region ||
    ![zoom, col, row].every(Number.isInteger) ||
    zoom < MIN_UNIT_TILE_ZOOM ||
    zoom > MAX_UNIT_TILE_ZOOM ||
    col < 0 ||
    row < 0 ||
    col >= 2 ** zoom ||
    row >= 2 ** zoom
  ) {
    return new Response("invalid tile request", { status: 400 });
  }

  const tile = await unitTile(region, zoom, col, row, CURRENT_METHOD_VERSION);
  const headers = {
    "Content-Type": "application/vnd.mapbox-vector-tile",
    // Verdicts change when scores are re-materialised; a minute of caching
    // takes the load off panning without holding stale colours for long.
    "Cache-Control": "public, max-age=60",
  };
  // A tile outside the region is empty: 204, which must not carry a body.
  if (tile.length === 0) return new Response(null, { status: 204, headers });
  return new Response(new Uint8Array(tile), { status: 200, headers });
}
