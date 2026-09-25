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

test("computeOutcomeRow: not_applicable carries no value and is distinct from not_modelled (ADR-0008)", () => {
  const row = computeOutcomeRow({
    spatialUnitId: SPATIAL_UNIT,
    scenario: "restore",
    dimension: "climate",
    metric: "peat_ghg_balance",
    aggregated: "not_applicable",
    methodVersion: METHOD_VERSION,
  });
  assert.equal(row.status, "not_applicable");
  assert.equal(row.metric, "peat_ghg_balance");
  assert.equal(row.value, null);
  assert.equal(row.valueLow, null);
});

test("computeOutcomeRow keeps a range around its value and refuses one that does not contain it", () => {
  const base = { spatialUnitId: SPATIAL_UNIT, scenario: "status_quo", dimension: "climate", methodVersion: METHOD_VERSION } as const;
  const row = computeOutcomeRow({ ...base, aggregated: { value: 2, low: 1, high: 3, unit: "t", confidence: "low" } });
  assert.equal(row.valueLow, 1);
  assert.equal(row.valueHigh, 3);
  assert.equal(row.metric, "climate");
  assert.throws(
    () => computeOutcomeRow({ ...base, aggregated: { value: 4, low: 1, high: 3, unit: "t", confidence: "low" } }),
    SelaScoringError,
  );
  assert.throws(
    () => computeOutcomeRow({ ...base, aggregated: { value: 2, low: 1, unit: "t", confidence: "low" } }),
    SelaScoringError,
  );
});

test("computeOutcomeDelta refuses different metrics, gives no delta across units or for not_applicable", () => {
  const make = (scenario: "status_quo" | "restore", metric: string, unit: string, value: number | "not_applicable") =>
    computeOutcomeRow({
      spatialUnitId: SPATIAL_UNIT,
      scenario,
      dimension: "climate",
      metric,
      aggregated: value === "not_applicable" ? value : { value, unit, confidence: "low" },
      methodVersion: METHOD_VERSION,
    });
  const baseline = make("status_quo", "peat_ghg_balance", "t CO₂-Äq./ha·a", 30);
  assert.throws(() => computeOutcomeDelta(make("restore", "peat_carbon_stock", "t C/ha", 400), baseline), SelaScoringError);
  assert.equal(computeOutcomeDelta(make("restore", "peat_ghg_balance", "t C/ha", 10), baseline), null);
  assert.equal(computeOutcomeDelta(make("restore", "peat_ghg_balance", "", "not_applicable"), baseline), null);
  assert.equal(computeOutcomeDelta(make("restore", "peat_ghg_balance", "t CO₂-Äq./ha·a", 10), baseline)?.delta, -20);
});
