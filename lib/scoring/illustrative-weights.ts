// ILLUSTRATIVE, NOT REAL. The weights, bounds and suitability threshold here
// were never confirmed through the CLAUDE.md §3 gate
// (docs/domain/scoring-criteria.md) — this module does not close that gate or
// narrow it. After roadmap Step 2 no real region reads them: real PV is
// classified without a score (real-pv-v1). The module exists so
// Phase 3's screens and exports (roadmap §5) have something to render
// against the synthetic fixture dataset (ingest/fixtures/) while that gate
// stays open, per the architecture-first split confirmed with the project
// owner for this phase (see CHANGELOG.md [0.3.0]).
//
// The rules the project owner has decided (roadmap Steps 1 and 2: irradiation
// bounds, the exclusion share, land-cover tiers, the limiting-criterion rule,
// and — Step 2 — classification without a score for real PV) live in
// lib/scoring/pv-rules.ts; this module applies them next to the placeholders,
// which after Step 2 only the synthetic fixture still reads. Every value this module adds is arbitrary by construction. Nothing
// here may be read as, or silently become, a real scoring decision — any
// screen or export that surfaces a number derived from this module MUST
// show ILLUSTRATIVE_MARKER alongside it.

import { IRRADIATION_BOUNDS, PROTECTION_EXCLUSION_SHARE, landCoverTier, type LandCoverTier } from "./pv-rules";
import type { Normalize } from "./suitability";
import type { AggregatedOutcome } from "./outcomes";
import type { CategoryClass, CriterionValue, OutcomeDimension, Scenario } from "./types";

export const ILLUSTRATIVE_MARKER = {
  en: "ILLUSTRATIVE — not yet confirmed",
  de: "ILLUSTRATIV — noch nicht bestätigt",
} as const;

/**
 * Matches the weight the fixture criterion_definition rows are seeded with
 * (ingest/fixtures/seed_fixture_definitions.sql) — kept here as a named,
 * documented constant rather than a bare number repeated in two files.
 */
export const ILLUSTRATIVE_EQUAL_WEIGHT = 1.0;

/** Arbitrary midpoint threshold — not derived from any method. */
export const ILLUSTRATIVE_SUITABILITY_THRESHOLD = 0.5;

/**
 * 0..1 scaling bounds per criterion id. The fixture criteria are seeded to
 * report roughly in this range already (see ingest/05_sample.sql), so for
 * them this is a clamp-and-orient step, not a meaningful scientific scale.
 */
const BOUNDS: Record<string, { min: number; max: number }> = {
  fixture_land_cover_coverage: { min: 0, max: 1 },
  fixture_agripv_suitability: { min: 0, max: 1 },
  fixture_wind_resource: { min: 0, max: 1 },
  // Decided (memo Q4b): the national p1–p99 of the DWD 2016–2025 mean.
  pv_irradiation_annual: IRRADIATION_BOUNDS,
  // pv_slope has no bounds: under real-pv-v1 slope is a measured value with
  // weight 0, never scored (decided 2026-09-28 — DGM200 is too coarse and no
  // citable limit bites in the Uckermark; docs/domain/decision-memo-pv-method.md).
};

/**
 * Raw value at or above which a hard constraint counts as violated. The
 * fixture flag is 0/1; the real protection criteria are the *share* of a cell
 * inside a Naturschutzgebiet or the Nationalpark (ingest/real/20_sample.sql),
 * excluded from half the cell on (decided, memo Q2d; lib/scoring/pv-rules.ts).
 */
const CONSTRAINT_THRESHOLD: Record<string, number> = {
  fixture_protection_status: 1,
  pv_protection_status: PROTECTION_EXCLUSION_SHARE,
  wind_protection_status: PROTECTION_EXCLUSION_SHARE,
};

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

const TIER_CLASS: Record<LandCoverTier, CategoryClass> = {
  vorgesehen: "unrestricted",
  eingeschraenkt: "restricted",
  nicht_vorgesehen: "not_considered",
};

/**
 * Caller-supplied `Normalize` for `computeSuitability` (lib/scoring/suitability.ts).
 * A hard constraint is violated once its raw value reaches its entry in
 * CONSTRAINT_THRESHOLD (default 1, the fixture's 0/1 flag). Land cover is a
 * category (memo Q3b and its follow-up): its tier places the cell, and it never
 * moves a score. Under `real-pv-v1` the real PV criteria carry weight 0, so a
 * real cell is classified by its tier and never scored (ADR-0009, amendment 1);
 * the bounds below then only matter to the fixture and to evidence scripts.
 */
export const illustrativeNormalize: Normalize = (value, definition) => {
  if (definition.isHardConstraint) {
    const threshold = CONSTRAINT_THRESHOLD[definition.id] ?? 1;
    return { normalizedScore: 0, violatesConstraint: value.value >= threshold };
  }
  if (definition.id === "pv_land_cover") {
    return { normalizedScore: 0, violatesConstraint: false, categoryClass: TIER_CLASS[landCoverTier(value.value).tier] };
  }
  const bounds = BOUNDS[definition.id] ?? { min: 0, max: 1 };
  const span = bounds.max - bounds.min;
  const scaled = span === 0 ? 0 : clamp01((value.value - bounds.min) / span);
  const normalizedScore = definition.direction === "lower_better" ? 1 - scaled : scaled;
  return { normalizedScore, violatesConstraint: false };
};

interface IllustrativeOutcomeSpec {
  readonly unit: string;
  /** siteQuality is the mean of this unit's fixture criterion values, clamped to 0..1. */
  readonly value: (siteQuality: number) => number;
}

/**
 * Arbitrary per-scenario, per-dimension shape — chosen only so the six
 * scenarios visibly differ on the comparison screen, not measured or
 * derived from any method. `null` marks a deliberately not_modelled
 * scenario/dimension pair (restore × local_benefit) so that first-class
 * schema state (mvp.md §8.3) is genuinely exercised by this fixture data,
 * not just theoretically supported.
 */
const ILLUSTRATIVE_SCENARIO_DIMENSION: Record<
  Scenario,
  Partial<Record<OutcomeDimension, IllustrativeOutcomeSpec | null>>
> = {
  status_quo: {
    energy: { unit: "MWh/a", value: () => 0 },
    climate: { unit: "t CO2e/a", value: () => 0 },
    nature_capital: { unit: "index (0-100)", value: (q) => Math.round(30 + 20 * q) },
    soil_water: { unit: "index (0-100)", value: (q) => Math.round(40 + 20 * q) },
    land_use: { unit: "% sealed", value: (q) => Math.round(10 + 5 * q) },
    local_benefit: { unit: "index (0-100)", value: (q) => Math.round(20 + 10 * q) },
  },
  develop_pv: {
    energy: { unit: "MWh/a", value: (q) => Math.round((400 + 800 * q) * 10) / 10 },
    climate: { unit: "t CO2e/a avoided", value: (q) => Math.round(150 + 350 * q) },
    nature_capital: { unit: "index (0-100)", value: (q) => Math.round(15 + 10 * q) },
    soil_water: { unit: "index (0-100)", value: (q) => Math.round(25 + 15 * q) },
    land_use: { unit: "% sealed", value: (q) => Math.round(35 + 15 * q) },
    local_benefit: { unit: "index (0-100)", value: (q) => Math.round(35 + 20 * q) },
  },
  develop_agripv: {
    energy: { unit: "MWh/a", value: (q) => Math.round((250 + 500 * q) * 10) / 10 },
    climate: { unit: "t CO2e/a avoided", value: (q) => Math.round(100 + 250 * q) },
    nature_capital: { unit: "index (0-100)", value: (q) => Math.round(25 + 15 * q) },
    soil_water: { unit: "index (0-100)", value: (q) => Math.round(35 + 15 * q) },
    land_use: { unit: "% sealed", value: (q) => Math.round(15 + 10 * q) },
    local_benefit: { unit: "index (0-100)", value: (q) => Math.round(45 + 20 * q) },
  },
  develop_wind: {
    energy: { unit: "MWh/a", value: (q) => Math.round((900 + 1800 * q) * 10) / 10 },
    climate: { unit: "t CO2e/a avoided", value: (q) => Math.round(400 + 700 * q) },
    nature_capital: { unit: "index (0-100)", value: (q) => Math.round(20 + 15 * q) },
    soil_water: { unit: "index (0-100)", value: (q) => Math.round(45 + 15 * q) },
    land_use: { unit: "% sealed", value: (q) => Math.round(5 + 5 * q) },
    local_benefit: { unit: "index (0-100)", value: (q) => Math.round(30 + 15 * q) },
  },
  preserve: {
    energy: { unit: "MWh/a", value: () => 0 },
    climate: { unit: "t CO2e/a sequestered", value: (q) => Math.round(50 + 100 * q) },
    nature_capital: { unit: "index (0-100)", value: (q) => Math.round(70 + 25 * q) },
    soil_water: { unit: "index (0-100)", value: (q) => Math.round(75 + 20 * q) },
    land_use: { unit: "% sealed", value: () => 0 },
    local_benefit: { unit: "index (0-100)", value: (q) => Math.round(25 + 10 * q) },
  },
  restore: {
    energy: { unit: "MWh/a", value: () => 0 },
    climate: { unit: "t CO2e/a sequestered", value: (q) => Math.round(80 + 150 * q) },
    nature_capital: { unit: "index (0-100)", value: (q) => Math.round(80 + 20 * q) },
    soil_water: { unit: "index (0-100)", value: (q) => Math.round(85 + 15 * q) },
    land_use: { unit: "% sealed", value: () => 0 },
    // Deliberately not_modelled: no defensible fixture-scale method exists
    // for this pair, exercising the not_modelled path for real (U2, mvp.md §8.3).
    local_benefit: null,
  },
};

/**
 * Arbitrary outcome aggregation for `computeOutcomeRow`'s `aggregated`
 * parameter. `values` is the unit's fixture criterion_value rows; their
 * mean (clamped 0..1) is used only as a "site quality" scalar so different
 * units visibly differ — it has no scientific meaning.
 */
export function illustrativeOutcomeAggregate(
  scenario: Scenario,
  dimension: OutcomeDimension,
  values: readonly CriterionValue[],
): AggregatedOutcome | null {
  const spec = ILLUSTRATIVE_SCENARIO_DIMENSION[scenario]?.[dimension];
  if (spec === undefined || spec === null) {
    return null;
  }
  const siteQuality =
    values.length === 0 ? 0.5 : clamp01(values.reduce((sum, v) => sum + clamp01(v.value), 0) / values.length);
  return { value: spec.value(siteQuality), unit: spec.unit, confidence: "low" };
}
