// Map-side twins of app/globals.css's `.pattern-*` classes. design-language.md
// §4.3 obligation 1 — colour is never the sole encoding — applies to the map
// as much as to the legend: a hatched swatch in the legend is a promise that
// the matching cells on the map are hatched too. Without this, the map is the
// one place where amber-vs-grey carries the verdict alone, and it is also the
// one place that is photocopied into council packets.
//
// These are UI textures generated per pixel on a canvas — not geodata, so
// ADR-0002's "no raster math in TypeScript" does not reach them.

import type { Map as MaplibreMap } from "maplibre-gl";
import type { SecondaryEncoding } from "@/lib/design/tokens";

/** Map encodings — the scenario encodings plus one for exclusion, which has no scenario of its own. */
export type MapPatternEncoding = Exclude<SecondaryEncoding, "none" | "solid"> | "hatch-0";

const TILE = 8;
const STRIPE = 2;

function covered(encoding: MapPatternEncoding, x: number, y: number): boolean {
  switch (encoding) {
    case "hatch-45":
      return (x + y) % TILE < STRIPE;
    case "hatch-135":
      return (x - y + TILE * 2) % TILE < STRIPE;
    case "crosshatch-45":
      return (x + y) % TILE < STRIPE || (x - y + TILE * 2) % TILE < STRIPE;
    case "hatch-0":
      return y % TILE < STRIPE;
    case "stipple":
      return x % 4 === 1 && y % 4 === 1;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * An 8×8 tile: `base` colour at `alpha`, with the encoding's marks in
 * `markColor` at full strength so the texture survives greyscale.
 */
export function patternImage(
  encoding: MapPatternEncoding,
  base: string,
  markColor: string,
  alpha = 1,
): { width: number; height: number; data: Uint8Array } {
  const [br, bg, bb] = hexToRgb(base);
  const [mr, mg, mb] = hexToRgb(markColor);
  const data = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      const mark = covered(encoding, x, y);
      data[i] = mark ? mr : br;
      data[i + 1] = mark ? mg : bg;
      data[i + 2] = mark ? mb : bb;
      data[i + 3] = Math.round((mark ? Math.min(1, alpha + 0.25) : alpha) * 255);
    }
  }
  return { width: TILE, height: TILE, data };
}

/** Adds (or replaces) a pattern image under `name`. Safe to call before or after style load. */
export function addPattern(
  map: MaplibreMap,
  name: string,
  encoding: MapPatternEncoding,
  base: string,
  markColor: string,
  alpha = 1,
): void {
  const image = patternImage(encoding, base, markColor, alpha);
  if (map.hasImage(name)) map.updateImage(name, image);
  else map.addImage(name, image, { pixelRatio: 1 });
}
