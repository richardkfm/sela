// The illustrative scoring now runs on real measurements (ingest/real/). The
// weights stay placeholders, but how a real value is *read* must still be
// right: units, directions, class lookups, and the exclusion line.

import assert from "node:assert/strict";
import { test } from "node:test";
import { CLC_CLASS_NAME_DE, formatClcClass } from "../clc-classes";
import { formatCriterionValue } from "../format-value";
import { ILLUSTRATIVE_LAND_COVER_SCORE, illustrativeNormalize } from "../illustrative-weights";
import type { CriterionDefinition, CriterionValue } from "../types";

function definition(overrides: Partial<CriterionDefinition> & { id: string }): CriterionDefinition {
  return {
    sourceId: "test",
    direction: "higher_better",
    weight: 1,
    isHardConstraint: false,
    appliesTo: ["pv", "agripv"],
    methodVersion: "illustrative-real-v0",
    ...overrides,
  };
}

function value(criterionId: string, v: number): CriterionValue {
  return { criterionId, spatialUnitId: "u", value: v, unit: null, confidence: "medium", sourceId: "test", methodVersion: "real-v0" };
}

test("irradiation reads higher-is-better on its stated 1000–1300 kWh/m² scale", () => {
  const d = definition({ id: "pv_irradiation_annual" });
  assert.equal(illustrativeNormalize(value(d.id, 1000), d).normalizedScore, 0);
  assert.equal(illustrativeNormalize(value(d.id, 1300), d).normalizedScore, 1);
  assert.ok(Math.abs(illustrativeNormalize(value(d.id, 1120), d).normalizedScore - 0.4) < 1e-9);
});

test("slope reads lower-is-better, 0° best, 10° and steeper worst", () => {
  const d = definition({ id: "pv_slope", direction: "lower_better" });
  assert.equal(illustrativeNormalize(value(d.id, 0), d).normalizedScore, 1);
  assert.equal(illustrativeNormalize(value(d.id, 10), d).normalizedScore, 0);
  assert.equal(illustrativeNormalize(value(d.id, 25), d).normalizedScore, 0);
});

test("land cover is looked up by class, never scaled as a number", () => {
  const d = definition({ id: "pv_land_cover", direction: "non_monotonic" });
  assert.equal(illustrativeNormalize(value(d.id, 211), d).normalizedScore, 1);
  assert.equal(illustrativeNormalize(value(d.id, 312), d).normalizedScore, 0);
  assert.equal(illustrativeNormalize(value(d.id, 999), d).normalizedScore, 0, "an undocumented class scores 0");
  for (const code of Object.keys(ILLUSTRATIVE_LAND_COVER_SCORE)) {
    assert.ok(CLC_CLASS_NAME_DE[Number(code)], `class ${code} has a documented name`);
  }
});

test("a protection share excludes at half the cell, not before", () => {
  const d = definition({ id: "pv_protection_status", direction: "lower_better", isHardConstraint: true });
  assert.equal(illustrativeNormalize(value(d.id, 0.49), d).violatesConstraint, false);
  assert.equal(illustrativeNormalize(value(d.id, 0.5), d).violatesConstraint, true);
  const fixture = definition({ id: "fixture_protection_status", isHardConstraint: true });
  assert.equal(illustrativeNormalize(value(fixture.id, 0.5), fixture).violatesConstraint, false, "the fixture flag still needs 1");
});

test("values are written with their unit and no more precision than their source", () => {
  assert.equal(formatCriterionValue("pv_irradiation_annual", 1126.7, "kWh/m²·a"), "1.127 kWh/m²·a");
  assert.equal(formatCriterionValue("pv_slope", 0.8747, "°"), "0,9°");
  assert.equal(formatCriterionValue("pv_protection_status", 0.254, "Flächenanteil"), "25 % der Fläche");
  assert.equal(formatCriterionValue("pv_land_cover", 211, "CLC-Klasse"), "211 · Nicht bewässertes Ackerland");
  assert.equal(formatClcClass(999), "999");
});
