import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CELL_MIN_ZOOM,
  INTERACTIVE_MIN_ZOOM,
  MIN_UNIT_TILE_ZOOM,
  OVERVIEW_LEVELS,
  overviewLevelFor,
  zoomTargetAfterClick,
} from "../tiles";

describe("tile zoom bands (ADR-0012)", () => {
  it("serves the coarse overview at the lowest zooms, the fine one below the cells", () => {
    assert.equal(overviewLevelFor(MIN_UNIT_TILE_ZOOM), 5000);
    assert.equal(overviewLevelFor(7), 5000);
    assert.equal(overviewLevelFor(8), 1000);
    assert.equal(overviewLevelFor(10), 1000);
    assert.equal(overviewLevelFor(CELL_MIN_ZOOM), null);
    assert.equal(overviewLevelFor(16), null);
  });

  it("keeps the bands contiguous and ordered", () => {
    let previous = MIN_UNIT_TILE_ZOOM - 1;
    for (const level of OVERVIEW_LEVELS) {
      assert.ok(level.maxZoom > previous);
      previous = level.maxZoom;
    }
    assert.equal(previous + 1, CELL_MIN_ZOOM, "the last overview band ends right below the cells");
    assert.ok(INTERACTIVE_MIN_ZOOM >= CELL_MIN_ZOOM);
  });

  it("takes a click one band closer, never straight from a Land to a cell", () => {
    assert.equal(zoomTargetAfterClick(6), 9);
    assert.equal(zoomTargetAfterClick(9), INTERACTIVE_MIN_ZOOM + 0.5);
    assert.equal(zoomTargetAfterClick(11), INTERACTIVE_MIN_ZOOM + 0.5);
  });
});
