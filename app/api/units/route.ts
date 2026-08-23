import { NextResponse } from "next/server";
import { listSpatialUnitsGeoJSON } from "@/lib/db/queries/spatial-units";
import { DEFAULT_PILOT_REGION } from "@/lib/pilot-region";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const pilotRegion = new URL(request.url).searchParams.get("pilotRegion") ?? DEFAULT_PILOT_REGION;
  const collection = await listSpatialUnitsGeoJSON(pilotRegion);
  return NextResponse.json(collection);
}
