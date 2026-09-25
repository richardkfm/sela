// Automated WCAG 2.2 AA checks on every screen (roadmap §5.4) — one of
// "the two bars that are usually deferred, and will not be". Every screen is
// checked in both colour schemes: dark mode is fully supported
// (design-language.md §10), and its link colours once failed contrast unseen.

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { FIXTURE_EXPLORER, getSampleUnitId, KNOWN_CRITERION_ID } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag22aa"];

async function assertNoViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("map explorer (default region)", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("heading", { name: "Flächen im Vergleich" }).waitFor();
      await assertNoViolations(page);
    });

    test("map explorer (fixture)", async ({ page }) => {
      await page.goto(FIXTURE_EXPLORER);
      await assertNoViolations(page);
    });

    test("map explorer with a unit selected", async ({ page }) => {
      await page.goto(FIXTURE_EXPLORER);
      await page.locator('nav[aria-label="Flächen in der Pilotregion"] button').first().click();
      await page.getByRole("region", { name: /Fläche/ }).getByText(/geeignet|ausgeschlossen/).first().waitFor();
      await assertNoViolations(page);
    });

    for (const technology of ["wind", "pv", "agripv", "status_quo"]) {
      test(`3D preview (${technology})`, async ({ page, request, baseURL }) => {
        const id = await getSampleUnitId(request, baseURL!);
        await page.goto(`/unit/${id}/preview?technology=${technology}`);
        await page.getByRole("heading", { name: /3D-Vorschau/ }).waitFor();
        await assertNoViolations(page);
      });
    }

    test("parcel detail", async ({ page, request, baseURL }) => {
      const id = await getSampleUnitId(request, baseURL!);
      await page.goto(`/unit/${id}`);
      await assertNoViolations(page);
    });

    test("scenario comparison", async ({ page, request, baseURL }) => {
      const id = await getSampleUnitId(request, baseURL!);
      await page.goto(`/unit/${id}/compare`);
      await assertNoViolations(page);
    });

    test("evidence view", async ({ page }) => {
      await page.goto(`/criterion/${KNOWN_CRITERION_ID}`);
      await assertNoViolations(page);
    });

    test("method page", async ({ page }) => {
      await page.goto("/method");
      // Unfold every method's factors, so their tables are checked too — only
      // once the page has hydrated: opening <details> earlier changes the DOM
      // under React and trips a hydration-mismatch toast in development.
      await page.waitForLoadState("networkidle");
      await page.locator("details").evaluateAll((els) => els.forEach((el) => ((el as HTMLDetailsElement).open = true)));
      await assertNoViolations(page);
    });
  });
}
