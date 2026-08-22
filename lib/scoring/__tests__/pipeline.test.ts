// Integration test over a small synthetic fixture (roadmap §4.3: "an
// integration test asserting that no outcome row traces to a
// criterion_value without a source"). This fixture is a stand-in for a
// pilot-region cell — it is not, and must never be mistaken for, real
// data. Real ingestion is gated on docs/data/sources.md reaching Confirmed
// per dataset (see docs/architecture/roadmap-to-first-deployment.md §2.2).

import assert from "node:assert/strict";
import { test } from "node:test";

import { computeOutcomeDelta, computeOutcomeRow } from "../outcomes";
import { computeSuitability, type Normalize } from "../suitability";
import type { CriterionDefinition, CriterionValue } from "../types";

const METHOD_VERSION = "test-v0";
const SPATIAL_UNIT = "fixture-cell-1";

const FIXTURE_DEFINITIONS: CriterionDefinition[] = [
  {
    id: "fixture_irradiation",
    sourceId: "fixture-dwd-radiation",
    direction: "higher_better",
    weight: 3,
    isHardConstraint: false,
    appliesTo: ["pv", "agripv"],
    methodVersion: METHOD_VERSION,
  },
  {
    id: "fixture_slope",
    sourceId: "fixture-dem",
    direction: "lower_better",
    weight: 1,
    isHardConstraint: false,
    appliesTo: ["pv", "agripv"],
    methodVersion: METHOD_VERSION,
  },
  {
    id: "fixture_protection_status",
    sourceId: "fixture-bfn-schutzgebiete",
    direction: "non_monotonic",
    weight: 100,
    isHardConstraint: true,
    appliesTo: ["pv", "agripv", "wind"],
    methodVersion: METHOD_VERSION,
  },
];

const FIXTURE_VALUES: CriterionValue[] = [
  {
    criterionId: "fixture_irradiation",
    spatialUnitId: SPATIAL_UNIT,
    value: 0.82,
    unit: "normalized",
    confidence: "medium",
    sourceId: "fixture-dwd-radiation",
    methodVersion: METHOD_VERSION,
  },
  {
    criterionId: "fixture_slope",
    spatialUnitId: SPATIAL_UNIT,
    value: 0.3,
    unit: "normalized",
    confidence: "high",
    sourceId: "fixture-dem",
    methodVersion: METHOD_VERSION,
  },
  {
    criterionId: "fixture_protection_status",
    spatialUnitId: SPATIAL_UNIT,
    value: 0,
    unit: "boolean",
    confidence: "high",
    sourceId: "fixture-bfn-schutzgebiete",
    methodVersion: METHOD_VERSION,
  },
];

const identityNormalize: Normalize = (v) => ({
  normalizedScore: v.value,
  violatesConstraint: v.value === 1,
});

test("every criterion value feeding a verdict carries a non-empty source id", () => {
  for (const value of FIXTURE_VALUES) {
    assert.ok(value.sourceId.length > 0, `criterion_value "${value.criterionId}" has no source_id`);
  }
  for (const definition of FIXTURE_DEFINITIONS) {
    assert.ok(definition.sourceId.length > 0, `criterion_definition "${definition.id}" has no source_id`);
  }
});

test("a full suitability + outcome pass over the fixture cell produces a sourced, unexcluded verdict", () => {
  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: FIXTURE_VALUES,
    definitions: FIXTURE_DEFINITIONS,
    normalize: identityNormalize,
    suitabilityThreshold: 0.6,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(verdict.verdict, "suitable");
  assert.equal(verdict.excludedByCriterionId, null);
  assert.ok(verdict.limitingCriterionId !== null);

  // Every criterion the verdict could point to is traceable to a source.
  const definitionsById = new Map(FIXTURE_DEFINITIONS.map((d) => [d.id, d]));
  const cited = definitionsById.get(verdict.limitingCriterionId!);
  assert.ok(cited, "limiting criterion must resolve to a known criterion_definition");
  assert.ok(cited!.sourceId.length > 0);
});

test("flipping the fixture's protection-status flag excludes the cell instead of lowering its score", () => {
  const excludedValues = FIXTURE_VALUES.map((v) =>
    v.criterionId === "fixture_protection_status" ? { ...v, value: 1 } : v,
  );

  const verdict = computeSuitability({
    spatialUnitId: SPATIAL_UNIT,
    technology: "pv",
    values: excludedValues,
    definitions: FIXTURE_DEFINITIONS,
    normalize: identityNormalize,
    suitabilityThreshold: 0.6,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(verdict.verdict, "excluded");
  assert.equal(verdict.excludedByCriterionId, "fixture_protection_status");
  assert.equal(verdict.score, null);
});

test("an outcome dimension with no fixture aggregation is not_modelled, and its delta is never fabricated", () => {
  const baseline = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "status_quo",
    dimension: "nature_capital",
    aggregated: null, // U2 — no citable indicator in this fixture, same as real state today
    methodVersion: METHOD_VERSION,
  });
  const restore = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "restore",
    dimension: "nature_capital",
    aggregated: null,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(baseline.status, "not_modelled");
  assert.equal(restore.status, "not_modelled");
  assert.equal(computeOutcomeDelta(restore, baseline), null);
});
