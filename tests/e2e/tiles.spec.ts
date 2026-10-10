// The unit vector tiles (ADR-0007): the map's only source of units. Checked at
// the HTTP level, against the fixture at null island, so this runs wherever the
// fixture is ingested (CI included).

import { expect, test } from "@playwright/test";

// z12 tile containing (0.005°, 0.005°): x = 2048, y = 2047.
const FIXTURE_TILE = "/api/units/tiles/12/2048/2047?region=fixture-region";

test("a tile over the fixture returns a vector tile with its units", async ({ request }) => {
  const response = await request.get(FIXTURE_TILE);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/vnd.mapbox-vector-tile");
  const body = await response.body();
  expect(body.length).toBeGreaterThan(100);
  // Interactive zoom: unit ids and per-technology verdict keys are in the tile.
  const text = body.toString("latin1");
  for (const key of ["id", "v_pv", "v_agripv", "v_wind"]) expect(text).toContain(key);
});

test("below the interactive zoom a tile carries verdicts but no unit ids", async ({ request }) => {
  const response = await request.get("/api/units/tiles/10/512/511?region=fixture-region");
  expect(response.status()).toBe(200);
  const text = (await response.body()).toString("latin1");
  expect(text).toContain("v_pv");
  expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test("an empty tile is 204 without a body, and a malformed request is refused", async ({ request }) => {
  const empty = await request.get("/api/units/tiles/12/0/0?region=fixture-region");
  expect(empty.status()).toBe(204);
  expect((await empty.body()).length).toBe(0);
  expect((await request.get("/api/units/tiles/3/0/0?region=fixture-region")).status()).toBe(400);
  expect((await request.get("/api/units/tiles/12/2048/2047")).status()).toBe(400);
});

// z8 tile containing the fixture at null island: x = 128, y = 127.
test("below the cell zoom a tile carries the overview pyramid (ADR-0012)", async ({ request }) => {
  const response = await request.get("/api/units/tiles/8/128/127?region=fixture-region");
  expect(response.status()).toBe(200);
  const text = (await response.body()).toString("latin1");
  // Hexagons under the cells' own verdict keys, with their level, cell count and the dominant share.
  for (const key of ["v_pv", "v_agripv", "v_wind", "lvl", "n", "p_pv"]) expect(text).toContain(key);
  expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test("an unknown region has no tiles", async ({ request }) => {
  expect((await request.get("/api/units/tiles/12/2048/2047?region=nowhere-99")).status()).toBe(204);
});
