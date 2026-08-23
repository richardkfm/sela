// Automated WCAG 2.2 AA checks on every screen (roadmap §5.4) — one of
// "the two bars that are usually deferred, and will not be".

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getSampleUnitId, KNOWN_CRITERION_ID } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag22aa"];

async function assertNoViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("map explorer", async ({ page }) => {
  await page.goto("/");
  await assertNoViolations(page);
});

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
  await assertNoViolations(page);
});
