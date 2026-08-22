import { NextResponse } from "next/server";

// Liveness check for the app container — used to confirm `docker compose up`
// actually serves the app, per the Phase 1 verification step in
// docs/architecture/roadmap-to-first-deployment.md §3.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
