// Phase 3 (0.3.0) bridge from criterion_value rows to suitability_verdict/
// outcome rows. TypeScript-side, not shell/SQL — per ADR-0002 this is
// arithmetic and comparison over already-computed values, not geometry or
// raster math, so it runs from the app/builder image rather than inside
// the GDAL ingest container (which has no Node runtime). See
// ingest/README.md "Materializing scores (Phase 3, 0.3.0)".
//
// Usage: pnpm db:materialize -- --pilot-region=fixture-region [--outcomes=illustrative|none]
//
// Outcomes default to `illustrative` for the synthetic fixture and `none` for
// every real pilot region. The illustrative outcome shapes invent energy,
// climate and nature-capital figures from a "site quality" scalar; on the
// fixture that exercises the comparison screen, on real land it would put
// made-up MWh/a on real fields. With `none`, the comparison screen shows every
// real unit's outcomes as "noch nicht modelliert" — the schema's own state
// for exactly this (mvp.md §8.3).

import { getPool } from "../lib/db/client";
import { listCriterionDefinitions, listCriterionValuesForPilotRegion } from "../lib/db/queries/criteria";
import { upsertOutcomeRow } from "../lib/db/queries/outcomes";
import { listSpatialUnitIds } from "../lib/db/queries/spatial-units";
import { replaceVerdictsForPilotRegion } from "../lib/db/queries/verdicts";
import { CURRENT_METHOD_VERSION } from "../lib/scoring/method-version";
import { computeOutcomeRow } from "../lib/scoring/outcomes";
import { computeSuitability } from "../lib/scoring/suitability";
import { OUTCOME_DIMENSIONS, SCENARIOS, SelaScoringError, TECHNOLOGIES } from "../lib/scoring/types";
import type { CriterionValue, SuitabilityVerdict } from "../lib/scoring/types";
import {
  ILLUSTRATIVE_SUITABILITY_THRESHOLD,
  illustrativeNormalize,
  illustrativeOutcomeAggregate,
} from "../lib/scoring/illustrative-weights";

function parseArgs(argv: readonly string[]): { pilotRegion: string; outcomes: "illustrative" | "none" } {
  const flag = argv.find((a) => a.startsWith("--pilot-region="));
  const pilotRegion = flag ? flag.slice("--pilot-region=".length) : "fixture-region";
  const outcomesFlag = argv.find((a) => a.startsWith("--outcomes="))?.slice("--outcomes=".length);
  if (outcomesFlag !== undefined && outcomesFlag !== "illustrative" && outcomesFlag !== "none") {
    throw new Error(`--outcomes must be "illustrative" or "none", got "${outcomesFlag}"`);
  }
  return { pilotRegion, outcomes: outcomesFlag ?? (pilotRegion === "fixture-region" ? "illustrative" : "none") };
}

async function main() {
  const { pilotRegion, outcomes } = parseArgs(process.argv.slice(2));
  console.log(
    `materializing scores for pilot_region "${pilotRegion}" using illustrative-weights.ts ` +
      `(method_version=${CURRENT_METHOD_VERSION}, outcomes=${outcomes})`,
  );

  const [unitIds, definitions, allValues] = await Promise.all([
    listSpatialUnitIds(pilotRegion),
    listCriterionDefinitions(),
    listCriterionValuesForPilotRegion(pilotRegion),
  ]);

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

    if (outcomes === "none") continue;
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
  const verdictCount = verdicts.length;
  console.log(
    `materialized ${verdictCount} verdicts (${skippedVerdicts} skipped — no scoreable criteria) ` +
      `and ${outcomeCount} outcome rows across ${unitIds.length} units`,
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
