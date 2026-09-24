// peat-climate-ipcc2013-v1 — docs/domain/scoring-criteria.md §4.1.
//
// Two metrics in every scenario (decision D6): the carbon stock of the cell's
// peat (LBGR Moorbodenkarte 2021) and the annual greenhouse-gas balance of its
// peat share under the scenario's water regime (IPCC 2013 Wetlands Supplement,
// Tier 1). Pure arithmetic over criterion values that SQL has already sampled
// (ADR-0002); every factor below was read at the primary source, with its
// table and printed page.

import type { OutcomeResult } from "../outcomes";
import type { CriterionValue, Scenario } from "../types";
import type { CitedFactor, OutcomeMethod, Span } from "./method";
import { addSpans, factorSpan, scaleSpan } from "./method";

export const PEAT_CLIMATE_METHOD_VERSION = "peat-climate-ipcc2013-v1";

const CH2 = "IPCC 2013 Wetlands Supplement, Ch. 2";
const CH3 = "IPCC 2013 Wetlands Supplement, Ch. 3";

/** IPCC AR5 WG1 Table 8.7 (p. 714), without climate–carbon feedbacks — the values the German inventory uses (NID 2025, p. 497). */
export const GWP100_CH4 = 28;
export const GWP100_N2O = 265;
/** Molar-mass conversions: C → CO₂, CH₄-C → CH₄, N₂O-N → N₂O. */
const C_TO_CO2 = 44 / 12;
const CH4C_TO_CH4 = 16 / 12;
const N2ON_TO_N2O = 44 / 28;

type DrainedCategory = "cropland" | "grassland_shallow" | "grassland_deep";

interface DrainedFactors {
  readonly co2: CitedFactor; // t CO₂-C/ha·a, on site
  readonly ch4Land: CitedFactor; // kg CH₄/ha·a
  readonly ch4Ditch: CitedFactor; // kg CH₄/ha·a
  readonly fracDitch: number;
  readonly n2o: CitedFactor; // kg N₂O-N/ha·a
}

const DOC_DRAINED: CitedFactor = {
  value: 0.31, low: 0.19, high: 0.46, unit: "t C/ha·a",
  citation: `${CH2}, Table 2.2 (EF_DOC_DRAINED, temperate), p. 2.20`,
};

export const DRAINED: Readonly<Record<DrainedCategory, DrainedFactors>> = {
  cropland: {
    co2: { value: 7.9, low: 6.5, high: 9.4, unit: "t CO₂-C/ha·a", citation: `${CH2}, Table 2.1 (Cropland, drained; boreal and temperate), p. 2.12` },
    ch4Land: { value: 0, low: -2.8, high: 2.8, unit: "kg CH₄/ha·a", citation: `${CH2}, Table 2.3 (Cropland, drained), p. 2.25` },
    ch4Ditch: { value: 1165, low: 335, high: 1995, unit: "kg CH₄/ha·a", citation: `${CH2}, Table 2.4 (Deep-drained Grassland / Cropland), p. 2.30` },
    fracDitch: 0.05,
    n2o: { value: 13, low: 8.2, high: 18, unit: "kg N₂O-N/ha·a", citation: `${CH2}, Table 2.5 (Cropland, drained), p. 2.33` },
  },
  grassland_shallow: {
    co2: { value: 3.6, low: 1.8, high: 5.4, unit: "t CO₂-C/ha·a", citation: `${CH2}, Table 2.1 (Grassland, shallow-drained, nutrient-rich; temperate), p. 2.14` },
    ch4Land: { value: 39, low: -2.9, high: 81, unit: "kg CH₄/ha·a", citation: `${CH2}, Table 2.3 (Grassland, shallow-drained, nutrient-rich), p. 2.26` },
    ch4Ditch: { value: 527, low: 285, high: 769, unit: "kg CH₄/ha·a", citation: `${CH2}, Table 2.4 (Shallow-drained Grassland), p. 2.30` },
    fracDitch: 0.05,
    n2o: { value: 1.6, low: 0.56, high: 2.7, unit: "kg N₂O-N/ha·a", citation: `${CH2}, Table 2.5 (Grassland, shallow-drained, nutrient-rich), p. 2.34` },
  },
  grassland_deep: {
    co2: { value: 6.1, low: 5.0, high: 7.3, unit: "t CO₂-C/ha·a", citation: `${CH2}, Table 2.1 (Grassland, deep-drained, nutrient-rich; temperate), p. 2.13` },
    ch4Land: { value: 16, low: 2.4, high: 29, unit: "kg CH₄/ha·a", citation: `${CH2}, Table 2.3 (Grassland, deep-drained, nutrient-rich), p. 2.26` },
    ch4Ditch: { value: 1165, low: 335, high: 1995, unit: "kg CH₄/ha·a", citation: `${CH2}, Table 2.4 (Deep-drained Grassland / Cropland), p. 2.30` },
    fracDitch: 0.05,
    n2o: { value: 8.2, low: 4.9, high: 11, unit: "kg N₂O-N/ha·a", citation: `${CH2}, Table 2.5 (Grassland, deep-drained, nutrient-rich), p. 2.34` },
  },
};

/** Rewetted, nutrient-rich, temperate. Tier 1 has no ditch term: former ditches count as part of the rewetted site (Ch. 3, p. 3.5). N₂O is negligible under Tier 1 (p. 3.19). */
export const REWETTED = {
  co2: { value: 0.5, low: -0.71, high: 1.71, unit: "t CO₂-C/ha·a", citation: `${CH3}, Table 3.1 (temperate, rich), p. 3.12` },
  doc: { value: 0.24, low: 0.14, high: 0.36, unit: "t CO₂-C/ha·a", citation: `${CH3}, Table 3.2 (temperate), p. 3.14` },
  ch4: { value: 216, low: 0, high: 856, unit: "kg CH₄-C/ha·a", citation: `${CH3}, Table 3.3 (temperate, rich), p. 3.18` },
} as const satisfies Record<string, CitedFactor>;

const T_PER_KG = 1 / 1000;

/**
 * Drained balance per hectare of peat, t CO₂-Äq./ha·a. CH₄ combines land and
 * ditches as Ch. 2 Eq. 2.6 does: (1 − Frac_ditch)·EF_land + Frac_ditch·EF_ditch.
 * Each factor's 95 % interval is carried by adding bounds (§4.1 proposal —
 * it overstates the spread rather than understating it).
 */
export function drainedBalance(category: DrainedCategory): Span {
  const f = DRAINED[category];
  const ch4 = addSpans(
    scaleSpan(factorSpan(f.ch4Land), 1 - f.fracDitch),
    scaleSpan(factorSpan(f.ch4Ditch), f.fracDitch),
  );
  return addSpans(
    scaleSpan(factorSpan(f.co2), C_TO_CO2),
    scaleSpan(factorSpan(DOC_DRAINED), C_TO_CO2),
    scaleSpan(ch4, GWP100_CH4 * T_PER_KG),
    scaleSpan(factorSpan(f.n2o), N2ON_TO_N2O * GWP100_N2O * T_PER_KG),
  );
}

/** Rewetted balance per hectare of peat, t CO₂-Äq./ha·a. */
export function rewettedBalance(): Span {
  return addSpans(
    scaleSpan(factorSpan(REWETTED.co2), C_TO_CO2),
    scaleSpan(factorSpan(REWETTED.doc), C_TO_CO2),
    scaleSpan(factorSpan(REWETTED.ch4), CH4C_TO_CH4 * GWP100_CH4 * T_PER_KG),
  );
}

/**
 * Grassland on peat, drainage depth unknown (decision D9): the span from the
 * shallow-drained to the deep-drained central value. The stored value is
 * their midpoint, for sorting and deltas only — never shown alone.
 */
export function grasslandBalance(): Span {
  const shallow = drainedBalance("grassland_shallow").value;
  const deep = drainedBalance("grassland_deep").value;
  return { value: (shallow + deep) / 2, low: Math.min(shallow, deep), high: Math.max(shallow, deep) };
}

export type PeatLandUse = "cropland" | "grassland" | "other";

/** Current use from the dominant CLC5 class (§4.1): 211 → cropland, 231 → grassland, anything else not modelled. */
export function peatLandUseFromClc(clc: number | undefined): PeatLandUse {
  if (clc === 211) return "cropland";
  if (clc === 231) return "grassland";
  return "other";
}

function drainedFor(use: Exclude<PeatLandUse, "other">): Span {
  return use === "cropland" ? drainedBalance("cropland") : grasslandBalance();
}

export const PEAT_CARBON_STOCK = "peat_carbon_stock";
export const PEAT_GHG_BALANCE = "peat_ghg_balance";
export const PEAT_CLIMATE_METRICS = [PEAT_CARBON_STOCK, PEAT_GHG_BALANCE] as const;
const STOCK_UNIT = "t C/ha";
const BALANCE_UNIT = "t CO₂-Äq./ha·a";

/** The criterion ids this method reads, besides the land cover it shares with PV. */
export const PEAT_CLIMATE_CRITERIA = ["peat_share", "peat_organic_unassessed_share", "peat_carbon_stock", "pv_land_cover"] as const;

export interface MetricOutcome {
  readonly metric: string;
  readonly result: OutcomeResult;
  /** The criterion values this outcome was computed from — outcome_input (ADR-0008). */
  readonly inputs: readonly CriterionValue[];
}

const IS_DEVELOP = (s: Scenario) => s.startsWith("develop_");

function spanResult(span: Span, unit: string, confidence: "low" | "medium"): OutcomeResult {
  return { value: span.value, low: span.low, high: span.high, unit, confidence };
}

/**
 * Both metrics for one unit and scenario. `values` are the unit's criterion
 * values; a missing one is "not checked", never zero.
 */
export function peatClimateOutcomes(scenario: Scenario, values: readonly CriterionValue[]): MetricOutcome[] {
  const byId = new Map(values.map((v) => [v.criterionId, v]));
  const peatShare = byId.get("peat_share");
  const organic = byId.get("peat_organic_unassessed_share");
  const stock = byId.get("peat_carbon_stock");
  const landCover = byId.get("pv_land_cover");

  if (IS_DEVELOP(scenario)) {
    // Construction on peat is a later gate (ADR-0008, Consequences).
    return PEAT_CLIMATE_METRICS.map((metric) => ({ metric, result: null, inputs: [] }));
  }

  // The map was checked here and holds no peat and no organic-rich soil.
  const noPeatAtAll = peatShare !== undefined && peatShare.value === 0 && organic !== undefined && organic.value === 0;

  const stockOutcome: MetricOutcome = stock
    ? {
        metric: PEAT_CARBON_STOCK,
        // The same stock in every scenario: it shows what is at stake; the
        // balance shows whether it is kept. Confidence is capped at medium
        // until LBGR's method for the stock is read (V4).
        result: { value: stock.value, unit: STOCK_UNIT, confidence: "medium" },
        inputs: [stock],
      }
    : {
        metric: PEAT_CARBON_STOCK,
        result: noPeatAtAll ? "not_applicable" : null,
        inputs: [peatShare, organic].filter((v): v is CriterionValue => v !== undefined),
      };

  let balance: OutcomeResult;
  let balanceInputs: CriterionValue[] = [peatShare, organic].filter((v): v is CriterionValue => v !== undefined);
  if (peatShare === undefined) {
    balance = null;
  } else if (peatShare.value === 0) {
    // No peat body: nothing to drain or rewet, unless organic-rich soils the
    // method does not cover are present — then "not modelled", not "does not apply".
    balance = organic !== undefined && organic.value === 0 ? "not_applicable" : null;
  } else {
    const use = peatLandUseFromClc(landCover ? Math.round(landCover.value) : undefined);
    if (landCover) balanceInputs = [...balanceInputs, landCover];
    if (use === "other") {
      balance = null;
    } else {
      const perHaPeat = scenario === "restore" ? rewettedBalance() : drainedFor(use);
      // Confidence low everywhere: a Tier 1 default applied to a cell, land
      // use from 2018, drainage state unknown (§4.1).
      balance = spanResult(scaleSpan(perHaPeat, peatShare.value), BALANCE_UNIT, "low");
    }
  }

  return [stockOutcome, { metric: PEAT_GHG_BALANCE, result: balance, inputs: balanceInputs }];
}

export const PEAT_CLIMATE_METHOD: OutcomeMethod = {
  methodVersion: PEAT_CLIMATE_METHOD_VERSION,
  dimension: "climate",
  nameDe: "Moorböden: Kohlenstoffvorrat und Treibhausgasbilanz",
  nameEn: "Peat soils: carbon stock and greenhouse-gas balance",
  citation:
    "IPCC, 2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands, " +
    "Ch. 2 (Drained Inland Organic Soils) and Ch. 3 (Rewetted Organic Soils), Tier 1; " +
    "GWP100 from IPCC AR5 WG1 Table 8.7; carbon stock and soil classes from LBGR Moorbodenkarte Brandenburg 2021.",
  descriptionDe:
    "Zwei Größen in jedem Szenario: der Kohlenstoffvorrat des Moorbodens (t C/ha, über die ganze Zelle gemittelt) " +
    "und die jährliche Treibhausgasbilanz seines Moorbodenanteils (t CO₂-Äq./ha·a, positiv = Emission). " +
    "Ist-Zustand und Erhalt: Standardfaktoren für entwässerte Moore nach heutiger Nutzung — Schutz allein stoppt " +
    "die Emissionen entwässerter Moore nicht. Wiederherstellung: Standardfaktoren für wiedervernässte, " +
    "nährstoffreiche Moore; der Übergang dorthin ist nicht modelliert. Tier-1-Standardwerte beschreiben keine " +
    "Messung an diesem Ort.",
  parameters: {
    peatClasses: "LBGR bodentyp_2021: KV1–KV3, HN1–HN3, and covered classes whose lower layer is KV (…\\KV*, …/KV*)",
    notModelledClasses: "GH (Moorgley), GM (Anmoorgley), alone or covered, and 'unknown'",
    nutrientStatus: "nutrient-rich (Niedermoore) for every peat class — an assumption, not read per polygon",
    landUseFromClc5: { "211": "Cropland, drained", "231": "Grassland, nutrient-rich, shallow- to deep-drained", other: "not modelled" },
    grasslandRange: "shallow-drained to deep-drained central value; stored value is the midpoint and never shown alone",
    intervals: "95 % intervals of the factors used, combined by adding their bounds",
    scaling: "per hectare of cell: multiplied by the cell's peat share",
    gwp100: { CH4: GWP100_CH4, N2O: GWP100_N2O, citation: "IPCC AR5 WG1 Table 8.7, p. 714 (no climate–carbon feedback); German NID 2025, p. 497" },
    ch4Drained: "Ch. 2 Eq. 2.6: (1 − Frac_ditch)·EF_CH4_land + Frac_ditch·EF_CH4_ditch",
    drained: { doc: DOC_DRAINED, ...DRAINED },
    rewetted: REWETTED,
    carbonStock: "LBGR kohlenstoff_2021, whole kg/m² × 10 = t C/ha; '< 0,5' read as 0.25; depth basis not documented (V4)",
  },
};
