// A region's boundary for the explorer map (ADR-0012), simplified for display.
// BKG VG25 under CC BY 4.0 — the notice travels with the data, as the
// Gemeinde outline's does (docs/data/sources.md §3). Replaces the static
// public/pilot-uckermark.geojson: a boundary is region data, read from the
// row the ingest wrote, never a file that can drift from it.

import { NextResponse } from "next/server";
import { getSource } from "@/lib/db/queries/criteria";
import { getRegionOutline } from "@/lib/db/queries/regions";
import { renderAttribution } from "@/lib/attribution";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return NextResponse.json({ error: "invalid region id" }, { status: 400 });
  const outline = await getRegionOutline(id);
  if (!outline) return NextResponse.json({ error: "no boundary for this region" }, { status: 404 });
  const source = outline.sourceId ? await getSource(outline.sourceId) : null;
  return NextResponse.json(
    {
      type: "Feature",
      id: outline.id,
      properties: {
        name: outline.nameDe,
        kind: outline.bez,
        attribution: source ? renderAttribution(source) : null,
      },
      geometry: outline.geometry,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
