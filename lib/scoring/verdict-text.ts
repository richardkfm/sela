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
};

/** The lead-in before the named criterion, by verdict. */
export const REASON_LEAD_DE: Record<SuitabilityVerdictLabel, string> = {
  excluded: "Ausgeschlossen durch",
  not_considered: "Nicht vorgesehen wegen",
  suitable: "Begrenzt am deutlichsten durch",
  unsuitable: "Begrenzt am deutlichsten durch",
};

/** A scored verdict with no limiting criterion (decision memo Q5). */
export const NO_LIMITING_CRITERION_DE =
  "Kein Kriterium liegt hier deutlich unter dem besten Wert der bewerteten Flächen der Region.";

/** What "begrenzt" means under Q5, for a caption or tooltip. */
export const LIMITING_EXPLANATION_DE =
  "das Kriterium, das am weitesten – mindestens 0,1 auf der 0–1-Skala – unter seinem besten Wert in der Region liegt";

export interface LandCoverReading {
  readonly code: number;
  /** "211 · Nicht bewässertes Ackerland" */
  readonly classDe: string;
  readonly tier: LandCoverTier;
  readonly tierDe: string;
  readonly reasonDe: string;
}

export function readLandCover(code: number): LandCoverReading {
  const entry = landCoverTier(code);
  return {
    code: Math.round(code),
    classDe: formatClcClass(Math.round(code)),
    tier: entry.tier,
    tierDe: LAND_COVER_TIER_LABEL_DE[entry.tier],
    reasonDe: entry.reasonDe,
  };
}
