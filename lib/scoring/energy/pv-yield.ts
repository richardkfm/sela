// pv-yield-v1 — roadmap Step 3, docs/domain/decision-memo-energy-outcome.md,
// docs/domain/scoring-criteria.md §4.4.
//
// What is gained under develop_pv: the installed capacity and the annual
// yield of a new ground-mounted PV plant on the cell, from the cell's measured
// irradiation, through the definition of the performance ratio (PR = final
// yield / reference yield, IEA-PVPS T13-28:2024 §2.1.2) and a land-use density
// for new plants. Every factor is read at source and carries its range; the
// range is shown, never the central value alone (ADR-0008 §2).
//
// The method applies only where sela's PV classification (real-pv-v1) does not
// rule the plant out: on an excluded or *nicht vorgesehen* cell a yield would
// contradict the class beside it, so the method finds nothing to measure there
// (not_applicable) — reading the same rules module the classification runs on
// (lib/scoring/pv-rules.ts), so the two cannot disagree. Pure arithmetic
// (ADR-0002) over values SQL has sampled.

import type { CitedFactor, OutcomeMethod } from "../nature/method";
import { factorSpan, type Span } from "../nature/method";
import type { MetricOutcome } from "../nature/peat-climate";
import type { OutcomeResult } from "../outcomes";
import { PROTECTION_EXCLUSION_SHARE, landCoverTier } from "../pv-rules";
import type { CriterionValue, Scenario } from "../types";

export const PV_YIELD_METHOD_VERSION = "pv-yield-v1";

const ISE = "Fraunhofer ISE: Aktuelle Fakten zur Photovoltaik in Deutschland, Fassung vom 20.8.2026";
const ZSW = "ZSW (Kelm, Stauch): Flächeninanspruchnahme von PV-Freiflächenanlagen – Update 2024, 02.06.2025";

/** The three factors, each with the range its sources give (read 2026-09-28). */
export const PV_YIELD_FACTORS = {
  /** Plane-of-array irradiation over global horizontal irradiation, south-facing modules at 20°–25°. */
  transposition: {
    value: 1.15,
    low: 1.137,
    high: 1.157,
    unit: "–",
    citation:
      `${ISE}, S. 37: bei 20°–25° Neigung „erhöht sich die Einstrahlungssumme bezogen auf die Modulebene um ca. 15 %“; ` +
      "Spanne: PVGIS 5.3 (JRC, SARAH3 2005–2023) für 53,1° N 13,9° O, Süd, 20° bzw. 25° Neigung, abgefragt 2026-09-28",
  },
  /** Performance ratio of a plant installed today, annual mean, all losses included. */
  performanceRatio: {
    value: 0.85,
    low: 0.8,
    high: 0.9,
    unit: "–",
    citation: `${ISE}, S. 39: „Eine heute installierte PV-Anlage erreicht PR-Werte von 80 – 90 % im Jahresmittel (typischer Wert)“`,
  },
  /** Plant area per installed capacity of new ground-mounted plants. */
  areaPerCapacity: {
    value: 0.88,
    low: 0.83,
    high: 1.0,
    unit: "ha/MWp",
    citation:
      `${ZSW}, S. 3: „bis 2021 auf 1 ha/MW und in den Folgejahren weiter auf 0,88 ha/MW im Jahr 2024 gesunken“; ` +
      "S. 8: ungeförderte Anlagen „0,83 ha/MW“",
  },
} as const satisfies Record<string, CitedFactor>;

/** Reference irradiance at standard test conditions, kW/m² (IEA-PVPS T13-28:2024 §2.1.2). */
const G_STC = 1;

export const PV_CAPACITY = "pv_installed_capacity";
export const PV_ANNUAL_YIELD = "pv_annual_yield";
const CAPACITY_UNIT = "MWp/ha";
const YIELD_UNIT = "MWh/ha·a";

export const PV_YIELD_CRITERIA = ["pv_irradiation_annual", "pv_land_cover", "pv_protection_status"] as const;

/** Installed capacity per hectare: the reciprocal of the area a megawatt needs. */
export function capacityPerHa(): Span {
  const a = factorSpan(PV_YIELD_FACTORS.areaPerCapacity);
  return { value: 1 / a.value, low: 1 / a.high, high: 1 / a.low };
}

/**
 * Annual yield per hectare, MWh/ha·a, from global horizontal irradiation in
 * kWh/m²·a: GHI × transposition × PR ÷ G_STC gives kWh/kWp·a, which is
 * MWh/MWp·a; divided by ha/MWp it is MWh/ha·a. The range combines the factors'
 * bounds in the direction that widens it.
 */
export function yieldPerHa(ghiKwhPerM2: number): Span {
  const t = factorSpan(PV_YIELD_FACTORS.transposition);
  const pr = factorSpan(PV_YIELD_FACTORS.performanceRatio);
  const a = factorSpan(PV_YIELD_FACTORS.areaPerCapacity);
  const specific = (tf: number, prf: number) => (ghiKwhPerM2 * tf * prf) / G_STC;
  return {
    value: specific(t.value, pr.value) / a.value,
    low: specific(t.low, pr.low) / a.high,
    high: specific(t.high, pr.high) / a.low,
  };
}

function spanResult(span: Span, unit: string): OutcomeResult {
  // Low everywhere: a new plant's typical factors applied to a cell, not a plant design.
  return { value: span.value, low: span.low, high: span.high, unit, confidence: "low" };
}

/** Both metrics for one unit and scenario. A missing input is "not checked": not modelled, never zero. */
export function pvYieldOutcomes(scenario: Scenario, values: readonly CriterionValue[]): MetricOutcome[] {
  const byId = new Map(values.map((v) => [v.criterionId, v]));
  const ghi = byId.get("pv_irradiation_annual");
  const landCover = byId.get("pv_land_cover");
  const protection = byId.get("pv_protection_status");
  const both = (result: OutcomeResult, inputs: CriterionValue[], yieldResult: OutcomeResult = result) => [
    { metric: PV_CAPACITY, result, inputs },
    { metric: PV_ANNUAL_YIELD, result: yieldResult, inputs },
  ];

  // The metric is the output of a *new* ground-mounted plant: scenarios that
  // build none have nothing to measure. Agri-PV and wind build something else,
  // whose density and yield have no cited source yet.
  if (scenario === "status_quo" || scenario === "preserve" || scenario === "restore") return both("not_applicable", []);
  if (scenario !== "develop_pv") return both(null, []);

  if (landCover === undefined || protection === undefined) return both(null, []);
  const deciding = [protection, landCover];
  const ruledOut =
    protection.value >= PROTECTION_EXCLUSION_SHARE || landCoverTier(landCover.value).tier === "nicht_vorgesehen";
  if (ruledOut) return both("not_applicable", deciding);
  if (ghi === undefined) return both(spanResult(capacityPerHa(), CAPACITY_UNIT), deciding, null);

  return [
    { metric: PV_CAPACITY, result: spanResult(capacityPerHa(), CAPACITY_UNIT), inputs: deciding },
    { metric: PV_ANNUAL_YIELD, result: spanResult(yieldPerHa(ghi.value), YIELD_UNIT), inputs: [ghi, ...deciding] },
  ];
}

const NOT_APPLICABLE_BY_SCENARIO_DE = {
  status_quo: "keine neue Anlage in diesem Szenario",
  preserve: "keine neue Anlage in diesem Szenario",
  restore: "keine neue Anlage in diesem Szenario",
  develop_pv: "Freiflächen-PV hier ausgeschlossen oder nicht vorgesehen (siehe Einordnung)",
} as const;

export const PV_YIELD_METHOD: OutcomeMethod = {
  methodVersion: PV_YIELD_METHOD_VERSION,
  dimension: "energy",
  nameDe: "Freiflächen-PV: Leistung und Jahresertrag einer neuen Anlage",
  nameEn: "Ground-mounted PV: capacity and annual yield of a new plant",
  citation:
    `${ISE}, S. 37 und 39; ${ZSW}, S. 3 und 8; IEA-PVPS T13-28:2024, Best practice guidelines for the use of ` +
    "economic and technical KPIs, §2.1.2 (Performance Ratio); Globalstrahlung: DWD, Mittel 2016–2025.",
  descriptionDe:
    "Was eine neue Freiflächen-PV-Anlage auf der Zelle erzeugen würde, je Hektar: installierte Leistung (MWp/ha) " +
    "und Jahresertrag (MWh/ha·a). Jahresertrag = Globalstrahlung × Umrechnung auf die Modulebene × Performance " +
    "Ratio ÷ Flächenbedarf je MWp. Es ist der technische Ertrag einer heute gebauten Anlage im Jahresmittel, vor " +
    "Abregelung bei Netzengpässen oder negativen Preisen; die Netzbetreiber rechnen für Freiflächenanlagen " +
    "mit rund 900 Volllaststunden, also weniger. Gezeigt wird nur, wo Freiflächen-PV nach der Einordnung weder " +
    "ausgeschlossen noch nicht vorgesehen ist, und immer als Spanne. Innerhalb der Uckermark unterscheidet der " +
    "Ertrag die Zellen kaum: Die Globalstrahlung schwankt dort um etwa 3 %, die Spanne der Methode ist viel breiter. " +
    "Keine Aussage über Netzanschluss, Wirtschaftlichkeit oder Genehmigung.",
  parameters: {
    formula:
      "yield [MWh/ha·a] = GHI [kWh/m²·a] × transposition × PR ÷ G_STC (1 kW/m²) ÷ area per capacity [ha/MWp]; " +
      "capacity [MWp/ha] = 1 ÷ area per capacity",
    range: "each factor's published bounds, combined in the direction that widens the range",
    ...PV_YIELD_FACTORS,
    gStc: { value: G_STC, unit: "kW/m²", citation: "IEA-PVPS T13-28:2024, §2.1.2: yields are ratios to values under standard test conditions" },
    appliesWhere:
      `develop_pv only; not applicable where the cell is excluded (≥ ${PROTECTION_EXCLUSION_SHARE * 100} % Naturschutzgebiet/` +
      "Nationalpark) or its land cover is 'nicht vorgesehen' (real-pv-v1)",
    notModelled: "develop_agripv and develop_wind — no cited density or yield; existing plants on the cell are not recorded",
    notIncluded: "curtailment, grid connection, degradation beyond the PR, bifacial modules, trackers",
    curtailmentContext: {
      value: 900,
      unit: "Volllaststunden/a",
      citation:
        "Leipziger Institut für Energie / r2b energy consulting für die Übertragungsnetzbetreiber (Auftraggeber " +
        "TransnetBW): Mittelfristprognose zur deutschlandweiten Stromerzeugung aus EEG-Anlagen … 2026 bis 2030, " +
        "15.10.2025, S. 63: „Eckwert von 900 VBS für Freiflächenanlagen“ — context for the description, not an input",
    },
    areaBasis: "plant (fenced) area per MW as registered in the Marktstammdatenregister; whether MW is DC or AC is not stated by ZSW",
  },
  metrics: [
    {
      metric: PV_CAPACITY,
      labelDe: "Installierte Leistung einer neuen Anlage",
      unit: CAPACITY_UNIT,
      notApplicableByScenarioDe: NOT_APPLICABLE_BY_SCENARIO_DE,
      rangeDe: "Flächenbedarf neuer Anlagen von 0,83 bis 1,0 ha je MW (ZSW 2025); der Mittelwert beruht auf 0,88 ha/MW.",
      siteAggregation: "sum_per_ha",
    },
    {
      metric: PV_ANNUAL_YIELD,
      labelDe: "Jahresertrag einer neuen Anlage",
      unit: YIELD_UNIT,
      notApplicableByScenarioDe: NOT_APPLICABLE_BY_SCENARIO_DE,
      rangeDe:
        "Die Grenzen aller drei Faktoren (Umrechnung auf die Modulebene, Performance Ratio 80–90 %, Flächenbedarf " +
        "0,83–1,0 ha/MW) in die Richtung kombiniert, die die Spanne verbreitert; der Mittelwert beruht auf den " +
        "typischen Werten 1,15, 85 % und 0,88 ha/MW. Technischer Ertrag vor Abregelung.",
      siteAggregation: "sum_per_ha",
    },
  ],
};
