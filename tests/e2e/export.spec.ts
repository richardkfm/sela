// A site as a file (roadmap-planning-tool.md Phase 3): GeoJSON and CSV that
// cite their sources. Checked at the HTTP level against the fixture.

import { expect, test } from "@playwright/test";
import { getSampleUnitId } from "./helpers";

test("a site exports as GeoJSON with its sources at the collection level", async ({ request, baseURL }) => {
  const id = await getSampleUnitId(request, baseURL!);
  const response = await request.get(`/api/site/export?ids=${id}&format=geojson`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("geo+json");
  const collection = await response.json();
  expect(collection.type).toBe("FeatureCollection");
  expect(collection.features).toHaveLength(1);
  expect(collection.features[0].geometry.type).toBe("Polygon");
  expect(collection.features[0].properties.einordnung_pv).toBeTruthy();
  expect(collection.sela.sources.length).toBeGreaterThan(0);
  for (const source of collection.sela.sources) expect(source.notice.length).toBeGreaterThan(0);
});

test("a site exports as CSV, every row citing its sources", async ({ request, baseURL }) => {
  const id = await getSampleUnitId(request, baseURL!);
  const response = await request.get(`/api/site/export?ids=${id}&format=csv`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  const lines = (await response.text()).replace(/^﻿/, "").trim().split(/\r?\n/);
  expect(lines).toHaveLength(2);
  const header = lines[0]!.split(";");
  for (const column of ["id", "flaeche_ha", "einordnung_pv", "quellen", "hinweis"]) expect(header).toContain(column);
  expect(lines[1]).toContain(id);
});

test("malformed export requests are refused", async ({ request }) => {
  expect((await request.get("/api/site/export?ids=not-an-id")).status()).toBe(400);
  expect((await request.get("/api/site/export?ids=0f4f9b1e-7e36-4b6e-9b8b-2f1b2a3c4d5e&format=xlsx")).status()).toBe(400);
});
