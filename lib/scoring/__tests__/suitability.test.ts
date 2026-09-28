import assert from "node:assert/strict";
import { test } from "node:test";

import { computeLimitingReference, computeSuitability, type Normalize } from "../suitability";
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

// Category criteria and the Q5 limiting rule (ADR-0009, decision memo Q5).
// A category's raw value 0 means "not considered" in this fixture normaliser.
const categoryNormalize: Normalize = (v, d) =>
  d.isCategory
    ? { normalizedScore: 0, violatesConstraint: false, categoryClass: v.value === 0 ? "not_considered" : v.value === 2 ? "restricted" : "unrestricted" }
    : identityNormalize(v, d);

test("a category criterion can make a unit not_considered, naming it, with no score", () => {
  const definitions = [definition({ id: "land_cover", isCategory: true, weight: 0 }), definition({ id: "irradiation" })];
  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("land_cover", 0), value("irradiation", 0.9)],
    definitions,
    normalize: categoryNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(verdict.verdict, "not_considered");
  assert.equal(verdict.excludedByCriterionId, "land_cover");
  assert.equal(verdict.score, null);
  assert.equal(verdict.limitingCriterionId, null);
});

test("a hard constraint outranks a category: a statute before a classification", () => {
  const definitions = [
    definition({ id: "protection_status", isHardConstraint: true }),
    definition({ id: "land_cover", isCategory: true, weight: 0 }),
    definition({ id: "irradiation" }),
  ];
  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("protection_status", 1), value("land_cover", 0), value("irradiation", 0.9)],
    definitions,
    normalize: categoryNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(verdict.verdict, "excluded");
  assert.equal(verdict.excludedByCriterionId, "protection_status");
});

test("a considered category never moves the score and is never named as limiting", () => {
  const definitions = [definition({ id: "land_cover", isCategory: true, weight: 0 }), definition({ id: "irradiation" })];
  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("land_cover", 1), value("irradiation", 0.4)],
    definitions,
    normalize: categoryNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(verdict.verdict, "unsuitable");
  assert.equal(verdict.score, 0.4);
  assert.equal(verdict.limitingCriterionId, "irradiation");
});

test("Q5: the limiting criterion is measured against the best value in the compared land", () => {
  const definitions = [definition({ id: "irradiation" }), definition({ id: "slope" })];
  // Irradiation is low everywhere (0.30–0.35), slope varies (0.6–1.0).
  const valuesByUnit = new Map([
    ["a", [value("irradiation", 0.35), value("slope", 1.0)]],
    ["b", [value("irradiation", 0.3), value("slope", 0.6)]],
    ["c", [value("irradiation", 0.33), value("slope", 0.95)]],
  ]);
  const best = computeLimitingReference({ technology: "pv", valuesByUnit, definitions, normalize: identityNormalize });
  assert.deepEqual([...best.entries()].sort(), [["irradiation", 0.35], ["slope", 1.0]]);

  const verdictFor = (unit: string) =>
    computeSuitability({
      spatialUnitId: unit,
      technology: "pv",
      values: valuesByUnit.get(unit)!,
      definitions,
      normalize: identityNormalize,
      suitabilityThreshold: 0.5,
      methodVersion: METHOD_VERSION,
      limitingReference: { best, minGap: 0.1 },
    });
  // Against a perfect 1, irradiation would be "limiting" in every unit.
  assert.equal(verdictFor("b").limitingCriterionId, "slope", "slope is 0.4 below the region's best");
  assert.equal(verdictFor("c").limitingCriterionId, null, "nothing is ≥ 0.1 below the region's best");
  assert.equal(verdictFor("a").limitingCriterionId, null);
});

test("without a reference, the gap is measured against 1 and one criterion is always named", () => {
  const definitions = [definition({ id: "irradiation" }), definition({ id: "slope" })];
  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("irradiation", 0.35), value("slope", 1.0)],
    definitions,
    normalize: identityNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(verdict.limitingCriterionId, "irradiation");
});

test("the limiting reference ignores excluded and not-considered units", () => {
  const definitions = [
    definition({ id: "protection_status", isHardConstraint: true }),
    definition({ id: "land_cover", isCategory: true, weight: 0 }),
    definition({ id: "irradiation" }),
  ];
  const valuesByUnit = new Map([
    ["excluded", [value("protection_status", 1), value("land_cover", 1), value("irradiation", 0.99)]],
    ["forest", [value("protection_status", 0), value("land_cover", 0), value("irradiation", 0.9)]],
    ["scored", [value("protection_status", 0), value("land_cover", 1), value("irradiation", 0.4)]],
  ]);
  const best = computeLimitingReference({ technology: "pv", valuesByUnit, definitions, normalize: categoryNormalize });
  assert.equal(best.get("irradiation"), 0.4);
});

// real-pv-v1 (ADR-0009, amendment 1): measured criteria carry weight 0, so a
// unit is classified by its category and never scored.
test("with no weighted criterion, a unit is classified by its category, with no score", () => {
  const definitions = [
    definition({ id: "protection_status", isHardConstraint: true }),
    definition({ id: "land_cover", isCategory: true, weight: 0 }),
    definition({ id: "irradiation", weight: 0 }),
  ];
  const verdictFor = (landCover: number, protection = 0) =>
    computeSuitability({
      spatialUnitId: SPATIAL_UNIT,
      technology: "pv",
      values: [value("protection_status", protection), value("land_cover", landCover), value("irradiation", 0.4)],
      definitions,
      normalize: categoryNormalize,
      suitabilityThreshold: 0.5,
      methodVersion: METHOD_VERSION,
    });
  for (const [landCover, expected] of [[1, "unrestricted"], [2, "restricted"], [0, "not_considered"]] as const) {
    const v = verdictFor(landCover);
    assert.equal(v.verdict, expected);
    assert.equal(v.score, null);
    assert.equal(v.limitingCriterionId, null);
    assert.equal(v.excludedByCriterionId, "land_cover");
  }
  assert.equal(verdictFor(1, 1).verdict, "excluded", "a statute still comes first");
});

test("the most restrictive of several categories decides", () => {
  const definitions = [
    definition({ id: "a_category", isCategory: true, weight: 0 }),
    definition({ id: "b_category", isCategory: true, weight: 0 }),
  ];
  const v = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("a_category", 1), value("b_category", 2)],
    definitions,
    normalize: categoryNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(v.verdict, "restricted");
  assert.equal(v.excludedByCriterionId, "b_category");
});

test("with neither a weighted criterion nor a category value, there is nothing to classify", () => {
  assert.throws(
    () =>
      computeSuitability({
        spatialUnitId: SPATIAL_UNIT,
        technology: "pv",
        values: [value("irradiation", 0.4)],
        definitions: [definition({ id: "irradiation", weight: 0 }), definition({ id: "land_cover", isCategory: true, weight: 0 })],
        normalize: categoryNormalize,
        suitabilityThreshold: 0.5,
        methodVersion: METHOD_VERSION,
      }),
    SelaScoringError,
  );
});

test("a weighted definition without a value for this unit does not stop classification", () => {
  // The fixture's weighted criteria apply to PV too; a real unit has no values for them.
  const v = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: [value("land_cover", 1), value("irradiation", 0.4)],
    definitions: [
      definition({ id: "fixture_weighted", weight: 1 }),
      definition({ id: "land_cover", isCategory: true, weight: 0 }),
      definition({ id: "irradiation", weight: 0 }),
    ],
    normalize: categoryNormalize,
    suitabilityThreshold: 0.5,
    methodVersion: METHOD_VERSION,
  });
  assert.equal(v.verdict, "unrestricted");
});
