// A group of cells summarised as one site (roadmap Step 5; decision memo
// docs/domain/decision-memo-finding-land.md). Pure: the page reads the rows,
// this module adds them up — and says over how many cells it did.
//
// Rules this module enforces:
//  - A per-hectare quantity (t C/ha, t CO₂-Äq./ha·a, MWh/ha·a, MWp/ha) is
//    summed over the cells' areas into a site total (t C, t CO₂-Äq./a, MWh/a,
//    MWp). A state of the land (mm/a, %nFK) is averaged over the cells' areas.
//    Which is which is declared per metric by its method (siteAggregation).
//  - A total covers only the cells the method modelled, and the screen says how
//    many those are. Cells where the method finds nothing to measure are
//    counted, never added as zero; cells it does not cover are counted too.
//  - A range is summed bound by bound (the cells' ranges are not independent:
//    one factor's uncertainty applies to every cell alike), so relative to its
//    total the site range stays as wide as the cells' ranges — summing does
//    not make it narrower.
//  - A delta against the status quo is given only when both totals cover the
//    same cells; otherwise two totals over different land would be subtracted.

import type { OutcomeMetricInfo } from "./nature/method";
import { formatOutcomeNumber, formatOutcomeUnit } from "./outcome-display";
import type { Confidence, OutcomeRow, SuitabilityVerdictLabel, Technology } from "./types";

const TOTAL_UNIT: Readonly<Record<string, string>> = {
  "t C/ha": "t C",
  "t CO₂-Äq./ha·a": "t CO₂-Äq./a",
  "MWh/ha·a": "MWh/a",
  "MWp/ha": "MWp",
};

/** The unit of a per-hectare quantity once it is summed over hectares. Unknown units are an error, never guessed. */
export function siteTotalUnit(unit: string): string {
  const total = TOTAL_UNIT[unit];
  if (!total) throw new Error(`no site-total unit for "${unit}" — declare it before summing`);
  return total;
}

const CONFIDENCE_ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export interface SiteTotal {
  readonly kind: "value" | "not_modelled" | "not_applicable";
  readonly value: number | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly unit: string | null;
  /** The lowest confidence among the cells summed. */
  readonly confidence: Confidence | null;
  readonly modelledCells: number;
  readonly notApplicableCells: number;
  readonly notModelledCells: number;
  readonly totalCells: number;
  /** Area of the modelled cells, ha. */
  readonly modelledAreaHa: number;
  /** The modelled cells, sorted — two totals are comparable only over the same cells. */
  readonly modelledIds: readonly string[];
}

/**
 * One metric under one scenario, over every cell of the site. `rows` are that
 * metric's rows for the scenario (at most one per cell); `areaHa` holds every
 * cell of the site, so a cell without a row counts as not modelled.
 */
export function aggregateSiteMetric(
  rows: readonly OutcomeRow[],
  areaHa: ReadonlyMap<string, number>,
  aggregation: OutcomeMetricInfo["siteAggregation"],
): SiteTotal {
  const byUnit = new Map(rows.map((r) => [r.spatialUnitId, r]));
  let modelled = 0;
  let notApplicable = 0;
  let value = 0;
  let low = 0;
  let high = 0;
  let hasRange = false;
  let area = 0;
  let unit: string | null = null;
  let confidence: Confidence | null = null;
  const modelledIds: string[] = [];

  for (const [id, ha] of areaHa) {
    const row = byUnit.get(id);
    if (!row || row.status === "not_modelled") continue;
    if (row.status === "not_applicable") {
      notApplicable += 1;
      continue;
    }
    if (unit !== null && row.unit !== unit) throw new Error(`mixed units in one metric: ${unit} and ${row.unit}`);
    unit = row.unit;
    modelled += 1;
    modelledIds.push(id);
    area += ha;
    const v = row.value!;
    const rowHasRange = row.valueLow !== null && row.valueHigh !== null;
    hasRange ||= rowHasRange;
    value += v * ha;
    low += (rowHasRange ? row.valueLow! : v) * ha;
    high += (rowHasRange ? row.valueHigh! : v) * ha;
    if (row.confidence && (confidence === null || CONFIDENCE_ORDER[row.confidence] < CONFIDENCE_ORDER[confidence])) {
      confidence = row.confidence;
    }
  }

  const totalCells = areaHa.size;
  const counts = {
    modelledCells: modelled,
    notApplicableCells: notApplicable,
    notModelledCells: totalCells - modelled - notApplicable,
    totalCells,
    modelledAreaHa: area,
    modelledIds: modelledIds.sort(),
  };
  if (modelled === 0) {
    const kind = notApplicable > 0 && notApplicable === totalCells ? "not_applicable" : "not_modelled";
    return { kind, value: null, low: null, high: null, unit: null, confidence: null, ...counts };
  }
  if (aggregation === "sum_per_ha") {
    return {
      kind: "value",
      value,
      low: hasRange ? low : null,
      high: hasRange ? high : null,
      unit: siteTotalUnit(unit!),
      confidence,
      ...counts,
    };
  }
  return {
    kind: "value",
    value: value / area,
    low: hasRange ? low / area : null,
    high: hasRange ? high / area : null,
    unit,
    confidence,
    ...counts,
  };
}

const COUNT = new Intl.NumberFormat("de-DE");

export interface SiteCell {
  readonly kind: SiteTotal["kind"];
  readonly valueText: string | null;
  readonly centralText: string | null;
  readonly confidence: Confidence | null;
  readonly deltaText: string | null;
  /** Over which cells the number was formed, and why the others are left out. */
  readonly coverageDe: string;
}

function withUnit(text: string, unit: string | null): string {
  const u = formatOutcomeUnit(unit);
  return u ? `${text} ${u}` : text;
}

/** The words for one site total, with its delta against `baseline` when both cover the same cells. */
export function describeSiteTotal(total: SiteTotal, baseline: SiteTotal | null, notApplicableDe: string | null): SiteCell {
  const parts: string[] = [];
  if (total.kind === "value") {
    parts.push(
      total.modelledCells === total.totalCells
        ? `alle ${COUNT.format(total.totalCells)} Zellen`
        : `${COUNT.format(total.modelledCells)} von ${COUNT.format(total.totalCells)} Zellen`,
    );
  }
  // The reason is named once, where every cell shares it; mixed reasons stay with the single cells.
  if (total.notApplicableCells > 0 && total.notApplicableCells < total.totalCells) {
    parts.push(`${COUNT.format(total.notApplicableCells)} trifft nicht zu`);
  }
  if (total.notModelledCells > 0 && total.notModelledCells < total.totalCells) {
    parts.push(`${COUNT.format(total.notModelledCells)} nicht modelliert`);
  }
  if (total.kind === "not_applicable" && notApplicableDe) parts.push(notApplicableDe);
  const coverageDe = parts.join(" · ");

  if (total.kind !== "value") {
    return { kind: total.kind, valueText: null, centralText: null, confidence: null, deltaText: null, coverageDe };
  }
  const { unit } = total;
  const hasRange = total.low !== null && total.high !== null;
  const lowText = hasRange ? formatOutcomeNumber(total.low!, unit) : null;
  const highText = hasRange ? formatOutcomeNumber(total.high!, unit) : null;
  const showRange = hasRange && lowText !== highText;

  let deltaText: string | null = null;
  if (
    baseline &&
    baseline.kind === "value" &&
    baseline.unit === total.unit &&
    baseline.modelledIds.length === total.modelledIds.length &&
    baseline.modelledIds.every((id, i) => id === total.modelledIds[i])
  ) {
    const d = total.value! - baseline.value!;
    const text = formatOutcomeNumber(d, unit);
    const signed = text === "0" ? "±0" : text.startsWith("−") ? text : `+${text}`;
    const label = hasRange || (baseline.low !== null && baseline.high !== null) ? "Δ der Mittelwerte" : "Δ";
    deltaText = `${label} ${signed}`;
  }

  return {
    kind: "value",
    valueText: showRange ? withUnit(`${lowText} bis ${highText}`, unit) : withUnit(formatOutcomeNumber(total.value!, unit), unit),
    centralText: showRange ? `Mittel ${formatOutcomeNumber(total.value!, unit)}` : null,
    confidence: total.confidence,
    deltaText,
    coverageDe,
  };
}

/** Cells per verdict class for one technology; a cell without a verdict counts as `unscored`. */
export function countClasses(
  verdicts: readonly { spatialUnitId: string; technology: Technology; verdict: SuitabilityVerdictLabel }[],
  technology: Technology,
  cellIds: readonly string[],
): Map<SuitabilityVerdictLabel | "unscored", number> {
  const byUnit = new Map(verdicts.filter((v) => v.technology === technology).map((v) => [v.spatialUnitId, v.verdict]));
  const counts = new Map<SuitabilityVerdictLabel | "unscored", number>();
  for (const id of cellIds) {
    const label = byUnit.get(id) ?? "unscored";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}
