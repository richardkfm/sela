import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildComparisonLines,
  comparisonMethodVersions,
  describeOutcomeCell,
  formatOutcomeNumber,
} from "../outcome-display";
import { PEAT_CLIMATE_METHOD, PEAT_CLIMATE_METHOD_VERSION } from "../nature/peat-climate";
import { WATER_METHOD_VERSION } from "../nature/water";
import { OUTCOME_DIMENSIONS, SCENARIOS } from "../types";
import type { OutcomeRow, Scenario } from "../types";

const UNIT = "unit-1";
const BALANCE = "t CO₂-Äq./ha·a";
const balanceInfo = PEAT_CLIMATE_METHOD.metrics.find((m) => m.metric === "peat_ghg_balance");

function row(partial: Partial<OutcomeRow> & Pick<OutcomeRow, "scenario">): OutcomeRow {
  return {
    spatialUnitId: UNIT,
    dimension: "climate",
    metric: "peat_ghg_balance",
    value: null,
    valueLow: null,
    valueHigh: null,
    unit: null,
    confidence: null,
    status: "not_modelled",
    methodVersion: PEAT_CLIMATE_METHOD_VERSION,
    ...partial,
  };
}

function modelled(scenario: Scenario, value: number, range?: [number, number], unit = BALANCE): OutcomeRow {
  return row({
    scenario,
    value,
    valueLow: range?.[0] ?? null,
    valueHigh: range?.[1] ?? null,
    unit,
    confidence: "low",
    status: "modelled",
  });
}

test("numbers: whole units stay whole, the Tier 1 balance gets two significant figures, minus is typographic", () => {
  assert.equal(formatOutcomeNumber(419.6, "t C/ha"), "420");
  assert.equal(formatOutcomeNumber(1234, "mm/a"), "1.234");
  assert.equal(formatOutcomeNumber(37.15, BALANCE), "37");
  assert.equal(formatOutcomeNumber(0.843, BALANCE), "0,84");
  assert.equal(formatOutcomeNumber(-2.09, BALANCE), "−2,1");
  assert.equal(formatOutcomeNumber(-0.2, "mm/a"), "0");
});

test("not_modelled and missing rows read 'noch nicht modelliert'; not_applicable carries the method's reason", () => {
  assert.deepEqual(describeOutcomeCell(undefined, undefined), { kind: "not_modelled" });
  assert.deepEqual(describeOutcomeCell(row({ scenario: "preserve" }), undefined), { kind: "not_modelled" });
  assert.deepEqual(describeOutcomeCell(row({ scenario: "preserve", status: "not_applicable" }), undefined, balanceInfo), {
    kind: "not_applicable",
    reasonDe: "kein Moorboden in dieser Zelle",
  });
});

test("a ranged value shows its range first and its central value second", () => {
  const cell = describeOutcomeCell(modelled("status_quo", 37.15, [28.34, 46.52]), undefined);
  assert.equal(cell.kind, "value");
  if (cell.kind !== "value") return;
  assert.equal(cell.valueText, `28 bis 47 ${BALANCE}`);
  assert.equal(cell.centralText, "Mittel 37");
  assert.equal(cell.deltaText, null);
  assert.equal(cell.confidence, "low");
});

test("a range that rounds to one number is shown as that number", () => {
  const cell = describeOutcomeCell(modelled("status_quo", 12.01, [11.98, 12.04]), undefined);
  assert.ok(cell.kind === "value" && cell.valueText === `12 ${BALANCE}` && cell.centralText === null);
});

test("a delta between ranged values is labelled as the delta of the central values", () => {
  const baseline = modelled("status_quo", 37.15, [28.34, 46.52]);
  const restore = describeOutcomeCell(modelled("restore", 10.78, [-2.09, 39.55]), baseline);
  assert.ok(restore.kind === "value");
  assert.equal(restore.deltaText, "Δ der Mittelwerte −26");
  const preserve = describeOutcomeCell(modelled("preserve", 37.15, [28.34, 46.52]), baseline);
  assert.ok(preserve.kind === "value");
  assert.equal(preserve.deltaText, "Δ der Mittelwerte ±0");
});

test("a delta between plain values is a plain Δ with a sign", () => {
  const baseline = modelled("status_quo", 60, undefined, "mm/a");
  const cell = describeOutcomeCell(modelled("develop_pv", 72.4, undefined, "mm/a"), baseline);
  assert.ok(cell.kind === "value" && cell.deltaText === "Δ +12");
});

test("no delta against a baseline that does not apply", () => {
  const baseline = row({ scenario: "status_quo", status: "not_applicable" });
  const cell = describeOutcomeCell(modelled("restore", 10), baseline);
  assert.ok(cell.kind === "value" && cell.deltaText === null);
});

test("the comparison reads the illustrative version and every cited method", () => {
  assert.deepEqual(comparisonMethodVersions("0.2.1-dev"), ["0.2.1-dev", PEAT_CLIMATE_METHOD_VERSION, WATER_METHOD_VERSION]);
});

test("every dimension appears once even with no rows, every cell not modelled", () => {
  const lines = buildComparisonLines([]);
  assert.deepEqual(lines.map((l) => l.dimension), [...OUTCOME_DIMENSIONS]);
  for (const line of lines) for (const s of SCENARIOS) assert.equal(line.cells[s].kind, "not_modelled");
});

test("cited rows replace the illustrative placeholder of their dimension and appear metric by metric", () => {
  const illustrative = (dimension: OutcomeRow["dimension"]) =>
    row({ scenario: "status_quo", dimension, metric: dimension, methodVersion: "0.2.1-dev", status: "modelled", value: 5, unit: "index (0-100)", confidence: "low" });
  const stock = row({ scenario: "status_quo", metric: "peat_carbon_stock", status: "modelled", value: 420, unit: "t C/ha", confidence: "medium" });
  const balance = modelled("status_quo", 37.15, [28.34, 46.52]);
  const lines = buildComparisonLines([illustrative("climate"), illustrative("energy"), balance, stock]);

  const climate = lines.filter((l) => l.dimension === "climate");
  assert.deepEqual(climate.map((l) => l.metricLabelDe), ["Kohlenstoffvorrat im Moorboden", "Treibhausgasbilanz des Moorbodens"]);
  assert.ok(climate.every((l) => l.methodVersion === PEAT_CLIMATE_METHOD_VERSION));

  const energy = lines.filter((l) => l.dimension === "energy");
  assert.equal(energy.length, 1);
  assert.equal(energy[0]!.metricLabelDe, null);
  assert.equal(energy[0]!.cells.status_quo.kind, "value");
  assert.equal(energy[0]!.cells.preserve.kind, "not_modelled");
});
