// Everything the two multi-cell screens read (roadmap Step 5): the site
// summary (/site) and cells side by side (/compare, mvp.md F6). One query per
// table; the per-cell readings (land cover, flags) come from the same pure
// rules the single-cell screens use, so a cell reads the same everywhere.

import { listSources, type SourceRow } from "@/lib/db/queries/criteria";
import { listHabitatOverlapsForUnits, regionHasHabitatData } from "@/lib/db/queries/habitat";
import { municipalitiesForUnits } from "@/lib/db/queries/municipalities";
import {
  listCriterionValuesForUnits,
  listOutcomesForUnits,
  listProtectionOverlapsForUnits,
  listUnitBasics,
  listVerdictsForUnits,
  type UnitBasics,
} from "@/lib/db/queries/unit-set";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import { habitatFacts, type HabitatFact } from "@/lib/scoring/habitat";
import { protectionFlags, type ProtectionFlag } from "@/lib/scoring/protection-flags";
import type { CriterionValue, OutcomeRow, SuitabilityVerdict } from "@/lib/scoring/types";
import { readLandCover, type LandCoverReading } from "@/lib/scoring/verdict-text";

export interface UnitReading {
  readonly unit: UnitBasics;
  readonly municipality: { ags: string; name: string } | null;
  readonly verdicts: readonly SuitabilityVerdict[];
  readonly values: ReadonlyMap<string, CriterionValue>;
  readonly landCover: LandCoverReading | null;
  readonly flags: readonly ProtectionFlag[];
  /** What the Biotopkataster records on the cell (roadmap Step 4). */
  readonly habitat: readonly HabitatFact[];
}

export interface UnitSet {
  readonly units: readonly UnitReading[];
  /** Ids asked for that do not exist. */
  readonly missing: readonly string[];
  /** Ids in another pilot region than the first cell's — a site never spans two regions (their methods differ). */
  readonly otherRegion: readonly string[];
  /** Rows of the cited outcome methods only — illustrative placeholders are not summed or compared across cells. */
  readonly outcomes: readonly OutcomeRow[];
  readonly sources: ReadonlyMap<string, SourceRow>;
  /** False where the region has no Biotopkataster data — then no screen claims "kein Biotop". */
  readonly hasHabitatData: boolean;
}

export async function loadUnitSet(ids: readonly string[]): Promise<UnitSet> {
  const citedVersions = CITED_OUTCOME_METHODS.map((c) => c.method.methodVersion);
  const allBasics = await listUnitBasics(ids);
  const region = allBasics[0]?.pilotRegion;
  const basics = allBasics.filter((b) => b.pilotRegion === region);
  const otherRegion = allBasics.filter((b) => b.pilotRegion !== region).map((b) => b.id);
  const inRegion = basics.map((b) => b.id);
  const [verdicts, values, overlaps, outcomes, municipalities, sources, habitat, hasHabitatData] = await Promise.all([
    listVerdictsForUnits(inRegion, CURRENT_METHOD_VERSION),
    listCriterionValuesForUnits(inRegion),
    listProtectionOverlapsForUnits(inRegion),
    listOutcomesForUnits(inRegion, citedVersions),
    municipalitiesForUnits(inRegion),
    listSources(),
    listHabitatOverlapsForUnits(inRegion),
    region ? regionHasHabitatData(region) : Promise.resolve(false),
  ]);

  const units = basics.map((unit): UnitReading => {
    const own = new Map(values.filter((v) => v.spatialUnitId === unit.id).map((v) => [v.criterionId, v]));
    const landCover = own.get("pv_land_cover");
    const strict = own.get("pv_protection_status");
    return {
      unit,
      municipality: municipalities.get(unit.id) ?? null,
      verdicts: verdicts.filter((v) => v.spatialUnitId === unit.id),
      values: own,
      landCover: landCover ? readLandCover(landCover.value) : null,
      flags: strict ? protectionFlags(overlaps.filter((o) => o.spatialUnitId === unit.id), strict.value) : [],
      habitat: habitatFacts(habitat.filter((h) => h.spatialUnitId === unit.id)),
    };
  });
  const found = new Set(allBasics.map((b) => b.id));
  return {
    units,
    missing: ids.filter((id) => !found.has(id)),
    otherRegion,
    outcomes,
    sources: new Map(sources.map((s) => [s.id, s])),
    hasHabitatData,
  };
}

/** The sources a set of cells draws on, for the page's "Quellen" list and the printed footer. */
export function sourcesUsed(set: UnitSet): SourceRow[] {
  const ids = new Set<string>();
  for (const reading of set.units) {
    for (const value of reading.values.values()) ids.add(value.sourceId);
    for (const flag of reading.flags) ids.add(flag.sourceId);
    for (const fact of reading.habitat) ids.add(fact.sourceId);
  }
  if (set.units.some((u) => u.municipality)) ids.add("bkg-vg25");
  return [...ids].flatMap((id) => {
    const source = set.sources.get(id);
    return source ? [source] : [];
  });
}
