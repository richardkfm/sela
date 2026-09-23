// One unit, summarised for the map explorer's selection panel: all three
// technologies' verdicts, each with the named criterion that limits or
// excludes it (flow F2 — "immediately *why*"). Reads only; every value was
// materialised by lib/scoring/ (ingest/07_materialize_scores.ts).

import { NextResponse } from "next/server";
import { getCriterionDefinition } from "@/lib/db/queries/criteria";
import { getPreviewUnit } from "@/lib/db/queries/preview";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getSpatialUnitById(id);
  if (!unit) return NextResponse.json({ error: "unit not found" }, { status: 404 });

  const [verdicts, measured] = await Promise.all([listVerdictsForUnit(id, CURRENT_METHOD_VERSION), getPreviewUnit(id)]);
  const withReasons = await Promise.all(
    verdicts.map(async (verdict) => {
      const reasonId = verdict.excludedByCriterionId ?? verdict.limitingCriterionId;
      const reason = reasonId ? await getCriterionDefinition(reasonId) : null;
      return {
        ...verdict,
        reason: reason
          ? { id: reason.id, nameDe: reason.nameDe, kind: verdict.excludedByCriterionId ? "excluded_by" : "limited_by" }
          : null,
      };
    }),
  );

  return NextResponse.json({
    id: unit.id,
    kind: unit.kind,
    pilotRegion: unit.pilotRegion,
    regionKind: pilotRegionInfo(unit.pilotRegion).kind,
    areaHa: measured?.areaHa ?? null,
    bbox: measured?.bbox ?? null,
    methodVersion: CURRENT_METHOD_VERSION,
    verdicts: withReasons,
  });
}
