import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchNames, normaliseName, parseCoordinates } from "../coordinates";

describe("parseCoordinates", () => {
  it("reads decimal degrees in either order, with points or German commas", () => {
    for (const input of ["53.0123, 13.9876", "53.0123 13.9876", "13.9876, 53.0123", "53,0123 13,9876", "53,0123; 13,9876", "53.0123° N 13.9876° E"]) {
      const parsed = parseCoordinates(input);
      assert.equal(parsed?.kind, "wgs84", input);
      if (parsed?.kind !== "wgs84") continue;
      assert.equal(parsed.lat, 53.0123, input);
      assert.equal(parsed.lon, 13.9876, input);
    }
  });

  it("says how it read the numbers", () => {
    const parsed = parseCoordinates("13.9876, 53.0123");
    assert.match(parsed!.readAsDe, /53,01230° N, 13,98760° O/);
  });

  it("reads UTM with an explicit zone, a zone prefix, or zone 33 assumed", () => {
    assert.deepEqual(
      (({ zone, easting, northing, epsg }) => ({ zone, easting, northing, epsg }))(parseCoordinates("33U 412345 5881234") as never),
      { zone: 33, easting: 412345, northing: 5881234, epsg: 25833 },
    );
    const prefixed = parseCoordinates("33412345 5881234");
    assert.equal(prefixed?.kind, "utm");
    assert.equal(prefixed?.kind === "utm" && prefixed.easting, 412345);
    const zone32 = parseCoordinates("32N 812345 5911234");
    assert.equal(zone32?.kind === "utm" && zone32.epsg, 25832);
    const plain = parseCoordinates("412345 5881234");
    assert.equal(plain?.kind === "utm" && plain.zone, 33);
    assert.match(plain!.readAsDe, /Zone 33 angenommen/);
  });

  it("does not guess at text that is not a German coordinate", () => {
    for (const input of ["", "Prenzlau", "53,1,13,9", "0, 0", "48.1 2.3", "12345 67890", "33U 412345"]) {
      assert.equal(parseCoordinates(input), null, input);
    }
  });
});

describe("matchNames", () => {
  const names = [{ name: "Schwedt/Oder" }, { name: "Schönfeld" }, { name: "Gartz (Oder)" }, { name: "Prenzlau" }, { name: "Uckerland" }];

  it("folds case, umlauts and punctuation", () => {
    assert.equal(normaliseName("Schönfeld"), "schoenfeld");
    assert.equal(normaliseName("Gartz (Oder)"), "gartz oder");
    assert.deepEqual(matchNames(names, "schoen").map((n) => n.name), ["Schönfeld"]);
  });

  it("ranks names that start with the text before names that contain it", () => {
    assert.deepEqual(matchNames(names, "oder").map((n) => n.name), ["Gartz (Oder)", "Schwedt/Oder"]);
    assert.deepEqual(matchNames(names, "sch").map((n) => n.name), ["Schönfeld", "Schwedt/Oder"]);
  });

  it("matches nothing for empty input", () => {
    assert.deepEqual(matchNames(names, "  "), []);
  });
});
