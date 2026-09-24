// water-arcegmo-v1 — docs/domain/scoring-criteria.md §4.2.
//
// Percolation and root-zone soil moisture from the LfU water-balance model
// (ArcEGMO-PSCN, 1991–2020). Status quo and preserve read the model for today's
// land use; restore is an approximation (decision D7): where the climate method
// finds drained peat, what a wet peatland on similar ground in the same model
// looks like, mixed with today's values by peat share. Pure arithmetic
// (ADR-0002) over values SQL has sampled.

import type { CriterionValue, Scenario } from "../types";
import type { OutcomeMethod } from "./method";
import type { MetricOutcome } from "./peat-climate";
import { peatLandUseFromClc } from "./peat-climate";

export const WATER_METHOD_VERSION = "water-arcegmo-v1";

interface WaterMetric {
  readonly metric: string;
  readonly unit: string;
  readonly current: string;
  readonly reference: string;
  readonly referenceLow: string;
  readonly referenceHigh: string;
}

export const WATER_METRICS: readonly WaterMetric[] = [
  {
    metric: "percolation",
    unit: "mm/a",
    current: "water_percolation",
    reference: "water_wet_ref_percolation",
    referenceLow: "water_wet_ref_percolation_p25",
    referenceHigh: "water_wet_ref_percolation_p75",
  },
  {
    metric: "root_zone_soil_moisture",
    unit: "%nFK",
    current: "water_root_zone_moisture",
    reference: "water_wet_ref_moisture",
    referenceLow: "water_wet_ref_moisture_p25",
    referenceHigh: "water_wet_ref_moisture_p75",
  },
];

export const WATER_CRITERIA = [
  "peat_share",
  "pv_land_cover",
  ...WATER_METRICS.flatMap((m) => [m.current, m.reference, m.referenceLow, m.referenceHigh]),
] as const;

/**
 * Both metrics for one unit and scenario. A missing value is "not checked":
 * the outcome is not modelled, never zero.
 */
export function waterOutcomes(scenario: Scenario, values: readonly CriterionValue[]): MetricOutcome[] {
  const byId = new Map(values.map((v) => [v.criterionId, v]));

  return WATER_METRICS.map((m): MetricOutcome => {
    const current = byId.get(m.current);
    if (scenario.startsWith("develop_") || current === undefined) {
      return { metric: m.metric, result: null, inputs: [] };
    }

    if (scenario === "status_quo" || scenario === "preserve") {
      // Preserve keeps today's use, so the model's values do not change —
      // and the method says so rather than inventing a difference.
      return {
        metric: m.metric,
        result: { value: current.value, unit: m.unit, confidence: "medium" },
        inputs: [current],
      };
    }

    // restore: only where rewetting drained peat is the restore option (§4.1).
    const peatShare = byId.get("peat_share");
    const landCover = byId.get("pv_land_cover");
    const reference = byId.get(m.reference);
    const low = byId.get(m.referenceLow);
    const high = byId.get(m.referenceHigh);
    const use = peatLandUseFromClc(landCover ? Math.round(landCover.value) : undefined);
    if (
      peatShare === undefined ||
      peatShare.value === 0 ||
      use === "other" ||
      reference === undefined ||
      low === undefined ||
      high === undefined
    ) {
      // Other restoration options exist and are not modelled — not "does not apply".
      return { metric: m.metric, result: null, inputs: [] };
    }

    const s = peatShare.value;
    const mix = (wet: number) => s * wet + (1 - s) * current.value;
    return {
      metric: m.metric,
      result: { value: mix(reference.value), low: mix(low.value), high: mix(high.value), unit: m.unit, confidence: "low" },
      inputs: [current, peatShare, landCover!, reference, low, high],
    };
  });
}

export const WATER_METHOD: OutcomeMethod = {
  methodVersion: WATER_METHOD_VERSION,
  dimension: "soil_water",
  nameDe: "Wasserhaushalt: Versickerung und Bodenfeuchte",
  nameEn: "Water balance: percolation and root-zone soil moisture",
  citation:
    "Landesamt für Umwelt Brandenburg: Wasserhaushaltsgrößen für das Land Brandenburg auf Elementarflächenbasis, " +
    "Reihe 1991–2020 (ArcEGMO-PSCN), Stand der Daten 10.03.2023; Dokumentation doku_efl20_pscn, Stand 27.06.2025.",
  descriptionDe:
    "Versickerung (mm/a) und relative Bodenfeuchte in der Wurzelzone bis 150 cm (%nFK), flächengewichtet über die " +
    "Elementarflächen der Zelle. Versickerung ist nicht dasselbe wie Grundwasserneubildung. Ist-Zustand und Erhalt: " +
    "die Modellwerte für die heutige Nutzung — Erhalt ändert den Wasserhaushalt gegenüber heute nicht. " +
    "Wiederherstellung (nur wo Moorboden wiedervernässt werden könnte): eine Näherung, kein Modelllauf — Median " +
    "und Quartile der als „feuchte Moore“ geführten Elementarflächen der Region, nach Moorbodenanteil mit den " +
    "heutigen Werten gemischt. Mehr oder weniger ist hier nicht per se besser oder schlechter.",
  parameters: {
    fields: { percolation: "GWN_91_20 (mm)", root_zone_soil_moisture: "NFK_91_20 (%nFK, root zone to 150 cm)" },
    aggregation: "area-weighted over the part of the cell the model covers",
    restoreReference: "LANDNUTZ 1110 'feuchte Moore' (doku_efl20_pscn Tab. 2) inside the pilot region",
    restoreMatching:
      "the cell's dominant HYD_NAME hydrotope class (Tab. 3) when it has at least 30 reference areas, otherwise all reference areas in the region",
    restoreStatistic: "median; range = lower to upper quartile; unweighted per Elementarfläche",
    restoreMixing: "peat share × wet reference + (1 − peat share) × today's value",
    restoreApplies: "only where peat-climate-ipcc2013-v1 finds peat under CLC5 211 or 231; elsewhere not modelled",
    direction: "not stated — deltas carry no gain/loss colouring",
  },
};
