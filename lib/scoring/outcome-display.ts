// How an outcome reads on the comparison screen: which rows appear, in which
// order, and what each cell says. Pure, so the three states (ADR-0008 §3), the
// range rule (§2) and the rounding (design-language.md §8, "no false
// precision") are tested once rather than trusted in a page.
//
// Rules this module enforces:
//  - Every dimension appears, every scenario appears; a missing row is
//    "noch nicht modelliert", never an empty cell and never zero.
//  - A cited method's rows replace the illustrative placeholder of the same
//    dimension: the placeholder was only ever standing in for them.
//  - A value with a range shows the range; the central value is secondary.
//  - A delta between values that carry ranges is the delta of their central
//    values, and says so ("Δ der Mittelwerte") — the owner's decision of
//    2026-09-25, recorded in design-language.md §8.

import { CITED_OUTCOME_METHODS } from "./nature";
import type { OutcomeMetricInfo } from "./nature/method";
import { computeOutcomeDelta } from "./outcomes";
import { OUTCOME_DIMENSIONS, SCENARIOS } from "./types";
import type { Confidence, OutcomeDimension, OutcomeRow, Scenario } from "./types";

export const DIMENSION_LABEL_DE: Record<OutcomeDimension, string> = {
  energy: "Energie",
  climate: "Klima",
  nature_capital: "Naturkapital",
  soil_water: "Boden & Wasser",
  land_use: "Flächennutzung",
  local_benefit: "Regionaler Nutzen",
};

const CITED_BY_VERSION = new Map(CITED_OUTCOME_METHODS.map((c) => [c.method.methodVersion, c.method]));

/** Every method version the comparison screen reads: the illustrative placeholder and each cited method. */
export function comparisonMethodVersions(illustrativeVersion: string): string[] {
  return [illustrativeVersion, ...CITED_BY_VERSION.keys()];
}

// Units whose source resolves no better than whole units (format-value.ts).
const WHOLE_UNITS = new Set(["t C/ha", "mm/a", "%nFK"]);
// Tier 1 default factors: two significant figures are already generous.
const TWO_SIGNIFICANT_UNITS = new Set(["t CO₂-Äq./ha·a"]);

const INTEGER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const TWO_SIGNIFICANT = new Intl.NumberFormat("de-DE", { maximumSignificantDigits: 2 });
const UP_TO_ONE_DECIMAL = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** A number as the screen writes it for this unit, with a typographic minus and no "−0". */
export function formatOutcomeNumber(value: number, unit: string | null): string {
  const format = unit && WHOLE_UNITS.has(unit) ? INTEGER : unit && TWO_SIGNIFICANT_UNITS.has(unit) ? TWO_SIGNIFICANT : UP_TO_ONE_DECIMAL;
  const text = format.format(value).replace("-", "−");
  return /^−0([,.]0*)?$/.test(text) ? text.slice(1) : text;
}

export function formatOutcomeUnit(unit: string | null): string {
  if (unit === null) return "";
  return unit === "%nFK" ? "% nFK" : unit;
}

function withUnit(number: string, unit: string | null): string {
  const u = formatOutcomeUnit(unit);
  return u ? `${number} ${u}` : number;
}

function signed(value: number, unit: string | null): string {
  const text = formatOutcomeNumber(value, unit);
  if (text === "0") return "±0";
  return text.startsWith("−") ? text : `+${text}`;
}

export type OutcomeCell =
  | { readonly kind: "not_modelled" }
  | { readonly kind: "not_applicable"; readonly reasonDe: string | null }
  | {
      readonly kind: "value";
      /** The range with its unit when there is one, otherwise the value with its unit. */
      readonly valueText: string;
      /** "Mittel …" when the value carries a range; null otherwise. */
      readonly centralText: string | null;
      readonly confidence: Confidence;
      /** The change against the status quo, or null for the status quo itself and when there is none. */
      readonly deltaText: string | null;
    };

/** One cell of the comparison table. */
export function describeOutcomeCell(
  outcome: OutcomeRow | undefined,
  baseline: OutcomeRow | undefined,
  metricInfo?: OutcomeMetricInfo,
): OutcomeCell {
  if (!outcome || outcome.status === "not_modelled") return { kind: "not_modelled" };
  if (outcome.status === "not_applicable") return { kind: "not_applicable", reasonDe: metricInfo?.notApplicableDe ?? null };

  const value = outcome.value!;
  const { unit } = outcome;
  const hasRange = outcome.valueLow !== null && outcome.valueHigh !== null;
  const low = hasRange ? formatOutcomeNumber(outcome.valueLow!, unit) : null;
  const high = hasRange ? formatOutcomeNumber(outcome.valueHigh!, unit) : null;
  const showRange = hasRange && low !== high;

  let deltaText: string | null = null;
  if (baseline && outcome.scenario !== "status_quo") {
    const delta = computeOutcomeDelta(outcome, baseline);
    if (delta) {
      const baselineHasRange = baseline.valueLow !== null && baseline.valueHigh !== null;
      const label = hasRange || baselineHasRange ? "Δ der Mittelwerte" : "Δ";
      deltaText = `${label} ${signed(delta.delta, unit)}`;
    }
  }

  return {
    kind: "value",
    valueText: showRange ? withUnit(`${low} bis ${high}`, unit) : withUnit(formatOutcomeNumber(value, unit), unit),
    centralText: showRange ? `Mittel ${formatOutcomeNumber(value, unit)}` : null,
    // A modelled row always has one (0002_domain_schema.sql, outcome CHECK).
    confidence: outcome.confidence!,
    deltaText,
  };
}

export interface ComparisonLine {
  readonly dimension: OutcomeDimension;
  readonly metric: string;
  /** The metric's name under a cited method; null for an illustrative or empty dimension. */
  readonly metricLabelDe: string | null;
  /** The cited method this line comes from, or null. */
  readonly methodVersion: string | null;
  readonly cells: Readonly<Record<Scenario, OutcomeCell>>;
}

/**
 * The comparison table's rows, dimension by dimension in the product's
 * order, metric by metric in each method's own order.
 */
export function buildComparisonLines(outcomes: readonly OutcomeRow[]): ComparisonLine[] {
  const lines: ComparisonLine[] = [];
  const cellsFor = (rows: readonly OutcomeRow[], info?: OutcomeMetricInfo) => {
    const byScenario = new Map(rows.map((r) => [r.scenario, r]));
    const baseline = byScenario.get("status_quo");
    return Object.fromEntries(
      SCENARIOS.map((s) => [s, describeOutcomeCell(byScenario.get(s), baseline, info)]),
    ) as Record<Scenario, OutcomeCell>;
  };

  for (const dimension of OUTCOME_DIMENSIONS) {
    const inDimension = outcomes.filter((o) => o.dimension === dimension);
    const cited = inDimension.filter((o) => CITED_BY_VERSION.has(o.methodVersion));

    if (cited.length > 0) {
      for (const methodVersion of new Set(cited.map((o) => o.methodVersion))) {
        const method = CITED_BY_VERSION.get(methodVersion)!;
        for (const info of method.metrics) {
          const rows = cited.filter((o) => o.methodVersion === methodVersion && o.metric === info.metric);
          if (rows.length === 0) continue;
          lines.push({ dimension, metric: info.metric, metricLabelDe: info.labelDe, methodVersion, cells: cellsFor(rows, info) });
        }
      }
      continue;
    }

    // Illustrative placeholder (metric = dimension) or nothing at all: one line.
    lines.push({ dimension, metric: dimension, metricLabelDe: null, methodVersion: null, cells: cellsFor(inDimension) });
  }
  return lines;
}
