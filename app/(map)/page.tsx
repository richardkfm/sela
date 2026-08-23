// Map explorer — the map-first primary surface (design-language.md §3).
// Phase 3 (0.3.0): renders the synthetic fixture dataset (see
// lib/pilot-region.ts) via lib/scoring/illustrative-weights.ts. See
// CHANGELOG.md [0.3.0] and IllustrativeBanner.

import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { listSpatialUnitsGeoJSON } from "@/lib/db/queries/spatial-units";
import { listVerdictsForPilotRegion } from "@/lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { DEFAULT_PILOT_REGION } from "@/lib/pilot-region";
import { Map } from "./Map";
import { UnitList } from "./UnitList";

// Reads live scored data — never statically prerendered (also means a
// build with no DATABASE_URL, e.g. this repo's own `pnpm build` outside
// Docker, can't prerender it; see docker/Dockerfile's `builder` stage,
// which sets one).
export const dynamic = "force-dynamic";

export default async function MapExplorerPage() {
  const [units, verdicts] = await Promise.all([
    listSpatialUnitsGeoJSON(DEFAULT_PILOT_REGION),
    listVerdictsForPilotRegion(DEFAULT_PILOT_REGION, "pv", CURRENT_METHOD_VERSION),
  ]);

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <div style={{ padding: "0.5rem 0.75rem" }}>
        <IllustrativeBanner />
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: "18rem", flexShrink: 0, borderRight: "1px solid var(--surface-1)" }}>
          <UnitList units={units} verdicts={verdicts} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Map initialUnits={units} initialVerdicts={verdicts} initialTechnology="pv" />
        </div>
      </div>
    </main>
  );
}
