import assert from "node:assert/strict";
import { test } from "node:test";

import { computeOutcomeDelta, computeOutcomeRow } from "../outcomes";
import { SelaScoringError } from "../types";

const METHOD_VERSION = "test-v0";
const SPATIAL_UNIT = "unit-1";

test("computeOutcomeRow returns a not_modelled row with no value or confidence when unaggregated", () => {
  const row = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "preserve",
    dimension: "nature_capital",
    aggregated: null,
    methodVersion: METHOD_VERSION,
  });

  assert.equal(row.status, "not_modelled");
  assert.equal(row.value, null);
  assert.equal(row.unit, null);
  assert.equal(row.confidence, null);
});

test("computeOutcomeRow returns a modelled row carrying the aggregated value verbatim", () => {
  const row = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "develop_pv",
    dimension: "energy",
    aggregated: { value: 1.4, unit: "GWh/a", confidence: "medium" },
    methodVersion: METHOD_VERSION,
  });

  assert.equal(row.status, "modelled");
  assert.equal(row.value, 1.4);
  assert.equal(row.unit, "GWh/a");
  assert.equal(row.confidence, "medium");
});

test("computeOutcomeDelta computes scenario minus baseline", () => {
  const baseline = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "status_quo",
    dimension: "energy",
    aggregated: { value: 0, unit: "GWh/a", confidence: "high" },
    methodVersion: METHOD_VERSION,
  });
  const scenario = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "develop_pv",
    dimension: "energy",
    aggregated: { value: 1.4, unit: "GWh/a", confidence: "medium" },
    methodVersion: METHOD_VERSION,
  });

  const delta = computeOutcomeDelta(scenario, baseline);
  assert.ok(delta !== null);
  assert.equal(delta!.delta, 1.4);
  assert.equal(delta!.baselineValue, 0);
  assert.equal(delta!.scenarioValue, 1.4);
  assert.equal(delta!.unit, "GWh/a");
});

test("computeOutcomeDelta returns null rather than a fabricated number when either side is not_modelled", () => {
  const baseline = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "status_quo",
    dimension: "nature_capital",
    aggregated: null,
    methodVersion: METHOD_VERSION,
  });
  const scenario = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "restore",
    dimension: "nature_capital",
    aggregated: { value: 5, unit: "points", confidence: "low" },
    methodVersion: METHOD_VERSION,
  });

  assert.equal(computeOutcomeDelta(scenario, baseline), null);
  assert.equal(computeOutcomeDelta(baseline, baseline), null);
});

test("computeOutcomeDelta rejects a baseline that is not status_quo", () => {
  const notBaseline = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "preserve",
    dimension: "energy",
    aggregated: { value: 0, unit: "GWh/a", confidence: "high" },
    methodVersion: METHOD_VERSION,
  });
  const scenario = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "develop_pv",
    dimension: "energy",
    aggregated: { value: 1.4, unit: "GWh/a", confidence: "medium" },
    methodVersion: METHOD_VERSION,
  });

  assert.throws(() => computeOutcomeDelta(scenario, notBaseline), SelaScoringError);
});

test("computeOutcomeDelta rejects mismatched dimension or spatial unit", () => {
  const baseline = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "status_quo",
    dimension: "energy",
    aggregated: { value: 0, unit: "GWh/a", confidence: "high" },
    methodVersion: METHOD_VERSION,
  });
  const wrongDimension = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "develop_pv",
    dimension: "climate",
    aggregated: { value: 1, unit: "t CO2e/a", confidence: "low" },
    methodVersion: METHOD_VERSION,
  });
  const wrongUnit = computeOutcomeRow({
    spatialUnitId: "unit-2",
    scenario: "develop_pv",
    dimension: "energy",
    aggregated: { value: 1, unit: "GWh/a", confidence: "low" },
    methodVersion: METHOD_VERSION,
  });

  assert.throws(() => computeOutcomeDelta(wrongDimension, baseline), SelaScoringError);
  assert.throws(() => computeOutcomeDelta(wrongUnit, baseline), SelaScoringError);
});
