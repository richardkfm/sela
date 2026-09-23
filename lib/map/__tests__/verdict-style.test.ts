// design-language.md §4.3 obligation 1 on the map: colour is never the only
// thing that tells two verdict classes apart.

import assert from "node:assert/strict";
import { test } from "node:test";
import { patternImage } from "../patterns";
import { MAP_VERDICTS, verdictAppearance } from "../verdict-style";
import { TECHNOLOGIES } from "../../scoring/types";

test("suitable and excluded always carry a pattern; the two plain classes differ in lightness", () => {
  for (const tech of TECHNOLOGIES) {
    assert.ok(verdictAppearance("suitable", tech).encoding, `${tech} suitable is patterned`);
    assert.equal(verdictAppearance("excluded", tech).encoding, "hatch-0");
    assert.notEqual(verdictAppearance("unsuitable", tech).color, verdictAppearance("unscored", tech).color);
  }
});

test("no two patterned classes share an encoding within one technology", () => {
  for (const tech of TECHNOLOGIES) {
    const encodings = MAP_VERDICTS.map((v) => verdictAppearance(v, tech).encoding).filter(Boolean);
    assert.equal(new Set(encodings).size, encodings.length, tech);
  }
});

test("technologies keep their design-language hatches on the map", () => {
  assert.equal(verdictAppearance("suitable", "pv").encoding, "hatch-45");
  assert.equal(verdictAppearance("suitable", "agripv").encoding, "crosshatch-45");
  assert.equal(verdictAppearance("suitable", "wind").encoding, "hatch-135");
});

test("pattern tiles actually contain marks — texture that survives greyscale", () => {
  for (const encoding of ["hatch-45", "hatch-135", "crosshatch-45", "hatch-0", "stipple"] as const) {
    const image = patternImage(encoding, "#eda100", "#fbfaf7");
    let marks = 0;
    for (let i = 0; i < image.data.length; i += 4) if (image.data[i] === 0xfb) marks++;
    assert.ok(marks > 0 && marks < 64, `${encoding}: ${marks} of 64 pixels marked`);
  }
});
