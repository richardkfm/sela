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
 *
 * `low`/`high` are a range the method publishes (ADR-0008 §2): both or
 * neither, and `value` must lie inside it.
 */
export interface AggregatedOutcome {
  readonly value: number;
  readonly unit: string | null;
  readonly confidence: Confidence;
  readonly low?: number;
  readonly high?: number;
}

/**
 * `"not_applicable"` is the method's own finding that there is nothing to
 * measure in this unit (ADR-0008 §3), as opposed to `null`: no method.
 */
export type OutcomeResult = AggregatedOutcome | "not_applicable" | null;

export interface ComputeOutcomeRowParams {
  readonly spatialUnitId: string;
  readonly scenario: Scenario;
  readonly dimension: OutcomeDimension;
  /** Defaults to the dimension itself — one measure, named after it. */
  readonly metric?: string;
  readonly aggregated: OutcomeResult;
  readonly methodVersion: string;
}

/**
 * Builds one `outcome` row. Mirrors the CHECK constraints on the `outcome`
 * table exactly: a value if and only if `status = 'modelled'`, and a range
 * only around that value, so a row this function returns is always valid to
 * insert as-is.
 */
export function computeOutcomeRow(params: ComputeOutcomeRowParams): OutcomeRow {
  const { spatialUnitId, scenario, dimension, aggregated, methodVersion } = params;
  const metric = params.metric ?? dimension;

  if (aggregated === null || aggregated === "not_applicable") {
    return {
      spatialUnitId,
      scenario,
      dimension,
      metric,
      value: null,
      valueLow: null,
      valueHigh: null,
      unit: null,
      confidence: null,
      status: aggregated === null ? "not_modelled" : "not_applicable",
      methodVersion,
    };
  }

  const { value, low, high } = aggregated;
  if (!Number.isFinite(value)) {
    throw new SelaScoringError(`outcome ${dimension}/${metric} for ${spatialUnitId} is not a finite number`);
  }
  if ((low === undefined) !== (high === undefined)) {
    throw new SelaScoringError(`outcome ${dimension}/${metric}: a range needs both a low and a high end`);
  }
  if (low !== undefined && high !== undefined && !(low <= value && value <= high)) {
    throw new SelaScoringError(
      `outcome ${dimension}/${metric}: value ${value} lies outside its range [${low}, ${high}]`,
    );
  }

  return {
    spatialUnitId,
    scenario,
    dimension,
    metric,
    value,
    valueLow: low ?? null,
    valueHigh: high ?? null,
    unit: aggregated.unit,
    confidence: aggregated.confidence,
    status: "modelled",
    methodVersion,
  };
}

/**
 * The delta between a scenario's outcome and the status_quo baseline for
 * the same spatial unit and metric (roadmap §4.3, mvp.md §5's `develop`
 * and `restore` output shapes). Returns `null` if either row is not
 * `modelled` — a delta against an unknown or inapplicable value is not a
 * number sela can display, so the caller must show that state instead of a
 * computed delta, never fall back to treating the missing side as zero.
 *
 * Refuses rows of different metrics (ADR-0008 §1) — a caller error — and
 * returns `null` for rows of different units: subtracting a carbon stock from
 * an annual emission, or "t CO2e/a avoided" from "t CO2e/a", is not a number
 * sela can show. (The illustrative fixture has such pairs; before this guard
 * their difference reached the comparison screen.)
 */
export function computeOutcomeDelta(current: OutcomeRow, baseline: OutcomeRow): OutcomeDelta | null {
  if (baseline.scenario !== "status_quo") {
    throw new SelaScoringError(
      `computeOutcomeDelta baseline must be the status_quo row, got scenario "${baseline.scenario}"`,
    );
  }
  if (
    current.spatialUnitId !== baseline.spatialUnitId ||
    current.dimension !== baseline.dimension ||
    current.metric !== baseline.metric
  ) {
    throw new SelaScoringError(
      "computeOutcomeDelta requires current and baseline to share the same spatial unit, dimension and metric",
    );
  }

  if (current.status !== "modelled" || baseline.status !== "modelled") {
    return null;
  }
  if (current.unit !== baseline.unit) {
    return null;
  }

  return {
    spatialUnitId: current.spatialUnitId,
    scenario: current.scenario,
    dimension: current.dimension,
    metric: current.metric,
    baselineValue: baseline.value!,
    scenarioValue: current.value!,
    delta: current.value! - baseline.value!,
    unit: current.unit,
  };
}
