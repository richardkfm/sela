// Per-class unit counts for one region and technology — the explorer legend's
// numbers (ADR-0007: with ~117 000 units the client no longer holds them all;
// ADR-0012: read from the materialised per-region counts).

import { NextResponse } from "next/server";
import { countVerdicts, resolveScope } from "@/lib/db/queries/regions";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = url.searchParams.get("region");
  const technology = url.searchParams.get("technology") ?? "pv";
  if (!region || !(TECHNOLOGIES as readonly string[]).includes(technology)) {
    return NextResponse.json({ error: "region and a valid technology are required" }, { status: 400 });
  }
  const scope = await resolveScope(region);
  if (!scope) return NextResponse.json({ error: "region not found" }, { status: 404 });
  return NextResponse.json(await countVerdicts(scope, technology as Technology, CURRENT_METHOD_VERSION));
}
