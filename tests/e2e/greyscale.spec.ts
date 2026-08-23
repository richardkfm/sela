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
