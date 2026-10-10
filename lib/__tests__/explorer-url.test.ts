import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatView, parseExplorerUrl, parseView, serializeExplorerUrl } from "../explorer-url";

const ID_A = "0f4f9b1e-7e36-4b6e-9b8b-2f1b2a3c4d5e";
const ID_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("explorer URL state", () => {
  it("round-trips technology, view, selection and group", () => {
    const query = serializeExplorerUrl("sachsen-14", {
      technology: "wind",
      view: { zoom: 12.345, lat: 51.0504, lng: 13.7373 },
      selectedId: ID_A,
      group: [ID_A, ID_B],
    });
    assert.ok(query.startsWith("?region=sachsen-14"), "region comes first");
    const parsed = parseExplorerUrl(new URLSearchParams(query));
    assert.equal(parsed.technology, "wind");
    assert.deepEqual(parsed.view, { zoom: 12.35, lat: 51.0504, lng: 13.7373 });
    assert.equal(parsed.selectedId, ID_A);
    assert.deepEqual(parsed.group, [ID_A, ID_B]);
  });

  it("leaves the default technology and empty state out of the link", () => {
    assert.equal(serializeExplorerUrl("uckermark-12073", { technology: "pv", view: null, selectedId: null, group: [] }), "?region=uckermark-12073");
  });

  it("ignores what it cannot trust", () => {
    const parsed = parseExplorerUrl(new URLSearchParams("t=nuclear&v=99/0/0&u=not-a-uuid&g=also-not"));
    assert.equal(parsed.technology, null);
    assert.equal(parsed.view, null);
    assert.equal(parsed.selectedId, null);
    assert.deepEqual(parsed.group, []);
  });

  it("reads and writes a view as z/lat/lng", () => {
    assert.deepEqual(parseView("6/52.5/13.4"), { zoom: 6, lat: 52.5, lng: 13.4 });
    assert.equal(parseView("6/52.5"), null);
    assert.equal(parseView("6/95/13.4"), null);
    assert.equal(formatView({ zoom: 6, lat: 52.5, lng: 13.4 }), "6.00/52.50000/13.40000");
  });
});
