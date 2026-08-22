import assert from "node:assert/strict";
import { test } from "node:test";

import { computeSuitability, type Normalize } from "../suitability";
import { SelaScoringError, type CriterionDefinition, type CriterionValue } from "../types";

const METHOD_VERSION = "test-v0";
const SPATIAL_UNIT = "unit-1";

function value(criterionId: string, raw: number, sourceId = "test-source"): CriterionValue {
  return {
    criterionId,
    spatialUnitId: SPATIAL_UNIT,
    value: raw,
    unit: null,
    confidence: "high",
    sourceId,
    methodVersion: METHOD_VERSION,
  };
}

function definition(overrides: Partial<CriterionDefinition> & { id: string }): CriterionDefinition {
  return {
    sourceId: "test-source",
    direction: "higher_better",
    weight: 1,
    isHardConstraint: false,
    appliesTo: ["pv"],
    methodVersion: METHOD_VERSION,
    ...overrides,
  };
}

// Test fixture normalization: raw values are already on a 0..1 scale, and a
// hard-constraint criterion violates when its raw value is 1.
const identityNormalize: Normalize = (v) => ({
  normalizedScore: v.value,
  violatesConstraint: v.value === 1,
});

test("excludes when a hard constraint is violated, naming the constraint, no score", () => {
  const definitions = [
    definition({ id: "protection_status", isHardConstraint: true, weight: 10 }),
    definition({ id: "irradiation", weight: 1 }),
  ];
  const values = [value("protection_status", 1), value("irradiation", 0.9)];

  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values,
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(verdict.verdict, "excluded");
  assert.equal(verdict.excludedByCriterionId, "protection_status");
  assert.equal(verdict.limitingCriterionId, null);
  assert.equal(verdict.score, null);
});

test("when several hard constraints are violated, the highest-weight one is named", () => {
  const definitions = [
    definition({ id: "constraint_low", isHardConstraint: true, weight: 1 }),
    definition({ id: "constraint_high", isHardConstraint: true, weight: 5 }),
  ];
  const values = [value("constraint_low", 1), value("constraint_high", 1)];

  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values,
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(verdict.excludedByCriterionId, "constraint_high");
});

test("computes a weighted score and names the criterion limiting it most (flow F2)", () => {
  const definitions = [
    definition({ id: "irradiation", weight: 3 }),
    definition({ id: "slope", weight: 1 }),
  ];
  // irradiation is nearly perfect; slope drags the score down and, weighted
  // by its own weight, is not the largest shortfall — check the arithmetic
  // rather than assume it.
  const values = [value("irradiation", 0.95), value("slope", 0.2)];

  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values,
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });

  const expectedScore = (3 * 0.95 + 1 * 0.2) / 4;
  assert.ok(verdict.score !== null);
  assert.ok(Math.abs(verdict.score! - expectedScore) < 1e-9);
  // shortfall: irradiation = 3*(1-0.95)=0.15, slope = 1*(1-0.2)=0.8 -> slope limits
  assert.equal(verdict.limitingCriterionId, "slope");
  assert.equal(verdict.excludedByCriterionId, null);
});

test("verdict is suitable at or above the threshold, unsuitable below it", () => {
  const definitions = [definition({ id: "irradiation", weight: 1 })];

  const above = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("irradiation", 0.6)],
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.6,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(above.verdict, "suitable");

  const below = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("irradiation", 0.59)],
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.6,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(below.verdict, "unsuitable");
});

test("a criterion with no value present is skipped, not treated as violating or perfect", () => {
  const definitions = [
    definition({ id: "protection_status", isHardConstraint: true, weight: 10 }),
    definition({ id: "irradiation", weight: 1 }),
  ];
  // No value at all for protection_status — must not be treated as excluded.
  const values = [value("irradiation", 0.8)];

  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values,
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(verdict.verdict, "suitable");
  assert.equal(verdict.score, 0.8);
});

test("a criterion that does not apply to the technology is ignored entirely", () => {
  const definitions = [
    definition({ id: "irradiation", weight: 1, appliesTo: ["pv"] }),
    definition({ id: "wind_resource", weight: 1000, appliesTo: ["wind"] }),
  ];
  const values = [value("irradiation", 0.5), value("wind_resource", 0)];

  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values,
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.4,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(verdict.score, 0.5);
  assert.equal(verdict.limitingCriterionId, "irradiation");
});

test("throws when no scoreable criterion values are available", () => {
  const definitions = [definition({ id: "irradiation", weight: 1 })];

  assert.throws(
    () =>
      computeSuitability({
        spatialUnitId: SPATIAL_UNIT,
        technology: "pv",
        values: [],
        definitions,
        normalize: identityNormalize,
        suitabilityThreshold: 0.5,
        methodVersion: METHOD_VERSION,
      }),
    SelaScoringError,
  );
});

test("throws when normalize() returns a score outside [0, 1]", () => {
  const definitions = [definition({ id: "irradiation", weight: 1 })];
  const badNormalize: Normalize = () => ({ normalizedScore: 1.5, violatesConstraint: false });

  assert.throws(
    () =>
      computeSuitability({
        spatialUnitId: SPATIAL_UNIT,
        technology: "pv",
        values: [value("irradiation", 999)],
        definitions,
        normalize: badNormalize,
        suitabilityThreshold: 0.5,
        methodVersion: METHOD_VERSION,
      }),
    SelaScoringError,
  );
});

test("verdict never carries both a score and an exclusion reason", () => {
  const excluded = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("protection_status", 1)],
    definitions: [definition({ id: "protection_status", isHardConstraint: true, weight: 1 })],
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(excluded.score, null);
  assert.equal(excluded.limitingCriterionId, null);

  const scored = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("irradiation", 0.9)],
    definitions: [definition({ id: "irradiation", weight: 1 })],
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(scored.excludedByCriterionId, null);
  assert.ok(scored.limitingCriterionId !== null);
});
