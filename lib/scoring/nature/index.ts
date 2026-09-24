// The cited outcome methods (ADR-0008, docs/domain/scoring-criteria.md §4),
// and the one place that turns a method's per-unit results into outcome rows
// with their inputs. Pure: the materialiser does the I/O.

import { computeOutcomeRow } from "../outcomes";
import { SCENARIOS } from "../types";
import type { CriterionValue, OutcomeRow, Scenario } from "../types";
import type { OutcomeMethod } from "./method";
import type { MetricOutcome } from "./peat-climate";
import { PEAT_CLIMATE_CRITERIA, PEAT_CLIMATE_METHOD, peatClimateOutcomes } from "./peat-climate";
import { WATER_CRITERIA, WATER_METHOD, waterOutcomes } from "./water";

export interface CitedOutcomeMethod {
  readonly method: OutcomeMethod;
  /** Every criterion id the method reads. */
  readonly criteria: readonly string[];
  readonly compute: (scenario: Scenario, values: readonly CriterionValue[]) => MetricOutcome[];
}

export const CITED_OUTCOME_METHODS: readonly CitedOutcomeMethod[] = [
  { method: PEAT_CLIMATE_METHOD, criteria: PEAT_CLIMATE_CRITERIA, compute: peatClimateOutcomes },
  { method: WATER_METHOD, criteria: WATER_CRITERIA, compute: waterOutcomes },
];

export interface OutcomeRowWithInputs {
  readonly row: OutcomeRow;
  readonly criterionValueIds: readonly number[];
}

/**
 * Every scenario × metric row of one method for the given units — a row for
 * each, so no scenario is ever silently missing (mvp.md §8.3). Inputs must
 * carry their database ids; a modelled outcome whose inputs have none is an
 * error, because its provenance could not be written.
 */
export function* methodOutcomeRows(
  cited: CitedOutcomeMethod,
  unitIds: Iterable<string>,
  valuesByUnit: ReadonlyMap<string, readonly CriterionValue[]>,
): Generator<OutcomeRowWithInputs> {
  const { method } = cited;
  for (const spatialUnitId of unitIds) {
    const values = valuesByUnit.get(spatialUnitId) ?? [];
    for (const scenario of SCENARIOS) {
      for (const { metric, result, inputs } of cited.compute(scenario, values)) {
        const row = computeOutcomeRow({
          spatialUnitId,
          scenario,
          dimension: method.dimension,
          metric,
          aggregated: result,
          methodVersion: method.methodVersion,
        });
        const criterionValueIds = inputs.map((v) => {
          if (v.id === undefined) {
            throw new Error(`criterion value ${v.criterionId} for ${spatialUnitId} has no id; outcome_input needs it`);
          }
          return v.id;
        });
        yield { row, criterionValueIds };
      }
    }
  }
}
