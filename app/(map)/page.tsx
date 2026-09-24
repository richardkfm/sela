// Map explorer — the map-first primary surface (design-language.md §3).
// Shows one pilot region: `?region=` if given and present, otherwise the
// default (the real Uckermark once ingested, else the synthetic fixture).
// Units reach the map as vector tiles (ADR-0007); this page only loads what
// the panel needs up front — the region, the legend's counts and the notices
// of every source the tiles carry.

import { renderAttribution } from "@/lib/attribution";
import {
  countVerdicts,
  getRegionSummary,
  listAvailableRegions,
  listRegionSources,
  resolvePilotRegion,
} from "@/lib/db/queries/regions";
import { DEFAULT_PILOT_REGION } from "@/lib/pilot-region";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { Explorer } from "./Explorer";

// Reads live scored data — never statically prerendered (also means a
// build with no DATABASE_URL, e.g. this repo's own `pnpm build` outside
// Docker, can't prerender it; see docker/Dockerfile's `builder` stage,
// which sets one).
export const dynamic = "force-dynamic";

/**
 * What each source contributes, prefixed to its notice so two credits from
 * the same agency (BKG's CLC5 and DGM200 read alike) stay tellable apart.
 */
const SOURCE_ROLE_DE: Record<string, string> = {
  "bkg-clc5": "Bodenbedeckung",
  "bkg-dgm200": "Neigung",
  "dwd-cdc-radiation": "Globalstrahlung",
  "lfu-bb-schutzgebiete": "Schutzgebiete",
};

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export default async function MapExplorerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requested = typeof query.region === "string" ? query.region : null;
  const regionId = await resolvePilotRegion(requested, DEFAULT_PILOT_REGION);

  const [region, counts, sources, available] = await Promise.all([
    getRegionSummary(regionId),
    countVerdicts(regionId, "pv", CURRENT_METHOD_VERSION),
    listRegionSources(regionId),
    listAvailableRegions(),
  ]);

  // docs/data/sources.md §7 condition 4: every source whose data the tiles
  // carry is credited on the map itself, in MapLibre's attribution control.
  const dataAttribution = sources
    .map((source) => {
      const notice = escapeHtml(renderAttribution(source));
      const role = SOURCE_ROLE_DE[source.id];
      const linked = source.attributionUrl ? `<a href="${escapeHtml(source.attributionUrl)}">${notice}</a>` : notice;
      return role ? `${role}: ${linked}` : linked;
    })
    .join(" · ");

  return (
    <main>
      <Explorer
        region={region}
        otherRegions={available.filter((r) => r.id !== region.id)}
        initialTechnology="pv"
        initialCounts={counts}
        dataAttribution={dataAttribution}
      />
    </main>
  );
}
