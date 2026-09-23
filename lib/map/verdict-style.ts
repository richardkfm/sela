// How a suitability verdict looks on a map — one definition shared by the 2D
// explorer, its legend, and the ground plane of the 3D preview, so the three
// cannot drift apart. Colours come from lib/design/tokens.ts; every class
// also carries a non-colour encoding (design-language.md §4.3, §9).
//
// MapLibre paint expressions cannot read CSS custom properties, so the map is
// light-mode only for now; dark-mode map theming remains a known follow-up
// (it was one before this file existed).

import { scenarioTokens, surfaceTokens, technologyToTokenKey, type SecondaryEncoding } from "@/lib/design/tokens";
import type { SuitabilityVerdictLabel, Technology } from "@/lib/scoring/types";
import type { MapPatternEncoding } from "./patterns";

export type MapVerdict = SuitabilityVerdictLabel | "unscored";

export const MAP_VERDICTS: readonly MapVerdict[] = ["suitable", "unsuitable", "excluded", "unscored"];

export const VERDICT_LABEL_DE: Record<MapVerdict, string> = {
  suitable: "geeignet",
  unsuitable: "ungeeignet",
  excluded: "ausgeschlossen",
  unscored: "nicht bewertet",
};

/** One sentence per class, for the legend — what the colour means, not just its name. */
export const VERDICT_EXPLANATION_DE: Record<MapVerdict, string> = {
  suitable: "erreicht die Schwelle",
  unsuitable: "unter der Schwelle",
  excluded: "hartes Ausschlusskriterium",
  unscored: "keine Bewertung",
};

export const TECHNOLOGY_LABEL_DE: Record<Technology, string> = {
  pv: "Solar-PV",
  agripv: "Agri-PV",
  wind: "Wind",
};

const UNSUITABLE_COLOR = "#d8d5cc";
const EXCLUDED_COLOR = "#8a8a8a";
const UNSCORED_COLOR = "#eeece6";
/** Near-white marks on coloured ground — what the CSS patterns draw too. */
export const PATTERN_MARK_COLOR = "#fbfaf7";
export const INK = surfaceTokens.textPrimary.light;

export interface VerdictAppearance {
  readonly color: string;
  /** `null` = plain fill; the class is then distinguished by lightness and label. */
  readonly encoding: MapPatternEncoding | null;
}

function technologyEncoding(technology: Technology): MapPatternEncoding {
  const encoding: SecondaryEncoding = scenarioTokens[technologyToTokenKey[technology]].secondaryEncoding;
  // Technologies only ever carry hatch encodings (tokens.ts); the fallback keeps the type honest.
  return encoding === "none" || encoding === "solid" ? "hatch-45" : encoding;
}

export function verdictAppearance(verdict: MapVerdict, technology: Technology): VerdictAppearance {
  switch (verdict) {
    case "suitable":
      return { color: scenarioTokens[technologyToTokenKey[technology]].light, encoding: technologyEncoding(technology) };
    case "unsuitable":
      return { color: UNSUITABLE_COLOR, encoding: null };
    case "excluded":
      return { color: EXCLUDED_COLOR, encoding: "hatch-0" };
    case "unscored":
      return { color: UNSCORED_COLOR, encoding: null };
  }
}

/** Image name MapLibre knows a verdict's pattern by, per technology. */
export function patternName(verdict: MapVerdict, technology: Technology): string {
  return `sela-${verdict}-${technology}`;
}

/** CSS class matching a map pattern, for legend swatches. */
export function patternClass(encoding: MapPatternEncoding | null): string | undefined {
  return encoding ? `pattern-${encoding}` : undefined;
}
