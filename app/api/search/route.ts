// Flow F1 (mvp.md): find land by Gemeinde name or by coordinates. Address
// search is not offered: it needs a geocoder, which is a new data source and
// behind its own gate (roadmap Step 5).

import { NextResponse } from "next/server";
import { findUnitAt, listMunicipalities } from "@/lib/db/queries/municipalities";
import { matchNames, parseCoordinates } from "@/lib/search/coordinates";

export const runtime = "nodejs";

const MAX_MUNICIPALITIES = 8;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = url.searchParams.get("region");
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  if (!region) return NextResponse.json({ error: "region is required" }, { status: 400 });

  const parsed = parseCoordinates(q);
  if (parsed) {
    const unitId =
      parsed.kind === "wgs84"
        ? await findUnitAt(region, parsed.lon, parsed.lat, 4326)
        : await findUnitAt(region, parsed.easting, parsed.northing, parsed.epsg);
    return NextResponse.json({ municipalities: [], coordinate: { readAsDe: parsed.readAsDe, unitId } });
  }

  const municipalities = matchNames(await listMunicipalities(region), q).slice(0, MAX_MUNICIPALITIES);
  return NextResponse.json({ municipalities, coordinate: null });
}
