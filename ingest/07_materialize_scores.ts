// Phase 3 (0.3.0) bridge from criterion_value rows to suitability_verdict/
// outcome rows. TypeScript-side, not shell/SQL — per ADR-0002 this is
// arithmetic and comparison over already-computed values, not geometry or
// raster math, so it runs from the app/builder image rather than inside
// the GDAL ingest container (which has no Node runtime). See
// ingest/README.md "Materializing scores (Phase 3, 0.3.0)".
//
// Usage: pnpm db:materialize -- --pilot-region=fixture-region [--outcomes=illustrative|methods|none]
//
// Outcomes default to `illustrative` for the synthetic fixture and `methods`
// for every real pilot region. The illustrative outcome shapes invent energy,
// climate and nature-capital figures from a "site quality" scalar; on the
// fixture that exercises the comparison screen, on real land it would put
// made-up MWh/a on real fields. `methods` writes only the cited outcome
// methods of lib/scoring/nature/ (ADR-0008, docs/domain/scoring-criteria.md
// §4), each under its own method_version, with outcome_input rows linking
// every number to its criterion values; every other dimension stays
// "noch nicht modelliert" (mvp.md §8.3). `none` writes no outcomes.

import { getPool } from "../lib/db/client";
import { listCriterionDefinitions, listCriterionValuesForPilotRegion } from "../lib/db/queries/criteria";
import { replaceOutcomesForPilotRegion, upsertOutcomeMethod, upsertOutcomeRow } from "../lib/db/queries/outcomes";
import { listSpatialUnitIds } from "../lib/db/queries/spatial-units";
import { replaceVerdictsForPilotRegion } from "../lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "../lib/scoring/method-version";
import { CITED_OUTCOME_METHODS, methodOutcomeRows } from "../lib/scoring/nature";
import { computeOutcomeRow } from "../lib/scoring/outcomes";
import { computeSuitability } from "../lib/scoring/suitability";
import { OUTCOME_DIMENSIONS, SCENARIOS, SelaScoringError, TECHNOLOGIES } from "../lib/scoring/types";
import type { CriterionValue, SuitabilityVerdict } from "../lib/scoring/types";
import {
  ILLUSTRATIVE_SUITABILITY_THRESHOLD,
  illustrativeNormalize,
  illustrativeOutcomeAggregate,
} from "../lib/scoring/illustrative-weights";

type OutcomeMode = "illustrative" | "methods" | "none";

function parseArgs(argv: readonly string[]): { pilotRegion: string; outcomes: OutcomeMode } {
  const flag = argv.find((a) => a.startsWith("--pilot-region="));
  const pilotRegion = flag ? flag.slice("--pilot-region=".length) : "fixture-region";
  const outcomesFlag = argv.find((a) => a.startsWith("--outcomes="))?.slice("--outcomes=".length);
  if (outcomesFlag !== undefined && !["illustrative", "methods", "none"].includes(outcomesFlag)) {
    throw new Error(`--outcomes must be "illustrative", "methods" or "none", got "${outcomesFlag}"`);
  }
  const fallback: OutcomeMode = pilotRegion === "fixture-region" ? "illustrative" : "methods";
  return { pilotRegion, outcomes: (outcomesFlag as OutcomeMode | undefined) ?? fallback };
}

/** The cited outcome methods (ADR-0008): each method's rows replace its previous run in one transaction. */
async function materializeCitedMethods(pilotRegion: string, unitIds: readonly string[]): Promise<void> {
  for (const cited of CITED_OUTCOME_METHODS) {
    await upsertOutcomeMethod(cited.method);
    const values = await listCriterionValuesForPilotRegion(pilotRegion, cited.criteria);
    const valuesByUnit = new Map<string, CriterionValue[]>();
    for (const value of values) {
      const list = valuesByUnit.get(value.spatialUnitId) ?? [];
      list.push(value);
      valuesByUnit.set(value.spatialUnitId, list);
    }
    const written = await replaceOutcomesForPilotRegion(
      pilotRegion,
      cited.method.methodVersion,
      methodOutcomeRows(cited, unitIds, valuesByUnit),
    );
    console.log(`  ${cited.method.methodVersion}: ${written} outcome rows from ${values.length} criterion values`);
  }
}

async function main() {
  const { pilotRegion, outcomes } = parseArgs(process.argv.slice(2));
  console.log(
    `materializing scores for pilot_region "${pilotRegion}" using illustrative-weights.ts ` +
      `(method_version=${CURRENT_METHOD_VERSION}, outcomes=${outcomes})`,
  );

  const [unitIds, allDefinitions] = await Promise.all([listSpatialUnitIds(pilotRegion), listCriterionDefinitions()]);
  // Suitability reads only criteria that apply to a technology; outcome-method
  // inputs (weight 0, scenarios in applies_to) are read by their methods.
  const definitions = allDefinitions.filter((d) =>
    d.appliesTo.some((t) => (TECHNOLOGIES as readonly string[]).includes(t)),
  );
  const allValues = await listCriterionValuesForPilotRegion(
    pilotRegion,
    definitions.map((d) => d.id),
  );

  if (unitIds.length === 0) {
    console.warn(`no spatial_unit rows found for pilot_region "${pilotRegion}" — nothing to materialize`);
    return;
  }

  const valuesByUnit = new Map<string, CriterionValue[]>();
  for (const value of allValues) {
    const list = valuesByUnit.get(value.spatialUnitId) ?? [];
    list.push(value);
    valuesByUnit.set(value.spatialUnitId, list);
  }

  const verdicts: SuitabilityVerdict[] = [];
  let skippedVerdicts = 0;
  let outcomeCount = 0;

  for (const spatialUnitId of unitIds) {
    const values = valuesByUnit.get(spatialUnitId) ?? [];

    for (const technology of TECHNOLOGIES) {
      try {
        const verdict = computeSuitability({
          spatialUnitId,
          technology,
          values,
          definitions,
          normalize: illustrativeNormalize,
          suitabilityThreshold: ILLUSTRATIVE_SUITABILITY_THRESHOLD,
          methodVersion: CURRENT_METHOD_VERSION,
        });
        verdicts.push(verdict);
      } catch (err) {
        if (err instanceof SelaScoringError) {
          // No scoreable criterion values for this unit/technology yet —
          // skip rather than aborting the whole run (roadmap §4.3's
          // contract: absence is not evidence of anything).
          skippedVerdicts += 1;
          continue;
        }
        throw err;
      }
    }

    if (outcomes !== "illustrative") continue;
    for (const scenario of SCENARIOS) {
      for (const dimension of OUTCOME_DIMENSIONS) {
        const aggregated = illustrativeOutcomeAggregate(scenario, dimension, values);
        const row = computeOutcomeRow({
          spatialUnitId,
          scenario,
          dimension,
          aggregated,
          methodVersion: CURRENT_METHOD_VERSION,
        });
        await upsertOutcomeRow(row);
        outcomeCount += 1;
      }
    }
  }

  await replaceVerdictsForPilotRegion(pilotRegion, CURRENT_METHOD_VERSION, verdicts);
  if (outcomes === "methods") {
    valuesByUnit.clear();
    await materializeCitedMethods(pilotRegion, unitIds);
  }
  const verdictCount = verdicts.length;
  console.log(
    `materialized ${verdictCount} verdicts (${skippedVerdicts} skipped — no scoreable criteria) ` +
      `and ${outcomeCount} illustrative outcome rows across ${unitIds.length} units`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
