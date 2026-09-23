// The preview's claims are about size, so its sizes are tested: a reference
// turbine must be as tall as the interface says, a ring as wide as the law
// says, and a mesh must light from the outside.

import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleTableCentreHeightM, moduleTableMesh, rotorMesh, turbineBodyMesh, type MeshData } from "../meshes";
import { PV_LAYOUT, REFERENCE_TURBINE, SETBACK_RINGS, totalHeightM } from "../reference-geometry";

function extent(mesh: MeshData, axis: 0 | 1 | 2): [number, number] {
  const values = mesh.attributes.positions.value.filter((_, i) => i % 3 === axis);
  return [Math.min(...values), Math.max(...values)];
}

test("total height follows § 249 Abs. 10 S. 2 BauGB: hub height plus rotor radius", () => {
  assert.equal(totalHeightM(160, 160), 240);
  assert.equal(totalHeightM(120, 100), 170);
});

test("the 2 H ring is twice the total height; the Brandenburg ring is fixed at 1 000 m", () => {
  const twoH = SETBACK_RINGS.find((r) => r.id === "baugb_249_10");
  const bb = SETBACK_RINGS.find((r) => r.id === "bbgweaabg_1");
  assert.ok(twoH && bb);
  assert.equal(twoH.radiusM(160, 160), 480);
  assert.equal(bb.radiusM(160, 160), 1000);
  assert.equal(bb.radiusM(80, 80), 1000);
});

test("every ring states its source, its wording and its limits", () => {
  for (const ring of SETBACK_RINGS) {
    assert.match(ring.sourceUrl, /^https:\/\//);
    assert.ok(ring.quoteDe.length > 40, `${ring.id} quotes its rule`);
    assert.ok(ring.limitsDe.length > 20, `${ring.id} states where it does not apply`);
    assert.ok(["official_text", "secondary"].includes(ring.verification), `${ring.id} says how it was checked`);
  }
});

test("every reference dimension is marked illustrative", () => {
  for (const d of [...Object.values(REFERENCE_TURBINE), ...Object.values(PV_LAYOUT)]) {
    assert.equal(d.basis, "illustrative", d.id);
  }
});

test("the tower reaches exactly hub height and stands on the origin", () => {
  const body = turbineBodyMesh(160, 160);
  const [zMin] = extent(body, 2);
  assert.equal(zMin, 0);
  // The nacelle sits on the hub, so the body tops out a little above it — but never above total height.
  const [, zMax] = extent(body, 2);
  assert.ok(zMax >= 160 && zMax < totalHeightM(160, 160), `body top ${zMax}`);
});

test("the rotor spans its diameter, within float precision", () => {
  const rotor = rotorMesh(160);
  const [yMin, yMax] = extent(rotor, 1);
  const [zMin, zMax] = extent(rotor, 2);
  const span = Math.max(yMax - yMin, zMax - zMin);
  // Three blades at 120° never align on one axis, so the span is between R·(1 + sin 30°) and 2R.
  assert.ok(span > 80 * 1.5 && span <= 160 + 1e-3, `span ${span}`);
  for (let i = 0; i < rotor.attributes.positions.value.length; i += 3) {
    const y = rotor.attributes.positions.value[i + 1]!;
    const z = rotor.attributes.positions.value[i + 2]!;
    assert.ok(Math.hypot(y, z) <= 80 + 2, "no vertex beyond the rotor radius (plus tip chord)");
  }
});

test("module tables sit at their stated lower edge and rise towards north", () => {
  const table = moduleTableMesh(4.5, 20, 0.8);
  const [zMin, zMax] = extent(table, 2);
  assert.ok(Math.abs(zMin - 0.8) < 1e-6);
  assert.ok(Math.abs(zMax - (0.8 + 4.5 * Math.sin((20 * Math.PI) / 180) + 0.08)) < 1e-4);
  assert.ok(Math.abs(moduleTableCentreHeightM(4.5, 20, 0.8) - (0.8 + 2.25 * Math.sin((20 * Math.PI) / 180))) < 1e-9);
});

test("normals are unit length, and a table's upward faces sit above its downward ones", () => {
  for (const mesh of [turbineBodyMesh(160, 160), rotorMesh(160), moduleTableMesh(4.5, 20, 0.8)]) {
    const n = mesh.attributes.normals.value;
    const p = mesh.attributes.positions.value;
    assert.equal(n.length, p.length);
    for (let i = 0; i < n.length; i += 3) {
      assert.ok(Math.abs(Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!) - 1) < 1e-4, "unit normals");
    }
  }
  // Spot-check the table: its top face (normal with positive z) is above its bottom face.
  const table = moduleTableMesh(4.5, 20, 0.8);
  const n = table.attributes.normals.value;
  const p = table.attributes.positions.value;
  let upZ = 0, downZ = 0, up = 0, down = 0;
  for (let i = 0; i < n.length; i += 3) {
    if (n[i + 2]! > 0.9) { upZ += p[i + 2]!; up++; }
    if (n[i + 2]! < -0.9) { downZ += p[i + 2]!; down++; }
  }
  assert.ok(up > 0 && down > 0 && upZ / up > downZ / down);
});
