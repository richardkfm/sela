// Basemap tile route (ADR-0003, roadmap §5.2). Reads one tile's bytes from
// the self-hosted PMTiles archive baked into the image at build time —
// see lib/basemap/pmtiles-reader.ts and ingest/basemap/build.sh.

import { NextResponse } from "next/server";
import { TileType } from "pmtiles";
import { getPmtilesReader } from "@/lib/basemap/pmtiles-reader";

export const runtime = "nodejs";

const CONTENT_TYPE: Partial<Record<TileType, string>> = {
  [TileType.Mvt]: "application/vnd.mapbox-vector-tile",
  [TileType.Png]: "image/png",
  [TileType.Jpeg]: "image/jpeg",
  [TileType.Webp]: "image/webp",
  [TileType.Avif]: "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const reader = getPmtilesReader();
  if (!reader) {
    return new NextResponse(null, { status: 404 });
  }

  const { z, x, y } = await params;
  const [zNum, xNum, yNum] = [Number(z), Number(x), Number(y)];
  if (!Number.isInteger(zNum) || !Number.isInteger(xNum) || !Number.isInteger(yNum)) {
    return NextResponse.json({ error: "invalid tile coordinates" }, { status: 400 });
  }

  const [tile, header] = await Promise.all([reader.getZxy(zNum, xNum, yNum), reader.getHeader()]);
  if (!tile) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(tile.data, {
    headers: {
      "content-type": CONTENT_TYPE[header.tileType] ?? "application/octet-stream",
      "cache-control": "public, max-age=86400",
    },
  });
}
