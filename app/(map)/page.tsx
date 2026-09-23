// Map explorer — the map-first primary surface (design-language.md §3).
// Phase 3 (0.3.0): renders the synthetic fixture dataset (see
// lib/pilot-region.ts) via lib/scoring/illustrative-weights.ts. See
// CHANGELOG.md [0.3.0] and IllustrativeBanner.

import { getPilotRegionExtent, listSpatialUnitsGeoJSON } from "@/lib/db/queries/spatial-units";
import { listVerdictsForPilotRegion } from "@/lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { DEFAULT_PILOT_REGION } from "@/lib/pilot-region";
import { Explorer } from "./Explorer";

// Reads live scored data — never statically prerendered (also means a
// build with no DATABASE_URL, e.g. this repo's own `pnpm build` outside
// Docker, can't prerender it; see docker/Dockerfile's `builder` stage,
// which sets one).
export const dynamic = "force-dynamic";

export default async function MapExplorerPage() {
  const [units, verdicts, sampleExtent] = await Promise.all([
    listSpatialUnitsGeoJSON(DEFAULT_PILOT_REGION),
    listVerdictsForPilotRegion(DEFAULT_PILOT_REGION, "pv", CURRENT_METHOD_VERSION),
    getPilotRegionExtent(DEFAULT_PILOT_REGION),
  ]);

  return (
    <main>
      <Explorer
        units={units}
        initialVerdicts={verdicts}
        initialTechnology="pv"
        sampleExtent={sampleExtent}
        regionName="Uckermark"
      />
    </main>
  );
}
