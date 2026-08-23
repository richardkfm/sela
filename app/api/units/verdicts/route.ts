import { NextResponse } from "next/server";
import { listVerdictsForPilotRegion } from "@/lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { DEFAULT_PILOT_REGION } from "@/lib/pilot-region";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";

export const runtime = "nodejs";

function isTechnology(value: string): value is Technology {
  return (TECHNOLOGIES as readonly string[]).includes(value);
}

/** Verdicts for one technology across a pilot region, for map fill coloring. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pilotRegion = url.searchParams.get("pilotRegion") ?? DEFAULT_PILOT_REGION;
  const technology = url.searchParams.get("technology") ?? "pv";

  if (!isTechnology(technology)) {
    return NextResponse.json(
      { error: `invalid technology "${technology}", expected one of ${TECHNOLOGIES.join(", ")}` },
      { status: 400 },
    );
  }

  const verdicts = await listVerdictsForPilotRegion(pilotRegion, technology, CURRENT_METHOD_VERSION);
  return NextResponse.json(verdicts);
}
