// Accessibility + greyscale suite (roadmap §5.4 — "the two bars that are
// usually deferred, and will not be"). Needs a running dev server backed
// by a migrated + fixture-ingested + materialized database — see
// ingest/README.md "Materializing scores". Set PLAYWRIGHT_BASE_URL to
// point at an already-running server instead of having Playwright start
// one (this is what CI and this repo's own dev environment use).

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    // This environment pins a Chromium build that may not match whatever
    // revision the installed @playwright/test version expects to download
    // — point at the pre-installed binary explicitly rather than fetching
    // a new one. Safe to remove once/if that's no longer true.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
