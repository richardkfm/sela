// Prüfhinweise — the protected areas a cell overlaps that do not exclude it,
// named and cited (decision memo Q1c, Q2d; ADR-0009). Pure: the overlaps come
// from `protection_overlap`, the rules from lib/scoring/pv-rules.ts.
//
// Wording is advisory by construction (CLAUDE.md §5): every text names its
// source as the LfU *overview* data and the duty the statute sets ("zu
// prüfen"), never a permission outcome. The statutes were read at
// gesetze-im-internet.de on 2026-09-27 (memo Q1). The texts apply to ground-
// mounted PV and agri-PV; for wind, BNatSchG § 26 Abs. 3 sets a different
// rule in a Landschaftsschutzgebiet, and wind is not scored.

import { PROTECTION_EXCLUSION_SHARE, PROTECTION_FLAG_MIN_SHARE } from "./pv-rules";

export type ProtectionCategory = "nsg" | "natp" | "ffh" | "spa" | "lsg" | "br";

/** A `protection_overlap` row. */
export interface ProtectionOverlap {
  readonly spatialUnitId: string;
  readonly category: ProtectionCategory;
  readonly areaCode: string;
  readonly name: string;
  /** Share of the cell inside this area, 0 < share ≤ 1. */
  readonly share: number;
  readonly sourceId: string;
}

export type ProtectionFlagKind = "natura2000_assessment" | "lsg_ordinance" | "partial_strict_protection";

export interface ProtectionFlag {
  readonly kind: ProtectionFlagKind;
  readonly category: ProtectionCategory;
  readonly areaCode: string;
  readonly name: string;
  readonly share: number;
  /** Short line for compact surfaces (map panel). */
  readonly shortDe: string;
  /** The full, cited sentence. */
  readonly textDe: string;
  /** The provision the text cites. */
  readonly legalRef: string;
  readonly sourceId: string;
}

export const CATEGORY_LABEL_DE: Record<ProtectionCategory, string> = {
  nsg: "Naturschutzgebiet",
  natp: "Nationalpark",
  ffh: "FFH-Gebiet",
  spa: "Europäisches Vogelschutzgebiet",
  lsg: "Landschaftsschutzgebiet",
  br: "Biosphärenreservat",
};

/** Dative, for "im …" / "in einem …". */
const CATEGORY_DATIVE_DE: Record<ProtectionCategory, string> = {
  nsg: "Naturschutzgebiet",
  natp: "Nationalpark",
  ffh: "FFH-Gebiet",
  spa: "Europäischen Vogelschutzgebiet",
  lsg: "Landschaftsschutzgebiet",
  br: "Biosphärenreservat",
};

const PERCENT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** Whole percent; a share that rounds to 100 but is not whole says "fast 100". */
export function formatShareDe(share: number): string {
  if (share >= 0.9999) return "100 %";
  if (share >= 0.995) return "fast 100 %";
  return `${PERCENT.format(share * 100)} %`;
}

function flagFor(overlap: ProtectionOverlap, strictShareOfCell: number): ProtectionFlag | null {
  if (overlap.share < PROTECTION_FLAG_MIN_SHARE) return null;
  const share = formatShareDe(overlap.share);
  const where = `nach den Übersichtsdaten des LfU zu ${share}`;
  const base = { category: overlap.category, areaCode: overlap.areaCode, name: overlap.name, share: overlap.share, sourceId: overlap.sourceId };
  switch (overlap.category) {
    case "ffh":
    case "spa":
      return {
        ...base,
        kind: "natura2000_assessment",
        legalRef: "§ 34 BNatSchG",
        shortDe: `${CATEGORY_LABEL_DE[overlap.category]} „${overlap.name}“ (${share}) – Verträglichkeitsprüfung erforderlich`,
        textDe:
          `Liegt ${where} im ${CATEGORY_DATIVE_DE[overlap.category]} „${overlap.name}“ (${overlap.areaCode}). ` +
          "Ein Vorhaben ist vor seiner Zulassung auf seine Verträglichkeit mit den Erhaltungszielen zu prüfen (§ 34 BNatSchG).",
      };
    case "lsg":
      return {
        ...base,
        kind: "lsg_ordinance",
        legalRef: "§ 26 BNatSchG",
        shortDe: `Landschaftsschutzgebiet „${overlap.name}“ (${share}) – Schutzgebietsverordnung prüfen`,
        textDe:
          `Liegt ${where} im Landschaftsschutzgebiet „${overlap.name}“ (${overlap.areaCode}). ` +
          "Was dort zulässig ist, regelt die Schutzgebietsverordnung (§ 26 BNatSchG) – Verordnung prüfen.",
      };
    case "nsg":
    case "natp": {
      // At or above the exclusion share the cell is excluded; the exclusion says so.
      if (strictShareOfCell >= PROTECTION_EXCLUSION_SHARE) return null;
      const label = CATEGORY_DATIVE_DE[overlap.category];
      const legalRef = overlap.category === "nsg" ? "§ 23 BNatSchG" : "§ 24 BNatSchG";
      return {
        ...base,
        kind: "partial_strict_protection",
        legalRef,
        shortDe: `teilweise im ${label} „${overlap.name}“ (${share})`,
        textDe:
          `Teilweise im ${label} „${overlap.name}“ (${share} der Fläche, nach den Übersichtsdaten des LfU). ` +
          `Für diesen Teil gelten die Verbote der Schutzgebietsverordnung (${legalRef}).`,
      };
    }
    case "br":
      // Not flagged: BNatSchG § 25 has not been read at source (memo Q1).
      return null;
  }
}

const KIND_ORDER: Record<ProtectionFlagKind, number> = {
  partial_strict_protection: 0,
  natura2000_assessment: 1,
  lsg_ordinance: 2,
};

/**
 * The Prüfhinweise for one cell. `strictShareOfCell` is the cell's share
 * inside the union of Naturschutzgebiete and the Nationalpark — the value the
 * exclusion reads (`pv_protection_status`).
 */
export function protectionFlags(overlaps: readonly ProtectionOverlap[], strictShareOfCell: number): ProtectionFlag[] {
  return overlaps
    .map((o) => flagFor(o, strictShareOfCell))
    .filter((f): f is ProtectionFlag => f !== null)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.share - a.share || a.name.localeCompare(b.name, "de"));
}
