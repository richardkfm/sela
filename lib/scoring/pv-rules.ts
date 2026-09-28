// The rules decided by the project owner on 2026-09-27 through the CLAUDE.md §3
// gate — roadmap Step 1, docs/domain/decision-memo-scoring-rules.md (Q1–Q5 and
// its *Follow-up decisions*), recorded in docs/domain/scoring-criteria.md §6.
//
// These are *decided* rules, unlike lib/scoring/illustrative-weights.ts, which
// still holds the placeholders (weights, slope bounds, the suitability
// threshold). The method page renders this module, so what the public reads is
// what the engine runs.

import { CLC_CLASS_NAME_DE } from "./clc-classes";

/**
 * Q2d — a cell is excluded when at least this share of it lies inside a
 * Naturschutzgebiet or the Nationalpark (Q1c). A smaller overlap is a
 * Prüfhinweis (lib/scoring/protection-flags.ts), not an exclusion.
 */
export const PROTECTION_EXCLUSION_SHARE = 0.5;

/**
 * Q2d follow-up — an overlap smaller than this share of a cell is not shown as a
 * Prüfhinweis: at 1 % of a 2.6 ha cell it lies within the digitising accuracy of
 * the LfU overview data (1:10 000). The overlap stays stored.
 */
export const PROTECTION_FLAG_MIN_SHARE = 0.01;

/**
 * Q4b — irradiation bounds: p1 and p99 of the DWD 2016–2025 mean over every
 * German 1 km pixel (359 586 pixels), measured 2026-09-27
 * (docs/domain/evidence/2026-09-27-scoring-rules/evidence.md §B). National, never
 * regional: regional bounds would stretch the Uckermark's 37 kWh/m² spread to
 * the full scale.
 */
export const IRRADIATION_BOUNDS = { min: 1050.5, max: 1257.1 } as const;

/** Quartiles of the same national distribution (evidence.md §B), for the national position of a cell. */
export const IRRADIATION_NATIONAL_QUARTILES = { p25: 1101.6, p50: 1137.2, p75: 1187.8 } as const;

/**
 * Q4b — where a cell's irradiation sits among German values. Inside one
 * Landkreis irradiation barely varies; its position in the national range is
 * the honest reading of it.
 */
export function irradiationNationalPositionDe(kwhPerM2: number): string {
  const q = IRRADIATION_NATIONAL_QUARTILES;
  if (kwhPerM2 < q.p25) return "unteres Viertel der Werte in Deutschland";
  if (kwhPerM2 < q.p50) return "unteres Mittelfeld der Werte in Deutschland";
  if (kwhPerM2 < q.p75) return "oberes Mittelfeld der Werte in Deutschland";
  return "oberes Viertel der Werte in Deutschland";
}

/**
 * Q5 — a criterion is named as limiting only when its normalised value lies at
 * least this far below the best value of that criterion in the compared land
 * (the cells of the region that receive a score). Otherwise no criterion is
 * named: none stands out against the rest of the region.
 */
export const LIMITING_MIN_GAP = 0.1;

export type LandCoverTier = "vorgesehen" | "eingeschraenkt" | "nicht_vorgesehen";

export const LAND_COVER_TIER_LABEL_DE: Record<LandCoverTier, string> = {
  vorgesehen: "vorgesehen",
  eingeschraenkt: "eingeschränkt",
  nicht_vorgesehen: "nicht vorgesehen",
};

export interface LandCoverTierEntry {
  readonly tier: LandCoverTier;
  /** One line, published on the method page: why this class sits in this tier. */
  readonly reasonDe: string;
}

const SETTLEMENT = "Siedlungsfläche – sela bewertet Freiflächen-PV, nicht Dachanlagen";
const FOREST = "Wald";
const SEMI_NATURAL = "naturnahe Vegetation";
const OPEN_NATURAL = "naturnahe Fläche ohne geschlossene Vegetation";
const WETLAND = "Feuchtgebiet";
const WATER = "Gewässer – schwimmende PV ist nicht Teil von sela";

/**
 * Q3b — every CLC class documented for Germany (clc-classes.ts), in one of three
 * tiers. The owner confirmed the assignment for the classes present in the
 * Uckermark on 2026-09-27; 221, 332, 334, 335, 421, 423, 521, 522 and 523 do
 * not occur there and are assigned by analogy (scoring-criteria.md §6).
 *
 * The tier is a category, not a score (follow-up decision): *nicht vorgesehen*
 * makes a cell `not_considered`, *eingeschränkt* is shown beside the verdict,
 * and neither tier moves the weighted score.
 */
export const LAND_COVER_TIERS: Readonly<Record<number, LandCoverTierEntry>> = {
  111: { tier: "nicht_vorgesehen", reasonDe: SETTLEMENT },
  112: { tier: "nicht_vorgesehen", reasonDe: SETTLEMENT },
  121: { tier: "eingeschraenkt", reasonDe: "bebaute Gewerbe- und Industriefläche – Freiflächen-PV nur auf unbebauten Teilen" },
  122: { tier: "nicht_vorgesehen", reasonDe: "die Verkehrsfläche selbst" },
  123: { tier: "eingeschraenkt", reasonDe: "Betriebsfläche eines Hafens – nur nach Maßgabe des Betriebs" },
  124: { tier: "eingeschraenkt", reasonDe: "Betriebsfläche eines Flughafens – nur nach Maßgabe des Betriebs" },
  131: { tier: "vorgesehen", reasonDe: "vorbelastete Fläche (Abbau)" },
  132: { tier: "vorgesehen", reasonDe: "vorbelastete Fläche (Deponie, Halde)" },
  133: { tier: "eingeschraenkt", reasonDe: "Baustelle – künftige Nutzung offen" },
  141: { tier: "nicht_vorgesehen", reasonDe: "Grünfläche im Siedlungsbereich" },
  142: { tier: "nicht_vorgesehen", reasonDe: "Sport- und Freizeitfläche" },
  211: {
    tier: "vorgesehen",
    reasonDe:
      "offene, gehölzfreie Ackerfläche – was der Landwirtschaft verloren geht, gehört zum Ergebnis (Flächennutzung), nicht zur Eignung",
  },
  221: { tier: "eingeschraenkt", reasonDe: "Dauerkultur – eine bestehende Nutzung wäre zu ersetzen" },
  222: { tier: "eingeschraenkt", reasonDe: "Dauerkultur – eine bestehende Nutzung wäre zu ersetzen" },
  231: { tier: "eingeschraenkt", reasonDe: "Grünland – offen, aber oft ökologisch wertvoll oder auf Moorboden; Einzelfall" },
  242: { tier: "eingeschraenkt", reasonDe: "kleinteiliges Nutzungsmosaik – Einzelfall" },
  243: { tier: "eingeschraenkt", reasonDe: "Landwirtschaft mit naturnahen Anteilen – Einzelfall" },
  311: { tier: "nicht_vorgesehen", reasonDe: FOREST },
  312: { tier: "nicht_vorgesehen", reasonDe: FOREST },
  313: { tier: "nicht_vorgesehen", reasonDe: FOREST },
  321: { tier: "nicht_vorgesehen", reasonDe: SEMI_NATURAL },
  322: { tier: "nicht_vorgesehen", reasonDe: SEMI_NATURAL },
  324: { tier: "nicht_vorgesehen", reasonDe: SEMI_NATURAL },
  331: { tier: "nicht_vorgesehen", reasonDe: OPEN_NATURAL },
  332: { tier: "nicht_vorgesehen", reasonDe: OPEN_NATURAL },
  333: { tier: "nicht_vorgesehen", reasonDe: OPEN_NATURAL },
  334: { tier: "nicht_vorgesehen", reasonDe: OPEN_NATURAL },
  335: { tier: "nicht_vorgesehen", reasonDe: OPEN_NATURAL },
  411: { tier: "nicht_vorgesehen", reasonDe: WETLAND },
  412: { tier: "nicht_vorgesehen", reasonDe: WETLAND },
  421: { tier: "nicht_vorgesehen", reasonDe: WETLAND },
  423: { tier: "nicht_vorgesehen", reasonDe: WETLAND },
  511: { tier: "nicht_vorgesehen", reasonDe: WATER },
  512: { tier: "nicht_vorgesehen", reasonDe: WATER },
  521: { tier: "nicht_vorgesehen", reasonDe: WATER },
  522: { tier: "nicht_vorgesehen", reasonDe: WATER },
  523: { tier: "nicht_vorgesehen", reasonDe: WATER },
};

/**
 * The tier of a CLC class. A class outside BKG's documented list has no written
 * reason, so it is treated as *nicht vorgesehen* rather than silently scored.
 */
export function landCoverTier(code: number): LandCoverTierEntry {
  return (
    LAND_COVER_TIERS[Math.round(code)] ?? {
      tier: "nicht_vorgesehen",
      reasonDe: "Klasse nicht in der dokumentierten Liste – keine Einordnung",
    }
  );
}

/** Every documented class of one tier, for the method page. */
export function landCoverClassesOfTier(tier: LandCoverTier): { code: number; nameDe: string; reasonDe: string }[] {
  return Object.entries(LAND_COVER_TIERS)
    .filter(([, entry]) => entry.tier === tier)
    .map(([code, entry]) => ({ code: Number(code), nameDe: CLC_CLASS_NAME_DE[Number(code)] ?? code, reasonDe: entry.reasonDe }));
}

/**
 * Step 2 (decided 2026-09-28, docs/domain/decision-memo-pv-method.md): slope is
 * a measured value, not a class. DGM200 flattens slopes systematically at 200 m,
 * no citable limit bites in the Uckermark (steepest cell 6.8°), and Brandenburg's
 * own guidance names no number.
 */
export const SLOPE_NOTE_DE =
  "Nur Messwert, nicht eingestuft: Das 200-m-Geländemodell glättet Neigungen. Brandenburg empfiehlt, Hanglagen " +
  "zu vermeiden, nennt aber keinen Grenzwert (Gemeinsame Arbeitshilfe PV-FFA, 2023, S. 21).";

/** Step 2: irradiation is classed by national quartile and never combined with other criteria. */
export const IRRADIATION_NOTE_DE =
  "Eingestuft nach Vierteln der Werte in Deutschland (DWD, Mittel 2016–2025), nicht mit anderen Kriterien verrechnet.";
