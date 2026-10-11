// Phase 3 (0.3.0) bridge from criterion_value rows to suitability_verdict/
// outcome rows. TypeScript-side, not shell/SQL — per ADR-0002 this is
// arithmetic and comparison over already-computed values, not geometry or
// raster math, so it runs from the app/builder image rather than inside
// the GDAL ingest container (which has no Node runtime). See
// ingest/README.md "Materializing scores (Phase 3, 0.3.0)".
//
// Usage: pnpm db:materialize -- --region=fixture-region [--outcomes=illustrative|methods|none]
//                                [--steps=verdicts,outcomes,overview] [--methods=water-arcegmo-v2,…]
//        (--pilot-region= is accepted as the older spelling)
//
// --steps runs only the named parts — a Land takes tens of minutes, and a
// run cut short (the Sachsen run of 2026-10-10 lost its outcome pass to a
// time limit after the verdicts had committed) is resumed, not restarted.
// Each part replaces its own rows; none depends on the others having run in
// the same invocation.
//
// Outcomes default to `illustrative` for the synthetic fixture and `methods`
// for every real region. The illustrative outcome shapes invent energy,
// climate and nature-capital figures from a "site quality" scalar; on the
// fixture that exercises the comparison screen, on real land it would put
// made-up MWh/a on real fields. `methods` writes only the cited outcome
// methods of lib/scoring/nature/ (ADR-0008, docs/domain/scoring-criteria.md
// §4), each under its own method_version, with outcome_input rows linking
// every number to its criterion values; every other dimension stays
// "noch nicht modelliert" (mvp.md §8.3). `none` writes no outcomes.
//
// A region is processed in chunks of units (ADR-0012): a Land is a million
// cells, and their criterion values do not fit in memory at once. Only the
// fixture's weighted criteria need every value up front (the limiting-
// criterion reference, decision memo Q5); real regions are classified cell
// by cell and never need it.
//
// After the verdicts, ingest/08_materialize_overview.sql writes the per-region
// aggregates the explorer reads (the overview pyramid, the legend's counts,
// the sources credited), for the grid region and each Landkreis in it.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../lib/db/client";
import { listCriterionDefinitions, listCriterionValuesForPilotRegion } from "../lib/db/queries/criteria";
import { replaceOutcomesForPilotRegion, upsertOutcomeMethod, upsertOutcomeRow } from "../lib/db/queries/outcomes";
import { listSpatialUnitIds } from "../lib/db/queries/spatial-units";
import { listCriterionValuesForUnits } from "../lib/db/queries/unit-set";
import { replaceVerdictsForPilotRegion } from "../lib/db/queries/verdicts";
import { listProtectionOverlapsForPilotRegion } from "../lib/db/queries/protection";
import { protectionFlags, type ProtectionOverlap } from "../lib/scoring/protection-flags";
import { CURRENT_METHOD_VERSION } from "../lib/scoring/method-version";
import { CITED_OUTCOME_METHODS, methodOutcomeRows, type OutcomeRowWithInputs } from "../lib/scoring/nature";
import { computeOutcomeRow } from "../lib/scoring/outcomes";
import { LIMITING_MIN_GAP } from "../lib/scoring/pv-rules";
import { computeLimitingReference, computeSuitability, type LimitingReference } from "../lib/scoring/suitability";
import { OUTCOME_DIMENSIONS, SCENARIOS, SelaScoringError, TECHNOLOGIES } from "../lib/scoring/types";
import type { CriterionValue, SuitabilityVerdict, Technology } from "../lib/scoring/types";
import {
  ILLUSTRATIVE_SUITABILITY_THRESHOLD,
  illustrativeNormalize,
  illustrativeOutcomeAggregate,
} from "../lib/scoring/illustrative-weights";

type OutcomeMode = "illustrative" | "methods" | "none";
type Step = "verdicts" | "outcomes" | "overview";
const ALL_STEPS: readonly Step[] = ["verdicts", "outcomes", "overview"];

/** Units per chunk: ~100 000 cells × a dozen values is a few hundred MB of rows, well inside a 2 GB heap. */
const CHUNK_UNITS = 50_000;

const OVERVIEW_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "08_materialize_overview.sql");

function parseArgs(argv: readonly string[]): {
  pilotRegion: string;
  outcomes: OutcomeMode;
  steps: ReadonlySet<Step>;
  methods: ReadonlySet<string> | null;
} {
  const flag = argv.find((a) => a.startsWith("--region=") || a.startsWith("--pilot-region="));
  const pilotRegion = flag ? flag.slice(flag.indexOf("=") + 1) : "fixture-region";
  const outcomesFlag = argv.find((a) => a.startsWith("--outcomes="))?.slice("--outcomes=".length);
  if (outcomesFlag !== undefined && !["illustrative", "methods", "none"].includes(outcomesFlag)) {
    throw new Error(`--outcomes must be "illustrative", "methods" or "none", got "${outcomesFlag}"`);
  }
  const stepsFlag = argv.find((a) => a.startsWith("--steps="))?.slice("--steps=".length);
  const steps = new Set<Step>(ALL_STEPS);
  if (stepsFlag !== undefined) {
    steps.clear();
    for (const step of stepsFlag.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!(ALL_STEPS as readonly string[]).includes(step)) throw new Error(`--steps: unknown step "${step}" (verdicts, outcomes, overview)`);
      steps.add(step as Step);
    }
    if (steps.size === 0) throw new Error("--steps names no step");
  }
  // --methods=water-arcegmo-v2[,…] runs only the named cited methods of the
  // outcome step: each method's rows are one transaction of its own, so a
  // run that lost one method (a disk that filled, a kill) is completed by
  // writing that method alone rather than rewriting the Land's others.
  const methodsFlag = argv.find((a) => a.startsWith("--methods="))?.slice("--methods=".length);
  let methods: ReadonlySet<string> | null = null;
  if (methodsFlag !== undefined) {
    const known = CITED_OUTCOME_METHODS.map((c) => c.method.methodVersion);
    const named = methodsFlag.split(",").map((x) => x.trim()).filter(Boolean);
    for (const m of named) {
      if (!known.includes(m)) throw new Error(`--methods: unknown method "${m}" (${known.join(", ")})`);
    }
    if (named.length === 0) throw new Error("--methods names no method");
    methods = new Set(named);
  }
  const fallback: OutcomeMode = pilotRegion === "fixture-region" ? "illustrative" : "methods";
  return { pilotRegion, outcomes: (outcomesFlag as OutcomeMode | undefined) ?? fallback, steps, methods };
}

function* chunks<T>(items: readonly T[], size: number): Generator<readonly T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

function groupByUnit(values: readonly CriterionValue[]): Map<string, CriterionValue[]> {
  const byUnit = new Map<string, CriterionValue[]>();
  for (const value of values) {
    const list = byUnit.get(value.spatialUnitId) ?? [];
    list.push(value);
    byUnit.set(value.spatialUnitId, list);
  }
  return byUnit;
}

/** The cited outcome methods (ADR-0008): each method's rows replace its previous run in one transaction, chunk by chunk. */
async function materializeCitedMethods(
  pilotRegion: string,
  unitIds: readonly string[],
  only: ReadonlySet<string> | null,
): Promise<void> {
  for (const cited of CITED_OUTCOME_METHODS) {
    if (only && !only.has(cited.method.methodVersion)) continue;
    await upsertOutcomeMethod(cited.method);
    let valueCount = 0;
    async function* rows(): AsyncGenerator<OutcomeRowWithInputs> {
      for (const chunk of chunks(unitIds, CHUNK_UNITS)) {
        const values = await listCriterionValuesForUnits(chunk, cited.criteria);
        valueCount += values.length;
        yield* methodOutcomeRows(cited, chunk, groupByUnit(values));
      }
    }
    const written = await replaceOutcomesForPilotRegion(pilotRegion, cited.method.methodVersion, rows());
    console.log(`  ${cited.method.methodVersion}: ${written} outcome rows from ${valueCount} criterion values`);
  }
}

async function main() {
  const { pilotRegion, outcomes, steps, methods } = parseArgs(process.argv.slice(2));
  console.log(
    `materializing ${[...steps].join(", ")} for region "${pilotRegion}" (criteria with weight > 0 are scored with the ` +
      `illustrative weights; real PV is classified by the decided rules, real-pv-v1) ` +
      `(method_version=${CURRENT_METHOD_VERSION}, outcomes=${outcomes})`,
  );

  const [unitIds, allDefinitions] = await Promise.all([listSpatialUnitIds(pilotRegion), listCriterionDefinitions()]);
  // Suitability reads only criteria that apply to a technology; outcome-method
  // inputs (weight 0, scenarios in applies_to) are read by their methods.
  const definitions = allDefinitions.filter((d) =>
    d.appliesTo.some((t) => (TECHNOLOGIES as readonly string[]).includes(t)),
  );
  const criterionIds = definitions.map((d) => d.id);

  if (unitIds.length === 0) {
    console.warn(`no spatial_unit rows found for region "${pilotRegion}" — nothing to materialize`);
    return;
  }

  // Flow F2's Q5 rule (decision memo): a limiting criterion is named against
  // the best value of that criterion among the units scored for the same
  // technology in this region — the compared land — so a first pass finds
  // those best values. Only weighted criteria have one; a real region's are
  // all weight 0 (classified, real-pv-v1), so it skips the pass and the memory.
  const weighted = definitions.some((d) => d.weight > 0);
  let limitingReference: Map<Technology, LimitingReference> | undefined;
  if (weighted) {
    const valuesByUnit = groupByUnit(await listCriterionValuesForPilotRegion(pilotRegion, criterionIds));
    limitingReference = new Map(
      TECHNOLOGIES.map((technology) => [
        technology,
        {
          best: computeLimitingReference({ technology, valuesByUnit, definitions, normalize: illustrativeNormalize }),
          minGap: LIMITING_MIN_GAP,
        },
      ]),
    );
  }

  // Prüfhinweise per unit, counted with the one rule that words them
  // (lib/scoring/protection-flags.ts), so the map can mark flagged cells. Only
  // where the strict-protection share exists — the rule reads it.
  const overlapsByUnit = new Map<string, ProtectionOverlap[]>();
  for (const overlap of await listProtectionOverlapsForPilotRegion(pilotRegion)) {
    const list = overlapsByUnit.get(overlap.spatialUnitId) ?? [];
    list.push(overlap);
    overlapsByUnit.set(overlap.spatialUnitId, list);
  }
  const flagCount = (values: readonly CriterionValue[]): number | null => {
    const strict = values.find((v) => v.criterionId === "pv_protection_status");
    if (!strict) return null;
    return protectionFlags(overlapsByUnit.get(strict.spatialUnitId) ?? [], strict.value).length;
  };

  let skippedVerdicts = 0;
  let outcomeCount = 0;
  let done = 0;

  async function* verdicts(): AsyncGenerator<SuitabilityVerdict> {
    for (const chunk of chunks(unitIds, CHUNK_UNITS)) {
      const valuesByUnit = groupByUnit(await listCriterionValuesForUnits(chunk, criterionIds));
      for (const spatialUnitId of chunk) {
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
              limitingReference: limitingReference?.get(technology),
            });
            yield technology === "wind" ? verdict : { ...verdict, protectionFlagCount: flagCount(values) };
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
      done += chunk.length;
      if (unitIds.length > CHUNK_UNITS) console.log(`  ${done} / ${unitIds.length} units`);
    }
  }

  if (steps.has("verdicts")) {
    const verdictCount = await replaceVerdictsForPilotRegion(pilotRegion, CURRENT_METHOD_VERSION, verdicts());
    console.log(
      `materialized ${verdictCount} verdicts (${skippedVerdicts} skipped — no scoreable criteria) ` +
        `and ${outcomeCount} illustrative outcome rows across ${unitIds.length} units`,
    );
  }
  overlapsByUnit.clear();
  if (steps.has("outcomes") && outcomes === "methods") {
    await materializeCitedMethods(pilotRegion, unitIds, methods);
  }
  if (!steps.has("overview")) return;

  console.log("materializing the overview pyramid and per-region counts (ingest/08_materialize_overview.sql)");
  const sql = (await readFile(OVERVIEW_SQL, "utf8"))
    // psql variables, resolved here: the file is also runnable with psql -v.
    .replaceAll(":'grid_region'", `'${pilotRegion.replaceAll("'", "''")}'`)
    .replaceAll(":'method_version'", `'${CURRENT_METHOD_VERSION.replaceAll("'", "''")}'`)
    .replace(/^\\set .*$/gm, "");
  const client = await getPool().connect();
  try {
    const result = await client.query(sql);
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    for (const row of last?.rows ?? []) {
      console.log(`  ${row.region_id}: ${row.hexagons} hexagons of ${row.level_m} m over ${row.cells} cells`);
    }
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
