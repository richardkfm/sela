#!/usr/bin/env node
// MapLibre resolves its background worker script relative to
// import.meta.url, which doesn't survive Next.js's webpack bundling (it
// resolves to the page's own URL instead of a loadable module — see
// app/(map)/Map.tsx's setWorkerUrl call). The workaround is to serve the
// installed package's worker bundle as a static asset and point
// maplibregl.setWorkerUrl at it directly. Runs on postinstall so the copy
// always matches the installed maplibre-gl version instead of a
// hand-committed file that can drift out of sync on upgrade.

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const maplibreDist = join(repoRoot, "node_modules/maplibre-gl/dist");
const publicDir = join(repoRoot, "public");

mkdirSync(publicDir, { recursive: true });

for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(maplibreDist, file), join(publicDir, file));
}

console.log("copied maplibre-gl worker bundle to public/");
