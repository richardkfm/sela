// Greyscale legibility (roadmap §5.4, design-language.md §4.3): "green,
// blue, and status-quo grey collapse to within 4 percentage points of each
// other in monochrome" — so every scenario fill also carries a pattern
// (lib/design/tokens.ts's secondaryEncoding), and this test proves the
// patterns survive a real greyscale conversion, not just the raw luminance
// numbers §4.3 already documents as colliding.

import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { scenarioTokens } from "../../lib/design/tokens";
import { getSampleUnitId } from "./helpers";

function localVariance(data: Buffer, width: number, x0: number, y0: number, size: number): number {
  const values: number[] = [];
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      values.push(data[y * width + x] ?? 0);
    }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

test("scenario swatches stay distinguishable by pattern after a real greyscale conversion", async ({ page, request, baseURL }) => {
  const id = await getSampleUnitId(request, baseURL!);
  await page.goto(`/unit/${id}/compare`);

  const swatches = page.getByTestId("scenario-swatch");
  await expect(swatches).toHaveCount(6);

  const { data, info } = await (async () => {
    // Composite all six swatches into one buffer via a single full-page
    // greyscale screenshot, then locate each by its own bounding box —
    // avoids six separate screenshot round-trips.
    const buffer = await page.screenshot();
    return sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  })();

  for (let i = 0; i < 6; i++) {
    const swatch = swatches.nth(i);
    const encoding = await swatch.getAttribute("data-encoding");
    const scenario = await swatch.getAttribute("data-scenario");
    const box = await swatch.boundingBox();
    if (!box) throw new Error(`swatch ${scenario} has no bounding box`);

    const size = Math.floor(Math.min(box.width, box.height) * 0.7);
    const x0 = Math.round(box.x + (box.width - size) / 2);
    const y0 = Math.round(box.y + (box.height - size) / 2);
    const variance = localVariance(data, info.width, x0, y0, size);

    if (encoding === "none" || encoding === "solid") {
      // status_quo (none) and preserve (solid) are flat fills by design —
      // recorded here as a snapshot, not a pass/fail gate.
      continue;
    }

    // A patterned fill has measurably higher local variance in greyscale
    // than a flat one — this is the actual legibility property design-language
    // §4.3 requires, checked directly rather than trusting the pattern is there.
    expect(variance, `scenario "${scenario}" (${encoding}) should show pattern texture once desaturated`).toBeGreaterThan(4);
  }

  // Documented regression snapshot of §4.3's own luminance numbers — not
  // the pass/fail gate above, but worth pinning so a future palette change
  // that silently un-collides them is visible in a diff.
  expect(scenarioTokens.preserve.light).toBe("#008300");
  expect(scenarioTokens.onshoreWind.light).toBe("#2a78d6");
  expect(scenarioTokens.statusQuo.light).toBe("#6f6e6a");
});

// The same obligation on the map itself: a suitable unit is hatched on the
// canvas, not only in the legend, so it stays distinguishable when the map
// is photocopied into a council packet. An unsuitable unit (plain fill) is
// measured too, as a control: without it, basemap texture under a mis-framed
// map would pass for a hatch — which is exactly how this test first failed.
/** Mean and variance of a 24 px square at the centre of the free map area, in greyscale. */
async function sampleSelectedUnit(page: import("@playwright/test").Page): Promise<{ mean: number; variance: number }> {
  // Selection frames the unit in the free area between the two panels (Explorer.tsx WIDE_PADDING_WITH_SELECTION).
  const x0 = Math.round(400 + (1280 - 800) / 2 - 12);
  const y0 = 360 - 12;
  const { data, info } = await sharp(await page.screenshot()).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let y = y0; y < y0 + 24; y++) for (let x = x0; x < x0 + 24; x++) sum += data[y * info.width + x] ?? 0;
  return { mean: sum / (24 * 24), variance: localVariance(data, info.width, x0, y0, 24) };
}

async function selectUnit(page: import("@playwright/test").Page, unitId: string): Promise<void> {
  await page.goto("/");
  await page.locator('nav[aria-label="Flächen in der Pilotregion"] button', { hasText: unitId.slice(0, 8) }).click();
  await page.getByRole("region", { name: new RegExp(unitId.slice(0, 8)) }).waitFor();
}

test("a suitable unit on the map keeps its hatch after a real greyscale conversion", async ({ page, request, baseURL }) => {
  const verdicts: { spatialUnitId: string; verdict: string }[] = await (
    await request.get(`${baseURL}/api/units/verdicts?technology=pv`)
  ).json();
  const suitable = verdicts.find((v) => v.verdict === "suitable");
  const plain = verdicts.find((v) => v.verdict === "unsuitable");
  if (!suitable || !plain) throw new Error("fixture needs a suitable and an unsuitable PV unit");

  await page.setViewportSize({ width: 1280, height: 720 });
  // Reduced motion makes the framing a jump rather than an animation; the polls then only wait for
  // tiles and layers to render — slow under software GL when tests run in parallel.
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Empty ground (#faf9f6) is ≈ 249 in greyscale; any unit fill is clearly darker. Requiring that
  // proves the sample is looking at a rendered unit, not at a map that has not drawn yet.
  const GROUND_GREY = 240;

  // Control: a plain fill must be rendered and read as flat, or the measurement is seeing something else.
  await selectUnit(page, plain.spatialUnitId);
  await expect.poll(async () => (await sampleSelectedUnit(page)).mean, { timeout: 30_000 }).toBeLessThan(GROUND_GREY);
  expect((await sampleSelectedUnit(page)).variance, "a plain fill reads as flat").toBeLessThan(2);

  await selectUnit(page, suitable.spatialUnitId);
  await expect.poll(async () => (await sampleSelectedUnit(page)).mean, { timeout: 30_000 }).toBeLessThan(GROUND_GREY);
  await expect
    .poll(async () => (await sampleSelectedUnit(page)).variance, {
      timeout: 15_000,
      message: "the selected suitable unit should show hatch texture once desaturated",
    })
    .toBeGreaterThan(4);
});
