// The illustrative scoring now runs on real measurements (ingest/real/). The
// weights stay placeholders, but how a real value is *read* must still be
// right: units, directions, class lookups, and the exclusion line.

import assert from "node:assert/strict";
import { test } from "node:test";
import { CLC_CLASS_NAME_DE, formatClcClass } from "../clc-classes";
import { formatCriterionValue } from "../format-value";
import { illustrativeNormalize } from "../illustrative-weights";
import { LAND_COVER_TIERS, irradiationNationalPositionDe, landCoverTier } from "../pv-rules";
import type { CriterionDefinition, CriterionValue } from "../types";

function definition(overrides: Partial<CriterionDefinition> & { id: string }): CriterionDefinition {
  return {
    sourceId: "test",
    direction: "higher_better",
    weight: 1,
    isHardConstraint: false,
    appliesTo: ["pv", "agripv"],
    methodVersion: "illustrative-real-v1",
    ...overrides,
  };
}

function value(criterionId: string, v: number): CriterionValue {
  return { criterionId, spatialUnitId: "u", value: v, unit: null, confidence: "medium", sourceId: "test", methodVersion: "real-v0" };
}

test("irradiation reads higher-is-better on the national p1–p99 scale (memo Q4b)", () => {
  const d = definition({ id: "pv_irradiation_annual" });
  assert.equal(illustrativeNormalize(value(d.id, 1050.5), d).normalizedScore, 0);
  assert.equal(illustrativeNormalize(value(d.id, 1257.1), d).normalizedScore, 1);
  assert.equal(illustrativeNormalize(value(d.id, 1000), d).normalizedScore, 0, "clamped below p1");
  assert.ok(Math.abs(illustrativeNormalize(value(d.id, 1122.3), d).normalizedScore - (1122.3 - 1050.5) / 206.6) < 1e-9);
});

test("irradiation is placed in the national distribution by quartile", () => {
  assert.equal(irradiationNationalPositionDe(1100.4), "unteres Viertel der Werte in Deutschland");
  assert.equal(irradiationNationalPositionDe(1122.3), "unteres Mittelfeld der Werte in Deutschland");
  assert.equal(irradiationNationalPositionDe(1150), "oberes Mittelfeld der Werte in Deutschland");
  assert.equal(irradiationNationalPositionDe(1250), "oberes Viertel der Werte in Deutschland");
});

test("slope reads lower-is-better, 0° best, 10° and steeper worst", () => {
  const d = definition({ id: "pv_slope", direction: "lower_better" });
  assert.equal(illustrativeNormalize(value(d.id, 0), d).normalizedScore, 1);
  assert.equal(illustrativeNormalize(value(d.id, 10), d).normalizedScore, 0);
  assert.equal(illustrativeNormalize(value(d.id, 25), d).normalizedScore, 0);
});

test("land cover is a category: its tier places the cell, never a score (memo Q3b)", () => {
  const d = definition({ id: "pv_land_cover", direction: "non_monotonic", weight: 0, isCategory: true });
  for (const [code, expected] of [
    [211, "unrestricted"],
    [131, "unrestricted"],
    [231, "restricted"],
    [121, "restricted"],
    [312, "not_considered"],
    [512, "not_considered"],
    [112, "not_considered"],
  ] as const) {
    const n = illustrativeNormalize(value(d.id, code), d);
    assert.equal(n.categoryClass, expected, `class ${code}`);
    assert.equal(n.normalizedScore, 0, "a category contributes nothing to a score");
  }
  assert.equal(illustrativeNormalize(value(d.id, 999), d).categoryClass, "not_considered", "an undocumented class is not placed");
});

test("every documented CLC class has a tier and a written reason, and every tier is documented", () => {
  for (const code of Object.keys(CLC_CLASS_NAME_DE)) {
    const entry = LAND_COVER_TIERS[Number(code)];
    assert.ok(entry, `class ${code} has a tier`);
    assert.ok(entry.reasonDe.length > 3, `class ${code} has a reason`);
  }
  for (const code of Object.keys(LAND_COVER_TIERS)) assert.ok(CLC_CLASS_NAME_DE[Number(code)], `tier for documented class ${code}`);
  assert.equal(landCoverTier(211).tier, "vorgesehen");
  assert.equal(landCoverTier(231).tier, "eingeschraenkt");
  assert.equal(landCoverTier(312).tier, "nicht_vorgesehen");
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
