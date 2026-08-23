// Shared types for lib/scoring/. Mirrors the shape of
// lib/db/migrations/0002_domain_schema.sql exactly, so a row read from the
// database and a row this module produces are interchangeable — see
// docs/architecture/adr-0002-geodata-stack.md: this module is pure
// arithmetic and comparison over already-computed values, never geometry
// or raster math, and never I/O.

export type Scenario =
  | "status_quo"
  | "develop_pv"
  | "develop_agripv"
  | "develop_wind"
  | "preserve"
  | "restore";

/** Canonical enumeration order, matching the `outcome.scenario` CHECK constraint. */
export const SCENARIOS: readonly Scenario[] = [
  "status_quo",
  "develop_pv",
  "develop_agripv",
  "develop_wind",
  "preserve",
  "restore",
];

export type Technology = "pv" | "agripv" | "wind";

/** Canonical enumeration order, matching the `suitability_verdict.technology` CHECK constraint. */
export const TECHNOLOGIES: readonly Technology[] = ["pv", "agripv", "wind"];

export type OutcomeDimension =
  | "energy"
  | "climate"
  | "nature_capital"
  | "soil_water"
  | "land_use"
  | "local_benefit";

/** Canonical enumeration order, matching the `outcome.dimension` CHECK constraint. */
export const OUTCOME_DIMENSIONS: readonly OutcomeDimension[] = [
  "energy",
  "climate",
  "nature_capital",
  "soil_water",
  "land_use",
  "local_benefit",
];

export type Direction = "higher_better" | "lower_better" | "non_monotonic";

export type Confidence = "high" | "medium" | "low";

export type OutcomeStatus = "modelled" | "not_modelled";

export type SuitabilityVerdictLabel = "suitable" | "unsuitable" | "excluded";

/**
 * A `criterion_definition` row. Real rows (with a confirmed weight) are
 * scoring-gate work — see docs/domain/scoring-criteria.md. This module
 * accepts them as plain data; it does not know or assume any particular
 * weight is "real".
 */
export interface CriterionDefinition {
  readonly id: string;
  readonly sourceId: string;
  readonly direction: Direction;
  readonly weight: number;
  readonly isHardConstraint: boolean;
  readonly appliesTo: readonly string[];
  readonly methodVersion: string;
}

/** A `criterion_value` row: one measured value for one spatial unit. */
export interface CriterionValue {
  readonly criterionId: string;
  readonly spatialUnitId: string;
  readonly value: number;
  readonly unit: string | null;
  readonly confidence: Confidence;
  readonly sourceId: string;
  readonly methodVersion: string;
}

/** A `suitability_verdict` row — flow F2. */
export interface SuitabilityVerdict {
  readonly spatialUnitId: string;
  readonly technology: Technology;
  readonly verdict: SuitabilityVerdictLabel;
  readonly score: number | null;
  readonly limitingCriterionId: string | null;
  readonly excludedByCriterionId: string | null;
  readonly methodVersion: string;
}

/** An `outcome` row. status = 'not_modelled' is a first-class state (mvp.md §8.3). */
export interface OutcomeRow {
  readonly spatialUnitId: string;
  readonly scenario: Scenario;
  readonly dimension: OutcomeDimension;
  readonly value: number | null;
  readonly unit: string | null;
  readonly confidence: Confidence | null;
  readonly status: OutcomeStatus;
  readonly methodVersion: string;
}

/**
 * The delta between a scenario's outcome and the status_quo baseline for
 * the same dimension. Not a stored table — computed on demand from two
 * `OutcomeRow`s, since deltas are always relative to whichever baseline row
 * is current for a given method_version.
 */
export interface OutcomeDelta {
  readonly spatialUnitId: string;
  readonly scenario: Scenario;
  readonly dimension: OutcomeDimension;
  readonly baselineValue: number;
  readonly scenarioValue: number;
  readonly delta: number;
  readonly unit: string | null;
}

/** Raised when a scoring function is called without enough data to produce a result. */
export class SelaScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelaScoringError";
  }
}
