import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PV_ANNUAL_YIELD, PV_CAPACITY, PV_YIELD_METHOD, capacityPerHa, pvYieldOutcomes, yieldPerHa } from "../energy/pv-yield";
import { describeOutcomeCell } from "../outcome-display";
import { computeOutcomeRow } from "../outcomes";
import type { CriterionValue } from "../types";

function value(criterionId: string, v: number, id: number): CriterionValue {
  return { id, criterionId, spatialUnitId: "u1", value: v, unit: null, confidence: "medium", sourceId: "s", methodVersion: "real-v0" };
}

const arable = [value("pv_irradiation_annual", 1120, 1), value("pv_land_cover", 211, 2), value("pv_protection_status", 0, 3)];

describe("pv-yield-v1 arithmetic", () => {
  it("computes yield per hectare from irradiation, transposition, PR and density", () => {
    const span = yieldPerHa(1120);
    // 1120 × 1.15 × 0.85 / 0.88
    assert.ok(Math.abs(span.value - 1244.09) < 0.1, String(span.value));
    // 1120 × 1.137 × 0.80 / 1.0 and 1120 × 1.157 × 0.90 / 0.83
    assert.ok(Math.abs(span.low - 1018.75) < 0.1, String(span.low));
    assert.ok(Math.abs(span.high - 1405.10) < 0.1, String(span.high));
    assert.ok(span.low < span.value && span.value < span.high);
  });

  it("derives capacity per hectare as the reciprocal of the area per MW", () => {
    const span = capacityPerHa();
    assert.ok(Math.abs(span.value - 1 / 0.88) < 1e-9);
    assert.equal(span.low, 1);
    assert.ok(Math.abs(span.high - 1 / 0.83) < 1e-9);
  });

  it("scales linearly with irradiation, so the Uckermark's 3 % spread stays far inside the method's range", () => {
    const low = yieldPerHa(1100.5);
    const high = yieldPerHa(1137.0);
    assert.ok(high.value / low.value < 1.04);
    assert.ok(high.value < low.high, "the region's best central value lies inside its worst cell's range");
  });
});

describe("pvYieldOutcomes", () => {
  it("models develop_pv on an unrestricted cell, with every deciding input", () => {
    const [capacity, annual] = pvYieldOutcomes("develop_pv", arable);
    assert.equal(capacity!.metric, PV_CAPACITY);
    assert.equal(annual!.metric, PV_ANNUAL_YIELD);
    assert.ok(annual!.result !== null && annual!.result !== "not_applicable");
    assert.deepEqual(annual!.inputs.map((v) => v.criterionId).sort(), ["pv_irradiation_annual", "pv_land_cover", "pv_protection_status"]);
    const result = annual!.result;
    if (result !== null && typeof result === "object") assert.equal(result.confidence, "low");
  });

  it("models a restricted cell (grassland) too — the class is shown beside it", () => {
    const grassland = [arable[0]!, value("pv_land_cover", 231, 2), arable[2]!];
    const [, annual] = pvYieldOutcomes("develop_pv", grassland);
    assert.ok(annual!.result && annual!.result !== "not_applicable");
  });

  it("finds nothing to measure where PV is excluded or not considered", () => {
    const excluded = [arable[0]!, arable[1]!, value("pv_protection_status", 0.6, 3)];
    const forest = [arable[0]!, value("pv_land_cover", 312, 2), arable[2]!];
    for (const values of [excluded, forest]) {
      for (const outcome of pvYieldOutcomes("develop_pv", values)) {
        assert.equal(outcome.result, "not_applicable");
        assert.ok(outcome.inputs.length > 0, "the class-deciding values are the provenance");
      }
    }
  });

  it("is not applicable in scenarios that build no new plant, and not modelled for agri-PV and wind", () => {
    for (const scenario of ["status_quo", "preserve", "restore"] as const) {
      assert.ok(pvYieldOutcomes(scenario, arable).every((o) => o.result === "not_applicable"), scenario);
    }
    for (const scenario of ["develop_agripv", "develop_wind"] as const) {
      assert.ok(pvYieldOutcomes(scenario, arable).every((o) => o.result === null), scenario);
    }
  });

  it("keeps capacity but does not model yield where irradiation is missing — never zero", () => {
    const [capacity, annual] = pvYieldOutcomes("develop_pv", arable.slice(1));
    assert.ok(capacity!.result && capacity!.result !== "not_applicable");
    assert.equal(annual!.result, null);
  });

  it("gives the scenario's own reason for 'trifft nicht zu'", () => {
    const info = PV_YIELD_METHOD.metrics.find((m) => m.metric === PV_ANNUAL_YIELD);
    const row = (scenario: "preserve" | "develop_pv") =>
      computeOutcomeRow({ spatialUnitId: "u1", scenario, dimension: "energy", metric: PV_ANNUAL_YIELD, aggregated: "not_applicable", methodVersion: "pv-yield-v1" });
    const preserve = describeOutcomeCell(row("preserve"), undefined, info);
    const develop = describeOutcomeCell(row("develop_pv"), undefined, info);
    assert.equal(preserve.kind === "not_applicable" && preserve.reasonDe, "keine neue Anlage in diesem Szenario");
    assert.match(develop.kind === "not_applicable" ? develop.reasonDe ?? "" : "", /ausgeschlossen oder nicht vorgesehen/);
  });

  it("shows a range, never the central value alone", () => {
    const [, annual] = pvYieldOutcomes("develop_pv", arable);
    const row = computeOutcomeRow({
      spatialUnitId: "u1",
      scenario: "develop_pv",
      dimension: "energy",
      metric: PV_ANNUAL_YIELD,
      aggregated: annual!.result,
      methodVersion: "pv-yield-v1",
    });
    const cell = describeOutcomeCell(row, undefined, PV_YIELD_METHOD.metrics[1]);
    assert.equal(cell.kind, "value");
    if (cell.kind === "value") {
      assert.match(cell.valueText, /^1\.?000 bis 1\.?400 MWh\/ha·a$/);
      assert.match(cell.centralText ?? "", /Mittel 1\.?200/);
    }
  });
});
