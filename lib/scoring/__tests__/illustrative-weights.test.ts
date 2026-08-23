import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ILLUSTRATIVE_MARKER,
  illustrativeNormalize,
  illustrativeOutcomeAggregate,
} from "../illustrative-weights";
import type { CriterionDefinition, CriterionValue } from "../types";

const METHOD_VERSION = "test-v0";
const SPATIAL_UNIT = "unit-1";

function value(criterionId: string, raw: number): CriterionValue {
  return {
    criterionId,
    spatialUnitId: SPATIAL_UNIT,
    value: raw,
    unit: null,
    confidence: "medium",
    sourceId: "fixture-land-cover",
    methodVersion: METHOD_VERSION,
  };
}

function definition(overrides: Partial<CriterionDefinition> & { id: string }): CriterionDefinition {
  return {
    sourceId: "fixture-land-cover",
    direction: "higher_better",
    weight: 1,
    isHardConstraint: false,
    appliesTo: ["pv"],
    methodVersion: METHOD_VERSION,
    ...overrides,
  };
}

test("ILLUSTRATIVE_MARKER is present in both interface languages and never empty", () => {
  assert.ok(ILLUSTRATIVE_MARKER.en.length > 0);
  assert.ok(ILLUSTRATIVE_MARKER.de.length > 0);
});

test("illustrativeNormalize clamps and orients a known fixture criterion", () => {
  const higherBetter = definition({ id: "fixture_land_cover_coverage", direction: "higher_better" });
  assert.equal(illustrativeNormalize(value("fixture_land_cover_coverage", 0.75), higherBetter).normalizedScore, 0.75);
  assert.equal(illustrativeNormalize(value("fixture_land_cover_coverage", 1.5), higherBetter).normalizedScore, 1);
  assert.equal(illustrativeNormalize(value("fixture_land_cover_coverage", -1), higherBetter).normalizedScore, 0);

  const lowerBetter = definition({ id: "fixture_land_cover_coverage", direction: "lower_better" });
  assert.equal(illustrativeNormalize(value("fixture_land_cover_coverage", 0.2), lowerBetter).normalizedScore, 0.8);
});

test("illustrativeNormalize treats an unmapped criterion id as already 0..1", () => {
  const def = definition({ id: "not_in_bounds_table" });
  assert.equal(illustrativeNormalize(value("not_in_bounds_table", 0.3), def).normalizedScore, 0.3);
});

test("illustrativeNormalize marks a hard constraint violated at raw value >= 1, never for a score-only criterion", () => {
  const constraint = definition({ id: "fixture_protection_status", isHardConstraint: true });
  assert.equal(illustrativeNormalize(value("fixture_protection_status", 1), constraint).violatesConstraint, true);
  assert.equal(illustrativeNormalize(value("fixture_protection_status", 0), constraint).violatesConstraint, false);
});

test("illustrativeOutcomeAggregate returns null for the deliberately not_modelled pair (restore x local_benefit)", () => {
  assert.equal(illustrativeOutcomeAggregate("restore", "local_benefit", [value("fixture_land_cover_coverage", 0.5)]), null);
});

test("illustrativeOutcomeAggregate is deterministic for the same inputs", () => {
  const values = [value("fixture_land_cover_coverage", 0.6)];
  const a = illustrativeOutcomeAggregate("develop_pv", "energy", values);
  const b = illustrativeOutcomeAggregate("develop_pv", "energy", values);
  assert.deepEqual(a, b);
  assert.ok(a !== null && a.value > 0);
});

test("illustrativeOutcomeAggregate reports a literal zero (not not_modelled) where the scenario has none, e.g. preserve energy", () => {
  const result = illustrativeOutcomeAggregate("preserve", "energy", [value("fixture_land_cover_coverage", 0.9)]);
  assert.ok(result !== null);
  assert.equal(result!.value, 0);
});

test("illustrativeOutcomeAggregate falls back to a mid site-quality scalar with no criterion values, rather than throwing", () => {
  const result = illustrativeOutcomeAggregate("develop_wind", "energy", []);
  assert.ok(result !== null);
  assert.ok(result!.value > 0);
});
