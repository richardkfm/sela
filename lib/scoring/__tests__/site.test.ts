import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeOutcomeRow } from "../outcomes";
import { aggregateSiteMetric, countClasses, describeSiteTotal, siteTotalUnit } from "../site";
import type { OutcomeResult } from "../outcomes";
import type { OutcomeRow, Scenario } from "../types";

function row(id: string, result: OutcomeResult, scenario: Scenario = "develop_pv"): OutcomeRow {
  return computeOutcomeRow({ spatialUnitId: id, scenario, dimension: "energy", metric: "m", aggregated: result, methodVersion: "v" });
}

const areas = new Map([
  ["a", 2],
  ["b", 3],
  ["c", 1],
]);

describe("aggregateSiteMetric", () => {
  it("sums a per-hectare quantity over the modelled cells' areas, bound by bound", () => {
    const total = aggregateSiteMetric(
      [
        row("a", { value: 10, low: 8, high: 12, unit: "MWh/ha·a", confidence: "low" }),
        row("b", { value: 20, low: 15, high: 25, unit: "MWh/ha·a", confidence: "medium" }),
        row("c", "not_applicable"),
      ],
      areas,
      "sum_per_ha",
    );
    assert.equal(total.kind, "value");
    assert.equal(total.value, 80);
    assert.equal(total.low, 61);
    assert.equal(total.high, 99);
    assert.equal(total.unit, "MWh/a");
    assert.equal(total.confidence, "low");
    assert.equal(total.modelledCells, 2);
    assert.equal(total.notApplicableCells, 1);
    assert.equal(total.notModelledCells, 0);
    assert.equal(total.modelledAreaHa, 5);
  });

  it("averages a state of the land over the modelled cells' areas", () => {
    const total = aggregateSiteMetric(
      [row("a", { value: 100, unit: "mm/a", confidence: "medium" }), row("b", { value: 50, unit: "mm/a", confidence: "medium" })],
      areas,
      "area_mean",
    );
    assert.equal(total.value, 70);
    assert.equal(total.unit, "mm/a");
    assert.equal(total.low, null);
    assert.equal(total.notModelledCells, 1, "a cell without a row is not modelled, never zero");
  });

  it("is not applicable only when every cell is, otherwise not modelled", () => {
    const all = aggregateSiteMetric([row("a", "not_applicable"), row("b", "not_applicable"), row("c", "not_applicable")], areas, "sum_per_ha");
    assert.equal(all.kind, "not_applicable");
    const some = aggregateSiteMetric([row("a", "not_applicable"), row("b", null)], areas, "sum_per_ha");
    assert.equal(some.kind, "not_modelled");
  });

  it("refuses units it cannot turn into a total", () => {
    assert.throws(() => siteTotalUnit("mm/a"));
    assert.equal(siteTotalUnit("t C/ha"), "t C");
  });
});

describe("describeSiteTotal", () => {
  const develop = aggregateSiteMetric(
    [row("a", { value: 10, low: 8, high: 12, unit: "t C/ha", confidence: "medium" }), row("b", { value: 10, low: 8, high: 12, unit: "t C/ha", confidence: "medium" })],
    areas,
    "sum_per_ha",
  );

  it("says over how many cells the total was formed", () => {
    const cell = describeSiteTotal(develop, null, null);
    assert.equal(cell.valueText, "40 bis 60 t C");
    assert.equal(cell.coverageDe, "2 von 3 Zellen · 1 nicht modelliert");
  });

  it("gives a delta only over the same cells", () => {
    const sameCells = aggregateSiteMetric(
      [row("a", { value: 5, unit: "t C/ha", confidence: "medium" }, "status_quo"), row("b", { value: 5, unit: "t C/ha", confidence: "medium" }, "status_quo")],
      areas,
      "sum_per_ha",
    );
    assert.equal(describeSiteTotal(develop, sameCells, null).deltaText, "Δ der Mittelwerte +25");
    const otherCells = aggregateSiteMetric([row("a", { value: 5, unit: "t C/ha", confidence: "medium" }, "status_quo")], areas, "sum_per_ha");
    assert.equal(describeSiteTotal(develop, otherCells, null).deltaText, null);
  });
});

describe("countClasses", () => {
  it("counts a cell without a verdict as unscored", () => {
    const counts = countClasses(
      [
        { spatialUnitId: "a", technology: "pv", verdict: "unrestricted" },
        { spatialUnitId: "b", technology: "pv", verdict: "unrestricted" },
        { spatialUnitId: "a", technology: "wind", verdict: "excluded" },
      ],
      "pv",
      ["a", "b", "c"],
    );
    assert.equal(counts.get("unrestricted"), 2);
    assert.equal(counts.get("unscored"), 1);
  });
});
