// One Gemeinde's outline for the explorer map (flow F1), simplified for
// display. BKG VG25 under CC BY 4.0 — the notice travels with the data, like
// the pilot boundary's (docs/data/sources.md §3).

import { NextResponse } from "next/server";
import { getSource } from "@/lib/db/queries/criteria";
import { getMunicipalityOutline } from "@/lib/db/queries/municipalities";
import { renderAttribution } from "@/lib/attribution";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ ags: string }> }) {
  const { ags } = await params;
  if (!/^[0-9]{8}$/.test(ags)) return NextResponse.json({ error: "ags must be eight digits" }, { status: 400 });
  const [outline, source] = await Promise.all([getMunicipalityOutline(ags), getSource("bkg-vg25")]);
  if (!outline) return NextResponse.json({ error: "Gemeinde not found" }, { status: 404 });
  return NextResponse.json({
    type: "Feature",
    id: outline.ags,
    properties: {
      ags: outline.ags,
      name: outline.name,
      kind: outline.kind,
      attribution: source ? renderAttribution(source) : null,
    },
    geometry: outline.geometry,
  });
}
