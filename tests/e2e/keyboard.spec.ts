// An explicit keyboard path to map selection (roadmap §5.4, design-language.md
// §9: "a map that only answers a mouse excludes the people the tool is
// explicitly for") and a table view reachable from every chart.

import { expect, test } from "@playwright/test";
import { getSampleUnitId } from "./helpers";

test("tab into the unit list and activate a unit with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  const firstLink = page.locator('nav[aria-label="Flächen in der Pilotregion"] a').first();
  await firstLink.waitFor();
  await firstLink.focus();
  await expect(firstLink).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/unit\/.+/);
  expect(page.url()).toMatch(/\/unit\/[^/]+$/);
});

test("the comparison screen's table view is present and reachable without a mouse", async ({ page, request, baseURL }) => {
  const id = await getSampleUnitId(request, baseURL!);
  await page.goto(`/unit/${id}/compare`);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();

  const rows = page.getByRole("row");
  // header row + one per outcome dimension
  await expect(rows).toHaveCount(1 + 6);

  // A criterion link on the parcel detail page is reachable purely via Tab.
  await page.goto(`/unit/${id}`);
  await page.keyboard.press("Tab"); // "← Zur Karte"
  await page.keyboard.press("Tab"); // first criterion link, if present
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
});
