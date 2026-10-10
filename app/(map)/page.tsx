// Map explorer — the map-first primary surface (design-language.md §3).
// Shows one region (ADR-0012): `?region=` if given and present — a Land, a
// Landkreis of it, or the synthetic fixture — otherwise the default (the
// Uckermark once ingested, else whatever region has cells). Units reach the
// map as vector tiles (ADR-0007); this page only loads what the panel needs
// up front — the region and where it sits, the legend's counts and the
// notices of every source the tiles carry.

import { renderAttribution } from "@/lib/attribution";
import {
  countVerdicts,
  getRegionSummary,
  listAvailableRegions,
  listRegionSources,
  resolveRegion,
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
  "lfulg-sn-schutzgebiete": "Schutzgebiete",
  "lbgr-bb-moorbodenkarte": "Moorböden",
  "lfu-bb-wasserhaushalt": "Wasserhaushalt",
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
  const regionId = await resolveRegion(requested, DEFAULT_PILOT_REGION);
  const region = regionId ? await getRegionSummary(regionId) : null;

  if (!region) {
    return (
      <main className="page-shell">
        <h1>Noch keine Daten</h1>
        <p className="muted">
          In dieser Datenbank ist noch keine Region eingelesen. <code>ingest/run.sh --fixture</code> lädt den
          Beispieldatensatz, <code>REGION=uckermark-12073 ingest/run.sh</code> eine echte Region.
        </p>
      </main>
    );
  }

  const [counts, sources, available] = await Promise.all([
    countVerdicts(region.scope, "pv", CURRENT_METHOD_VERSION),
    listRegionSources(region.scope),
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
        key={region.id}
        region={region}
        regions={available}
        initialTechnology="pv"
        initialCounts={counts}
        dataAttribution={dataAttribution}
      />
    </main>
  );
}
