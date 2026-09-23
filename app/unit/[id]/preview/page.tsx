// 3D parcel preview (ADR-0006) — the develop scenarios at true scale on the
// real ground, with cited setback rings. Reached from the explorer's selection
// card; never the entry point, because a picture of a turbine is not a
// comparison (CLAUDE.md §4.2) and the page links straight on to one.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { describeTerrain, resolveTerrainKind } from "@/lib/basemap/terrain-source";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { TECHNOLOGIES } from "@/lib/scoring/types";
import { Preview3D } from "./Preview3D";
import type { SceneTechnology } from "./Scene";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "3D-Vorschau · sela" };

function parseTechnology(raw: string | string[] | undefined): SceneTechnology {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "status_quo") return value;
  return (TECHNOLOGIES as readonly string[]).includes(value ?? "") ? (value as SceneTechnology) : "wind";
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const unit = await getSpatialUnitById(id);
  if (!unit) notFound();
  const verdicts = await listVerdictsForUnit(id, CURRENT_METHOD_VERSION);
  const terrain = describeTerrain(resolveTerrainKind());

  return (
    <main>
      <Preview3D
        unitId={id}
        initialTechnology={parseTechnology(query.technology)}
        verdicts={verdicts}
        terrainNotice={terrain?.notice ?? null}
        regionKind={pilotRegionInfo(unit.pilotRegion).kind}
      />
    </main>
  );
}
