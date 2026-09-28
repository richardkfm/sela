// How a verdict's "why" is written — one wording for the parcel page, the map
// panel and the scenario card, so they cannot drift apart (flow F2; ADR-0009).
// Advisory by construction: nothing here states a permission outcome.

import { formatClcClass } from "./clc-classes";
import { LAND_COVER_TIER_LABEL_DE, landCoverTier, type LandCoverTier } from "./pv-rules";
import type { SuitabilityVerdictLabel } from "./types";

export const VERDICT_LABEL_DE: Record<SuitabilityVerdictLabel, string> = {
  suitable: "geeignet",
  unsuitable: "ungeeignet",
  excluded: "ausgeschlossen",
  not_considered: "nicht vorgesehen",
  restricted: "eingeschränkt",
  unrestricted: "ohne Einschränkung",
};

/** The lead-in before the named criterion, by verdict. */
export const REASON_LEAD_DE: Record<SuitabilityVerdictLabel, string> = {
  excluded: "Ausgeschlossen durch",
  not_considered: "Nicht vorgesehen wegen",
  restricted: "Eingeschränkt wegen",
  unrestricted: "Eingeordnet nach",
  suitable: "Begrenzt am deutlichsten durch",
  unsuitable: "Begrenzt am deutlichsten durch",
};

/** The classified states — every verdict a real region gets (ADR-0009, amendment 1). */
export function isClassified(verdict: SuitabilityVerdictLabel): boolean {
  return verdict !== "suitable" && verdict !== "unsuitable";
}

/**
 * A suitability criterion shown as a measured value but never combined into a
 * score — weight 0 under real-pv-v1 (irradiation, slope). Outcome-method inputs
 * also carry weight 0 but apply to scenarios, not technologies, so they are not this.
 */
export function isMeasuredOnly(definition: {
  readonly weight: number;
  readonly isHardConstraint: boolean;
  readonly isCategory?: boolean;
  readonly appliesTo: readonly string[];
}): boolean {
  return (
    definition.weight === 0 &&
    !definition.isHardConstraint &&
    !definition.isCategory &&
    definition.appliesTo.some((t) => t === "pv" || t === "agripv" || t === "wind")
  );
}

/** A scored verdict with no limiting criterion (decision memo Q5). */
export const NO_LIMITING_CRITERION_DE =
  "Kein Kriterium liegt hier deutlich unter dem besten Wert der bewerteten Flächen der Region.";

/** What "begrenzt" means under Q5, for a caption or tooltip. */
export const LIMITING_EXPLANATION_DE =
  "das Kriterium, das am weitesten – mindestens 0,1 auf der 0–1-Skala – unter seinem besten Wert in der Region liegt";

const TIER_VERDICT: Record<LandCoverTier, SuitabilityVerdictLabel> = {
  vorgesehen: "unrestricted",
  eingeschraenkt: "restricted",
  nicht_vorgesehen: "not_considered",
};

export interface LandCoverReading {
  readonly code: number;
  /** "211 · Nicht bewässertes Ackerland" */
  readonly classDe: string;
  readonly tier: LandCoverTier;
  /** The tier's name as the method publishes it ("vorgesehen" …). */
  readonly tierDe: string;
  /**
   * The name on screens outside the method (decided 2026-09-28): "vorgesehen"
   * could be read as "im Plan vorgesehen", so the class reads "ohne Einschränkung".
   */
  readonly classLabelDe: string;
  readonly reasonDe: string;
}

export function readLandCover(code: number): LandCoverReading {
  const entry = landCoverTier(code);
  return {
    code: Math.round(code),
    classDe: formatClcClass(Math.round(code)),
    tier: entry.tier,
    tierDe: LAND_COVER_TIER_LABEL_DE[entry.tier],
    classLabelDe: VERDICT_LABEL_DE[TIER_VERDICT[entry.tier]],
    reasonDe: entry.reasonDe,
  };
}
