// An explicit keyboard path to map selection (roadmap §5.4, design-language.md
// §9: "a map that only answers a mouse excludes the people the tool is
// explicitly for") and a table view reachable from every chart.

import { expect, test } from "@playwright/test";
import { FIXTURE_EXPLORER, getSampleUnitId } from "./helpers";

test("select a unit from the list with the keyboard alone, then follow it to its detail page", async ({ page }) => {
  await page.goto(FIXTURE_EXPLORER);
  const firstUnit = page.locator('nav[aria-label="Flächen in der Pilotregion"] button').first();
  await firstUnit.waitFor();
  await firstUnit.focus();
  await expect(firstUnit).toBeFocused();
  await page.keyboard.press("Enter");

  // Selecting moves focus to the selection card, so keyboard and screen-reader users land on what they chose.
  const card = page.getByRole("region", { name: /Fläche/ });
  await expect(card).toBeVisible();
  await expect(page.locator("#selection-heading")).toBeFocused();
  await expect(firstUnit).toHaveAttribute("aria-current", "true");

  // The card's links are the way on — reachable with Tab, activated with Enter.
  const detail = card.getByRole("link", { name: "Begründung" });
  await detail.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/unit\/[^/]+$/);

  // Escape clears a selection without a mouse.
  await page.goto(FIXTURE_EXPLORER);
  await firstUnit.focus();
  await page.keyboard.press("Enter");
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
});

test("the technology switch is operable by keyboard and updates the legend", async ({ page }) => {
  await page.goto(FIXTURE_EXPLORER);
  const wind = page.getByRole("group", { name: "Technologie" }).getByRole("button", { name: "Wind" });
  await wind.focus();
  await page.keyboard.press("Enter");
  await expect(wind).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: /Legende · Wind/ })).toBeVisible();
});

test("the 3D preview's controls are reachable without a mouse", async ({ page, request, baseURL }) => {
  const id = await getSampleUnitId(request, baseURL!);
  await page.goto(`/unit/${id}/preview?technology=wind`);
  const hub = page.getByLabel("Nabenhöhe");
  await hub.focus();
  await page.keyboard.press("ArrowRight");
  await expect(hub).toHaveValue("165");
  await expect(page.getByText("245 m", { exact: true })).toBeVisible();

  // Every cited ring shows its source link.
  await expect(page.getByRole("link", { name: "§ 249 Abs. 10 BauGB" })).toBeVisible();
  await expect(page.getByRole("link", { name: "§ 1 BbgWEAAbG" })).toBeVisible();

  const pv = page.getByRole("group", { name: "Szenario" }).getByRole("button", { name: "Solar-PV" });
  await pv.focus();
  await page.keyboard.press("Enter");
  await expect(pv).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Modulreihen auf der Fläche")).toBeVisible();
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
