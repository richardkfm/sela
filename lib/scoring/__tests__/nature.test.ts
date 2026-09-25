import assert from "node:assert/strict";
import { test } from "node:test";

import { methodOutcomeRows, CITED_OUTCOME_METHODS } from "../nature";
import {
  GWP100_CH4,
  GWP100_N2O,
  drainedBalance,
  grasslandBalance,
  peatClimateOutcomes,
  rewettedBalance,
} from "../nature/peat-climate";
import { waterOutcomes } from "../nature/water";
import type { CriterionValue, Scenario } from "../types";

const UNIT = "00000000-0000-0000-0000-000000000001";
let nextId = 1;
function cv(criterionId: string, value: number): CriterionValue {
  return {
    id: nextId++,
    criterionId,
    spatialUnitId: UNIT,
    value,
    unit: null,
    confidence: "medium",
    sourceId: "test",
    methodVersion: "test",
  };
}

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);

test("GWP100 values are the AR5 values the German inventory uses", () => {
  assert.equal(GWP100_CH4, 28);
  assert.equal(GWP100_N2O, 265);
});

test("drained cropland balance adds CO2, DOC, CH4 (Eq. 2.6) and N2O, with bounds added", () => {
  const c = 44 / 12;
  const ch4 = (landEf: number, ditchEf: number) => (0.95 * landEf + 0.05 * ditchEf) * 28 / 1000;
  const n2o = (ef: number) => ef * (44 / 28) * 265 / 1000;
  const b = drainedBalance("cropland");
  close(b.value, 7.9 * c + 0.31 * c + ch4(0, 1165) + n2o(13));
  close(b.low, 6.5 * c + 0.19 * c + ch4(-2.8, 335) + n2o(8.2));
  close(b.high, 9.4 * c + 0.46 * c + ch4(2.8, 1995) + n2o(18));
});

test("grassland spans shallow- to deep-drained central values, midpoint stored", () => {
  const shallow = drainedBalance("grassland_shallow").value;
  const deep = drainedBalance("grassland_deep").value;
  const g = grasslandBalance();
  close(g.low, shallow);
  close(g.high, deep);
  close(g.value, (shallow + deep) / 2);
});

test("rewetted balance: CO2 and DOC as CO2-C, CH4 as CH4-C, no ditch term, no N2O", () => {
  const c = 44 / 12;
  const r = rewettedBalance();
  close(r.value, 0.5 * c + 0.24 * c + 216 * (16 / 12) * 28 / 1000);
  close(r.low, -0.71 * c + 0.14 * c + 0);
  close(r.high, 1.71 * c + 0.36 * c + 856 * (16 / 12) * 28 / 1000);
});

function metric(outcomes: ReturnType<typeof peatClimateOutcomes>, name: string) {
  const found = outcomes.find((o) => o.metric === name);
  assert.ok(found, `metric ${name} missing`);
  return found;
}

test("a cell the peat map checked and found empty is not_applicable, not not_modelled", () => {
  const values = [cv("peat_share", 0), cv("peat_organic_unassessed_share", 0)];
  for (const scenario of ["status_quo", "preserve", "restore"] as Scenario[]) {
    const out = peatClimateOutcomes(scenario, values);
    assert.equal(metric(out, "peat_carbon_stock").result, "not_applicable");
    assert.equal(metric(out, "peat_ghg_balance").result, "not_applicable");
  }
});

test("organic-rich soil the method does not cover is not_modelled, never not_applicable", () => {
  const out = peatClimateOutcomes("status_quo", [cv("peat_share", 0), cv("peat_organic_unassessed_share", 0.4)]);
  assert.equal(metric(out, "peat_ghg_balance").result, null);
  assert.equal(metric(out, "peat_carbon_stock").result, null);
});

test("a missing peat share is not checked: not_modelled", () => {
  const out = peatClimateOutcomes("status_quo", []);
  assert.equal(metric(out, "peat_ghg_balance").result, null);
});

test("half-peat cropland cell: drained balance scaled by share; preserve equals status quo; restore rewetted", () => {
  const values = [cv("peat_share", 0.5), cv("peat_organic_unassessed_share", 0), cv("peat_carbon_stock", 300), cv("pv_land_cover", 211)];
  const sq = metric(peatClimateOutcomes("status_quo", values), "peat_ghg_balance").result;
  const pr = metric(peatClimateOutcomes("preserve", values), "peat_ghg_balance").result;
  const re = metric(peatClimateOutcomes("restore", values), "peat_ghg_balance").result;
  assert.ok(sq && typeof sq === "object" && pr && typeof pr === "object" && re && typeof re === "object");
  close(sq.value, drainedBalance("cropland").value * 0.5);
  assert.deepEqual(pr, sq);
  close(re.value, rewettedBalance().value * 0.5);
  assert.equal(sq.confidence, "low");
  assert.equal(sq.unit, "t CO₂-Äq./ha·a");
});

test("the carbon stock is the same in status quo, preserve and restore, and not modelled under develop", () => {
  const values = [cv("peat_share", 1), cv("peat_organic_unassessed_share", 0), cv("peat_carbon_stock", 420), cv("pv_land_cover", 231)];
  for (const scenario of ["status_quo", "preserve", "restore"] as Scenario[]) {
    assert.deepEqual(metric(peatClimateOutcomes(scenario, values), "peat_carbon_stock").result, {
      value: 420,
      unit: "t C/ha",
      confidence: "medium",
    });
  }
  for (const o of peatClimateOutcomes("develop_pv", values)) assert.equal(o.result, null);
});

test("peat under a land cover without a Tier 1 row here (forest) is not modelled", () => {
  const out = peatClimateOutcomes("status_quo", [cv("peat_share", 1), cv("peat_organic_unassessed_share", 0), cv("pv_land_cover", 311)]);
  assert.equal(metric(out, "peat_ghg_balance").result, null);
});

test("water: preserve keeps today's values; restore mixes the wet reference by peat share", () => {
  const values = [
    cv("water_percolation", 60),
    cv("water_root_zone_moisture", 70),
    cv("peat_share", 0.25),
    cv("pv_land_cover", 231),
    cv("water_wet_ref_percolation", 140),
    cv("water_wet_ref_percolation_p25", 100),
    cv("water_wet_ref_percolation_p75", 170),
    cv("water_wet_ref_moisture", 94),
    cv("water_wet_ref_moisture_p25", 90),
    cv("water_wet_ref_moisture_p75", 95),
  ];
  const sq = waterOutcomes("status_quo", values);
  assert.deepEqual(waterOutcomes("preserve", values), sq);
  const perc = waterOutcomes("restore", values).find((o) => o.metric === "percolation")!.result;
  assert.ok(perc && typeof perc === "object");
  close(perc.value, 0.25 * 140 + 0.75 * 60);
  close(perc.low!, 0.25 * 100 + 0.75 * 60);
  close(perc.high!, 0.25 * 170 + 0.75 * 60);
  assert.equal(perc.confidence, "low");
});

test("water restore without peat is not modelled (other restoration options exist)", () => {
  const out = waterOutcomes("restore", [cv("water_percolation", 60), cv("water_root_zone_moisture", 70), cv("peat_share", 0)]);
  for (const o of out) assert.equal(o.result, null);
});

test("methodOutcomeRows writes every scenario × metric, with inputs for each modelled row", () => {
  const values = [cv("peat_share", 1), cv("peat_organic_unassessed_share", 0), cv("peat_carbon_stock", 400), cv("pv_land_cover", 211)];
  const peat = CITED_OUTCOME_METHODS.find((m) => m.method.methodVersion === "peat-climate-ipcc2013-v1")!;
  const rows = [...methodOutcomeRows(peat, [UNIT], new Map([[UNIT, values]]))];
  assert.equal(rows.length, 6 * 2);
  for (const { row, criterionValueIds } of rows) {
    assert.equal(row.dimension, "climate");
    if (row.status === "modelled") assert.ok(criterionValueIds.length > 0);
  }
  const develop = rows.filter((r) => r.row.scenario.startsWith("develop_"));
  assert.ok(develop.every((r) => r.row.status === "not_modelled"));
});

test("methodOutcomeRows refuses inputs without a database id", () => {
  const values: CriterionValue[] = [{ ...cv("peat_carbon_stock", 1), id: undefined }];
  const peat = CITED_OUTCOME_METHODS[0]!;
  assert.throws(() => [...methodOutcomeRows(peat, [UNIT], new Map([[UNIT, values]]))]);
});
