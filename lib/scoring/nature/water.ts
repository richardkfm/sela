// water-arcegmo-v2 — docs/domain/scoring-criteria.md §4.2.
//
// Percolation and root-zone soil moisture from the LfU water-balance model
// (ArcEGMO-PSCN, 1991–2020). Status quo and preserve read the model for today's
// land use. Restore is not modelled: v1 approximated it from the region's wet
// peatlands, and the owner withdrew that on 2026-09-25 because the reference
// set was too small and too groundwater-far to carry it (§4.2). Pure
// arithmetic (ADR-0002) over values SQL has sampled.

import type { CriterionValue, Scenario } from "../types";
import type { OutcomeMethod } from "./method";
import type { MetricOutcome } from "./peat-climate";

export const WATER_METHOD_VERSION = "water-arcegmo-v2";

interface WaterMetric {
  readonly metric: string;
  readonly unit: string;
  readonly current: string;
}

export const WATER_METRICS: readonly WaterMetric[] = [
  { metric: "percolation", unit: "mm/a", current: "water_percolation" },
  { metric: "root_zone_soil_moisture", unit: "%nFK", current: "water_root_zone_moisture" },
];

export const WATER_CRITERIA = WATER_METRICS.map((m) => m.current);

/**
 * Both metrics for one unit and scenario. A missing value is "not checked":
 * the outcome is not modelled, never zero.
 */
export function waterOutcomes(scenario: Scenario, values: readonly CriterionValue[]): MetricOutcome[] {
  const byId = new Map(values.map((v) => [v.criterionId, v]));

  return WATER_METRICS.map((m): MetricOutcome => {
    const current = byId.get(m.current);
    // develop_* and restore are not modelled; restore is not "does not apply" —
    // rewetting would change the water balance, sela just cannot say how yet.
    if ((scenario !== "status_quo" && scenario !== "preserve") || current === undefined) {
      return { metric: m.metric, result: null, inputs: [] };
    }
    // Preserve keeps today's use, so the model's values do not change —
    // and the method says so rather than inventing a difference.
    return {
      metric: m.metric,
      result: { value: current.value, unit: m.unit, confidence: "medium" },
      inputs: [current],
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
    "Renaturierung ist noch nicht modelliert: Eine Wiedervernässung verändert den Wasserhaushalt, aber das " +
    "Landesmodell enthält keinen Lauf dafür, und eine Näherung aus den wenigen feuchten Mooren der Region war nicht " +
    "belastbar. Mehr oder weniger ist hier nicht per se besser oder schlechter.",
  parameters: {
    fields: { percolation: "GWN_91_20 (mm)", root_zone_soil_moisture: "NFK_91_20 (%nFK, root zone to 150 cm)" },
    aggregation: "area-weighted over the part of the cell the model covers",
    restore:
      "not modelled — v1's approximation from the region's 58 'feuchte Moore' areas was withdrawn (scoring-criteria.md §4.2)",
    direction: "not stated — deltas carry no gain/loss colouring",
  },
  metrics: [
    { metric: "percolation", labelDe: "Versickerung", unit: "mm/a" },
    { metric: "root_zone_soil_moisture", labelDe: "Bodenfeuchte im Wurzelraum", unit: "%nFK" },
  ],
};
