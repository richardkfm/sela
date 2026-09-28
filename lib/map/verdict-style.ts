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
import { VERDICT_LABEL_DE as VERDICT_TEXT_LABEL_DE } from "@/lib/scoring/verdict-text";
import type { MapPatternEncoding } from "./patterns";

export type MapVerdict = SuitabilityVerdictLabel | "unscored";

export const MAP_VERDICTS: readonly MapVerdict[] = [
  "unrestricted",
  "restricted",
  "suitable",
  "unsuitable",
  "not_considered",
  "excluded",
  "unscored",
];

/**
 * The classes a region's legend shows. A real region is classified without a
 * score (real-pv-v1, ADR-0009); only the synthetic fixture still has the
 * illustrative geeignet/ungeeignet.
 */
export function mapVerdictsFor(regionKind: "real" | "fixture"): readonly MapVerdict[] {
  return regionKind === "real"
    ? ["unrestricted", "restricted", "not_considered", "excluded", "unscored"]
    : ["suitable", "unsuitable", "excluded", "unscored"];
}

/** Legend line for real regions: what the four classes are, and what they are not. */
export const CLASSIFICATION_NOTE_DE =
  "Einordnung nach Bodenbedeckung und Schutzgebieten – keine Planungs- oder Genehmigungsaussage.";

export const VERDICT_LABEL_DE: Record<MapVerdict, string> = {
  ...VERDICT_TEXT_LABEL_DE,
  unscored: "nicht bewertet",
};

/** One sentence per class, for the legend — what the colour means, not just its name. */
export const VERDICT_EXPLANATION_DE: Record<MapVerdict, string> = {
  unrestricted: "Bodenbedeckung ohne Einschränkung, z. B. Acker; kein Ausschluss",
  restricted: "Bodenbedeckung eingeschränkt, z. B. Grünland; kein Ausschluss",
  suitable: "erreicht die Schwelle",
  unsuitable: "unter der Schwelle",
  excluded: "Schutzgebiet (hartes Ausschlusskriterium)",
  not_considered: "Bodenbedeckung, z. B. Wald, Gewässer, Siedlung",
  unscored: "keine Bewertung",
};

export const TECHNOLOGY_LABEL_DE: Record<Technology, string> = {
  pv: "Solar-PV",
  agripv: "Agri-PV",
  wind: "Wind",
};

const UNSUITABLE_COLOR = "#d8d5cc";
const EXCLUDED_COLOR = "#8a8a8a";
// Between "ungeeignet" and "ausgeschlossen" in lightness, with its own stipple:
// not a statute (hatched grey) and not a low score (plain light grey), but land
// the method does not score (ADR-0009).
const NOT_CONSIDERED_COLOR = "#b3b0a8";
const UNSCORED_COLOR = "#eeece6";

/** Half-way to white — "eingeschränkt" in the technology's own hue, lighter and unpatterned. */
function tint(hex: string): string {
  const v = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round((c + 255) / 2).toString(16).padStart(2, "0");
  return `#${mix((v >> 16) & 0xff)}${mix((v >> 8) & 0xff)}${mix(v & 0xff)}`;
}
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
    case "unrestricted":
      return { color: scenarioTokens[technologyToTokenKey[technology]].light, encoding: technologyEncoding(technology) };
    case "restricted":
      return { color: tint(scenarioTokens[technologyToTokenKey[technology]].light), encoding: null };
    case "unsuitable":
      return { color: UNSUITABLE_COLOR, encoding: null };
    case "excluded":
      return { color: EXCLUDED_COLOR, encoding: "hatch-0" };
    case "not_considered":
      return { color: NOT_CONSIDERED_COLOR, encoding: "stipple" };
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
