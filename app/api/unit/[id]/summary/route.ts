// One unit, summarised for the map explorer's selection panel: all three
// technologies' verdicts, each with the named criterion that excludes it,
// places it outside what is scored, or limits it (flow F2 — "immediately
// *why*"), plus its land-cover tier and short Prüfhinweise (ADR-0009). Reads
// only; every verdict was materialised by lib/scoring/
// (ingest/07_materialize_scores.ts).

import { NextResponse } from "next/server";
import { getCriterionDefinition, listCriterionValuesForUnit } from "@/lib/db/queries/criteria";
import { listHabitatOverlapsForUnits, regionHasHabitatData } from "@/lib/db/queries/habitat";
import { municipalitiesForUnits } from "@/lib/db/queries/municipalities";
import { habitatFacts, habitatSummaryDe, summariseHabitat } from "@/lib/scoring/habitat";
import { listProtectionOverlapsForUnit } from "@/lib/db/queries/protection";
import { getPreviewUnit } from "@/lib/db/queries/preview";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { protectionFlags } from "@/lib/scoring/protection-flags";
import { readLandCover } from "@/lib/scoring/verdict-text";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getSpatialUnitById(id);
  if (!unit) return NextResponse.json({ error: "unit not found" }, { status: 404 });

  const [verdicts, measured, values, overlaps, municipalities, habitat, hasHabitatData] = await Promise.all([
    listVerdictsForUnit(id, CURRENT_METHOD_VERSION),
    getPreviewUnit(id),
    listCriterionValuesForUnit(id),
    listProtectionOverlapsForUnit(id),
    municipalitiesForUnits([id]),
    listHabitatOverlapsForUnits([id]),
    regionHasHabitatData(unit.pilotRegion),
  ]);
  const landCoverValue = values.find((v) => v.criterionId === "pv_land_cover");
  const strictShare = values.find((v) => v.criterionId === "pv_protection_status")?.value;
  const withReasons = await Promise.all(
    verdicts.map(async (verdict) => {
      const reasonId = verdict.excludedByCriterionId ?? verdict.limitingCriterionId;
      const reason = reasonId ? await getCriterionDefinition(reasonId) : null;
      return {
        ...verdict,
        reason: reason
          ? { id: reason.id, nameDe: reason.nameDe, kind: verdict.excludedByCriterionId ? "decided_by" : "limited_by" }
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
    landCover: landCoverValue ? readLandCover(landCoverValue.value) : null,
    // Prüfhinweise (ADR-0009), short form; the parcel page carries the full, cited text.
    // The Gemeinde containing a point on the cell's surface (flow F1), or null outside every loaded Gemeinde.
    municipality: municipalities.get(id) ?? null,
    // Nature capital as categories (roadmap Step 4): one line; the parcel page lists the biotopes.
    habitat: hasHabitatData ? habitatSummaryDe(summariseHabitat(habitatFacts(habitat))) : null,
    flags: strictShare === undefined ? [] : protectionFlags(overlaps, strictShare).map((f) => f.shortDe),
  });
}
