// The shared outcome dimensions scenarios are compared on (mvp.md §8.3),
// and the deltas between a scenario and the status_quo baseline. Pure
// arithmetic — see docs/architecture/adr-0002-geodata-stack.md.

import type { Confidence, OutcomeDelta, OutcomeDimension, OutcomeRow, Scenario } from "./types";
import { SelaScoringError } from "./types";

/**
 * The result of aggregating whatever criteria feed one outcome dimension
 * for one scenario, or `null` if no defensible aggregation exists yet for
 * this dimension (U2 — nature-capital indicators are the clearest example:
 * an indicator is not modelled until it is citable to an established
 * method, per `CLAUDE.md` §5). This module does not perform the
 * aggregation itself — *which* criteria feed which dimension, and how, is
 * domain/scoring-gate work — it only enforces the invariant that follows
 * from the result: no aggregation ⇒ `not_modelled`, never a zero and never
 * a silently-dropped row.
 */
export interface AggregatedOutcome {
  readonly value: number;
  readonly unit: string | null;
  readonly confidence: Confidence;
}

export interface ComputeOutcomeRowParams {
  readonly spatialUnitId: string;
  readonly scenario: Scenario;
  readonly dimension: OutcomeDimension;
  readonly aggregated: AggregatedOutcome | null;
  readonly methodVersion: string;
}

/**
 * Builds one `outcome` row. Mirrors the CHECK constraint on the `outcome`
 * table exactly: `status = 'not_modelled'` if and only if there is no
 * aggregated value, so a row this function returns is always valid to
 * insert as-is.
 */
export function computeOutcomeRow(params: ComputeOutcomeRowParams): OutcomeRow {
  const { spatialUnitId, scenario, dimension, aggregated, methodVersion } = params;

  if (aggregated === null) {
    return {
      spatialUnitId,
      scenario,
      dimension,
      value: null,
      unit: null,
      confidence: null,
      status: "not_modelled",
      methodVersion,
    };
  }

  return {
    spatialUnitId,
    scenario,
    dimension,
    value: aggregated.value,
    unit: aggregated.unit,
    confidence: aggregated.confidence,
    status: "modelled",
    methodVersion,
  };
}

/**
 * The delta between a scenario's outcome and the status_quo baseline for
 * the same spatial unit and dimension (roadmap §4.3, mvp.md §5's `develop`
 * and `restore` output shapes). Returns `null` if either row is
 * `not_modelled` — a delta against an unknown value is not a number sela
 * can display, so the caller must show "not yet modelled" instead of a
 * computed delta, never fall back to treating the missing side as zero.
 */
export function computeOutcomeDelta(current: OutcomeRow, baseline: OutcomeRow): OutcomeDelta | null {
  if (baseline.scenario !== "status_quo") {
    throw new SelaScoringError(
      `computeOutcomeDelta baseline must be the status_quo row, got scenario "${baseline.scenario}"`,
    );
  }
  if (current.spatialUnitId !== baseline.spatialUnitId || current.dimension !== baseline.dimension) {
    throw new SelaScoringError(
      "computeOutcomeDelta requires current and baseline to share the same spatial unit and dimension",
    );
  }

  if (current.status === "not_modelled" || baseline.status === "not_modelled") {
    return null;
  }

  return {
    spatialUnitId: current.spatialUnitId,
    scenario: current.scenario,
    dimension: current.dimension,
    baselineValue: baseline.value!,
    scenarioValue: current.value!,
    delta: current.value! - baseline.value!,
    unit: current.unit,
  };
}
