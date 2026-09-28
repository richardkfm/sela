// Nature capital as categories (roadmap Step 4; docs/domain/decision-memo-habitat.md;
// scoring-criteria.md §4.3, decision D5): what the LfU Biotopkataster records
// on a cell — biotope type, protection status, FFH habitat type and its
// conservation grade. Facts about the land, never a score, never summed.
// Pure: the overlaps come from `habitat_overlap`.
//
// Wording is advisory by construction (CLAUDE.md §5): every text says what the
// *Kataster records*, in its own words where it has them. A biotope is
// protected under § 30 BNatSchG by law whether or not it is registered, so the
// Kataster's entry is evidence, not the legal finding — and its absence is not
// evidence of anything, because the mapping is selective outside FFH areas
// and Großschutzgebiete (HABITAT_CAVEAT_DE).

import { formatShareDe } from "./protection-flags";

/** A `habitat_overlap` row. */
export interface HabitatOverlap {
  readonly spatialUnitId: string;
  readonly biotopeId: string;
  readonly geometryKind: "area" | "line" | "point";
  readonly biotopeCode: string;
  readonly biotopeName: string;
  readonly protectionCode: string | null;
  readonly protectionText: string | null;
  readonly lrtCode: string | null;
  readonly lrtName: string | null;
  readonly lrtGrade: string | null;
  readonly mappingMethod: string | null;
  readonly mappedFirst: string | null;
  readonly mappedLast: string | null;
  readonly share: number | null;
  readonly lengthM: number | null;
  readonly sourceId: string;
}

/**
 * An area biotope covering less than this share of the cell is not listed —
 * the same line as for the Prüfhinweise (lib/scoring/pv-rules.ts): at 1 % of a
 * 2.6 ha cell it lies within the 1:10 000 digitising accuracy. Lines and points
 * are listed whenever they touch the cell. Every overlap stays stored.
 */
export const HABITAT_MIN_SHARE = 0.01;

/** BBGNAT codes the Kataster labels "geschützter Biotop …" (read from the data, 2026-09-28). */
const PROTECTED_CODES = new Set(["1", "2"]);

/**
 * FFHGES — the Kataster's own labels, read from its WFS field `ffhges_t`
 * (inspire.brandenburg.de/services/bbk_wfs, 2026-09-28).
 */
export const LRT_GRADE_DE: Readonly<Record<string, string>> = {
  A: "hervorragend",
  B: "gut",
  C: "durchschnittlich oder beschränkt",
  E: "Entwicklungsfläche",
  Z: "irreversibel gestört",
  "9": "nicht bewertbar",
  "0": "sonstiger Wert",
};

/** INTEN — mapping intensity, in the Kataster's own words (field INTEN_T). */
const MAPPING_METHOD_DE: Readonly<Record<string, string>> = {
  C: "vollständige Biotoptypenkartierung",
  B: "einfache terrestrische Biotoptypenkartierung",
  A: "CIR-Luftbildinterpretation",
  A2: "Kartierung auf Luftbildbasis, ohne Geländekontrolle",
};

export const HABITAT_CAVEAT_DE =
  "Das Biotopkataster ist nur in FFH-Gebieten und Großschutzgebieten flächendeckend; außerhalb erfasst es " +
  "gezielt geschützte Biotope und FFH-Lebensraumtypen, und Gebiete in Bearbeitung fehlen. Fehlt ein Eintrag, " +
  "heißt das nicht, dass hier kein geschütztes Biotop liegt. Geschützt ist ein Biotop nach § 30 BNatSchG kraft " +
  "Gesetzes – der Eintrag ist ein Hinweis, keine Feststellung.";

export interface HabitatFact {
  readonly biotopeId: string;
  readonly nameDe: string;
  /** The Kataster's protection text, where it records the biotope as protected. */
  readonly protectedDe: string | null;
  /** "FFH-Lebensraumtyp 6510 Magere Flachland-Mähwiesen", or null. */
  readonly lrtDe: string | null;
  /** "Erhaltungsgrad gut (B)", or null. */
  readonly gradeDe: string | null;
  /** "35 % der Zelle", "120 m in der Zelle", "Punktbiotop". */
  readonly extentDe: string;
  /** "kartiert 2019, vollständige Biotoptypenkartierung". */
  readonly mappedDe: string;
  /** True where the record rests on aerial imagery only. */
  readonly aerialOnly: boolean;
  readonly sourceId: string;
}

const METRES = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function isShown(o: HabitatOverlap): boolean {
  return o.geometryKind !== "area" || (o.share ?? 0) >= HABITAT_MIN_SHARE;
}

function factFor(o: HabitatOverlap): HabitatFact {
  const isProtected = o.protectionCode !== null && PROTECTED_CODES.has(o.protectionCode);
  const extentDe =
    o.geometryKind === "area"
      ? `${formatShareDe(o.share!)} der Zelle`
      : o.geometryKind === "line"
        ? `${METRES.format(o.lengthM!)} m in der Zelle (Linienbiotop)`
        : "Punktbiotop";
  // The Kataster fills an unknown date with 1111-11-11; such a date says nothing.
  const plausible = (d: string | null) => (d && Number(d.slice(0, 4)) >= 1900 ? d.slice(0, 4) : null);
  const year = plausible(o.mappedLast) ?? plausible(o.mappedFirst);
  const method = o.mappingMethod ? MAPPING_METHOD_DE[o.mappingMethod] : undefined;
  const grade = o.lrtGrade ? LRT_GRADE_DE[o.lrtGrade] : undefined;
  return {
    biotopeId: o.biotopeId,
    nameDe: o.biotopeName,
    protectedDe: isProtected
      ? `im Biotopkataster als „${o.protectionText ?? "geschützter Biotop"}“ erfasst (§ 30 BNatSchG i. V. m. § 18 BbgNatSchAG)`
      : null,
    lrtDe: o.lrtCode ? `FFH-Lebensraumtyp ${o.lrtCode}${o.lrtName ? ` ${o.lrtName}` : ""}` : null,
    gradeDe: o.lrtCode && grade ? `Erhaltungsgrad ${grade} (${o.lrtGrade})` : null,
    extentDe,
    mappedDe: [year ? `kartiert ${year}` : null, method ?? null].filter(Boolean).join(", "),
    aerialOnly: o.mappingMethod === "A" || o.mappingMethod === "A2",
    sourceId: o.sourceId,
  };
}

/** The facts for one cell: protected biotopes first, then habitat types, then by extent. */
export function habitatFacts(overlaps: readonly HabitatOverlap[]): HabitatFact[] {
  const rank = (o: HabitatOverlap) => (o.protectionCode && PROTECTED_CODES.has(o.protectionCode) ? 0 : o.lrtCode ? 1 : 2);
  const extent = (o: HabitatOverlap) => o.share ?? (o.lengthM ?? 0) / 10_000;
  return overlaps
    .filter(isShown)
    .sort((a, b) => rank(a) - rank(b) || extent(b) - extent(a) || a.biotopeName.localeCompare(b.biotopeName, "de"))
    .map(factFor);
}

export interface HabitatSummary {
  readonly biotopes: number;
  readonly protectedBiotopes: number;
  readonly habitatTypes: number;
}

export function summariseHabitat(facts: readonly HabitatFact[]): HabitatSummary {
  return {
    biotopes: facts.length,
    protectedBiotopes: facts.filter((f) => f.protectedDe !== null).length,
    habitatTypes: facts.filter((f) => f.lrtDe !== null).length,
  };
}

/** One line for compact surfaces: "3 Biotope erfasst, davon 1 geschützt, 2 FFH-Lebensraumtypen". */
export function habitatSummaryDe(summary: HabitatSummary): string {
  if (summary.biotopes === 0) return "Im Biotopkataster kein Biotop erfasst (Kataster außerhalb von FFH- und Großschutzgebieten selektiv)";
  const parts = [`${summary.biotopes} Biotop${summary.biotopes === 1 ? "" : "e"} im Biotopkataster erfasst`];
  if (summary.protectedBiotopes > 0) parts.push(`${summary.protectedBiotopes} davon als geschützt`);
  if (summary.habitatTypes > 0) parts.push(`${summary.habitatTypes} mit FFH-Lebensraumtyp`);
  return parts.join(", ");
}
