// What the 3D parcel preview (ADR-0006) draws, and on what authority.
//
// Two kinds of number live here, and the distinction is the whole point of
// the file:
//
// 1. **Illustrative reference dimensions** — hub height, rotor diameter, row
//    pitch, module-table depth, clearance. They describe *a* plausible
//    installation so the preview has something true-to-scale to draw. They
//    are not a turbine type, not a layout plan, and not sourced; every one
//    carries `basis: "illustrative"` and the interface says so beside it.
//    CLAUDE.md §5 forbids stating them as facts, so they are never phrased
//    as "a turbine here would be…".
//
// 2. **Cited distances** — the setback rings. Each carries its legal source,
//    the exact wording it rests on, how it is measured, and where it does
//    *not* apply. A ring without its limits would read as a permission
//    statement, which sela never makes (CLAUDE.md §5, "advisory, not
//    authoritative").
//
// Nothing here feeds lib/scoring/. The preview visualises physical scale; it
// does not change, and must not be read as, a suitability verdict.

export type Basis = "illustrative" | "cited";

export interface ReferenceDimension {
  readonly id: string;
  readonly labelDe: string;
  readonly value: number;
  readonly unit: "m" | "°";
  readonly basis: "illustrative";
}

/** A reference turbine — deliberately not any manufacturer's model. */
export const REFERENCE_TURBINE = {
  hubHeight: { id: "hub_height", labelDe: "Nabenhöhe", value: 160, unit: "m", basis: "illustrative" },
  rotorDiameter: { id: "rotor_diameter", labelDe: "Rotordurchmesser", value: 160, unit: "m", basis: "illustrative" },
} as const satisfies Record<string, ReferenceDimension>;

/** Bounds for the interactive sliders — wide enough to cover older and newer turbine classes. */
export const TURBINE_SLIDER_BOUNDS = {
  hubHeight: { min: 80, max: 200, step: 5 },
  rotorDiameter: { min: 80, max: 180, step: 5 },
} as const;

/** "Höhe im Sinne des Satzes 1 ist die Nabenhöhe zuzüglich Radius des Rotors." — § 249 Abs. 10 S. 2 BauGB. */
export function totalHeightM(hubHeightM: number, rotorDiameterM: number): number {
  return hubHeightM + rotorDiameterM / 2;
}

export interface RowLayout {
  /** Centre-to-centre distance between rows, north–south. */
  readonly rowPitch: ReferenceDimension;
  /** Depth of one module table, measured along its slope. */
  readonly tableDepth: ReferenceDimension;
  readonly tilt: ReferenceDimension;
  /** Height of the table's lower edge above ground. */
  readonly lowerEdge: ReferenceDimension;
  /** Distance kept free along the unit's boundary. */
  readonly inset: ReferenceDimension;
  /** Spacing of supports along a row (drawn only where supports are visible). */
  readonly postSpacing: ReferenceDimension;
}

export const PV_LAYOUT: RowLayout = {
  rowPitch: { id: "row_pitch", labelDe: "Reihenabstand", value: 10, unit: "m", basis: "illustrative" },
  tableDepth: { id: "table_depth", labelDe: "Modultischtiefe", value: 4.5, unit: "m", basis: "illustrative" },
  tilt: { id: "tilt", labelDe: "Neigung", value: 20, unit: "°", basis: "illustrative" },
  lowerEdge: { id: "lower_edge", labelDe: "Unterkante über Grund", value: 0.8, unit: "m", basis: "illustrative" },
  inset: { id: "inset", labelDe: "Randabstand", value: 5, unit: "m", basis: "illustrative" },
  postSpacing: { id: "post_spacing", labelDe: "Stützenabstand", value: 10, unit: "m", basis: "illustrative" },
};

/** Overhead (hochaufgeständert) agrivoltaics: machinery passes underneath, so rows are wider apart and raised. */
export const AGRIPV_LAYOUT: RowLayout = {
  rowPitch: { id: "row_pitch", labelDe: "Reihenabstand", value: 14, unit: "m", basis: "illustrative" },
  tableDepth: { id: "table_depth", labelDe: "Modultischtiefe", value: 4.5, unit: "m", basis: "illustrative" },
  tilt: { id: "tilt", labelDe: "Neigung", value: 20, unit: "°", basis: "illustrative" },
  lowerEdge: { id: "lower_edge", labelDe: "Lichte Höhe", value: 4.5, unit: "m", basis: "illustrative" },
  inset: { id: "inset", labelDe: "Randabstand", value: 5, unit: "m", basis: "illustrative" },
  postSpacing: { id: "post_spacing", labelDe: "Stützenabstand", value: 10, unit: "m", basis: "illustrative" },
};

export interface SetbackRing {
  readonly id: string;
  /** Short name drawn on the map beside the ring, before its distance. */
  readonly shortLabelDe: string;
  readonly citationDe: string;
  /** The rule's own words, quoted — so the ring can be checked against its source. */
  readonly quoteDe: string;
  readonly measuredFromDe: string;
  /** Where the ring does *not* hold. Always rendered with the ring. */
  readonly limitsDe: string;
  readonly sourceUrl: string;
  /** Ring radius for a given reference turbine. */
  readonly radiusM: (hubHeightM: number, rotorDiameterM: number) => number;
  /** Jurisdiction the rule belongs to — drawn only for units in it. */
  readonly jurisdiction: "DE" | "DE-BB";
  readonly verifiedOn: string;
  /**
   * How the quote was checked. `official_text`: read verbatim at the official
   * source. `secondary`: the official page could not be read directly, so the
   * wording came second-hand — the interface says so beside the quote
   * (docs/data/sources.md §6, 2026-09-23).
   */
  readonly verification: "official_text" | "secondary";
}

export const SETBACK_RINGS: readonly SetbackRing[] = [
  {
    id: "baugb_249_10",
    shortLabelDe: "2 H",
    citationDe: "§ 249 Abs. 10 BauGB",
    quoteDe:
      "Der öffentliche Belang einer optisch bedrängenden Wirkung steht einem Vorhaben nach § 35 Absatz 1 Nummer 5 […] in der Regel nicht entgegen, wenn der Abstand von der Mitte des Mastfußes der Windenergieanlage bis zu einer zulässigen baulichen Nutzung zu Wohnzwecken mindestens der zweifachen Höhe der Windenergieanlage entspricht. Höhe im Sinne des Satzes 1 ist die Nabenhöhe zuzüglich Radius des Rotors.",
    measuredFromDe: "Mitte des Mastfußes",
    limitsDe:
      "Eine Regelvermutung zur optisch bedrängenden Wirkung – kein Mindestabstand und keine Aussage über andere öffentliche Belange (Schall, Schattenwurf, Naturschutz).",
    sourceUrl: "https://www.gesetze-im-internet.de/bbaug/__249.html",
    radiusM: (hub, rotor) => 2 * totalHeightM(hub, rotor),
    jurisdiction: "DE",
    verifiedOn: "2026-09-23",
    verification: "official_text",
  },
  {
    id: "bbgweaabg_1",
    shortLabelDe: "Mindestabstand",
    citationDe: "§ 1 BbgWEAAbG",
    quoteDe:
      "einen Mindestabstand von 1 000 Metern zu zulässigerweise errichteten Wohngebäuden […] von der Mitte des Mastfußes bis zur nächstgelegenen Gebäudekante",
    measuredFromDe: "Mitte des Mastfußes bis zur nächstgelegenen Gebäudekante",
    limitsDe:
      "Gilt nur in Brandenburg, nur gegenüber Wohngebäuden in Bebauungsplangebieten oder im Zusammenhang bebauten Ortsteilen, und nicht in ausgewiesenen Windenergiegebieten.",
    sourceUrl: "https://bravors.brandenburg.de/gesetze/bbgweaabg",
    radiusM: () => 1000,
    jurisdiction: "DE-BB",
    verifiedOn: "2026-09-23",
    // bravors.brandenburg.de failed TLS verification from the environment that wrote this.
    verification: "secondary",
  },
];

/** Eye height used for the ground-level viewpoint. Illustrative, like the turbine. */
export const EYE_HEIGHT_M = 1.7;
