import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAENDER, landOf, pilotRegionInfo } from "../pilot-region";

describe("region ids (ADR-0012)", () => {
  it("reads a Land and a Kreis off the id, under their Land's rules", () => {
    const land = pilotRegionInfo("sachsen-14");
    assert.equal(land.kind, "real");
    assert.equal(land.level, "land");
    assert.equal(land.ags, "14");
    assert.deepEqual(land.jurisdictions, ["DE", "DE-SN"]);

    const kreis = pilotRegionInfo("uckermark-12073");
    assert.equal(kreis.level, "kreis");
    assert.equal(kreis.ags, "12073");
    assert.equal(kreis.land, LAENDER["12"]);
    assert.equal(kreis.nameDe, "Uckermark");
    assert.equal(landOf("goerlitz-14626")?.id, "sachsen-14");
  });

  it("treats anything it cannot place as synthetic", () => {
    for (const id of ["fixture-region", "somewhere", "bayern-09", "x-1"]) {
      const info = pilotRegionInfo(id);
      assert.equal(info.kind, "fixture", id);
      assert.equal(info.land, null, id);
    }
    assert.equal(pilotRegionInfo("fixture-region").nameDe, "Beispieldatensatz");
    // The shipped fixture keeps the Uckermark's rings, as if it lay there (ADR-0006).
    assert.deepEqual(pilotRegionInfo("fixture-region").jurisdictions, ["DE", "DE-BB"]);
    assert.deepEqual(pilotRegionInfo("somewhere").jurisdictions, []);
  });

  it("knows which outcome inputs each Land has a source for", () => {
    assert.deepEqual(LAENDER["12"]!.outcomeSources, { peat: true, water: true, habitat: true });
    assert.deepEqual(LAENDER["14"]!.outcomeSources, { peat: false, water: false, habitat: false });
  });
});
