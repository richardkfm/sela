// Reads for a set of units at once (roadmap Step 5: a group of cells
// summarised as one site, or placed side by side — mvp.md F6). The same rows
// the single-unit reads return, fetched with one query per table instead of
// one per unit. Nothing is computed here; lib/scoring/site.ts aggregates.

import type { ProtectionCategory, ProtectionOverlap } from "@/lib/scoring/protection-flags";
import type { CriterionValue, OutcomeRow, SuitabilityVerdict } from "@/lib/scoring/types";
import { query } from "../client";

export interface UnitBasics {
  readonly id: string;
  readonly kind: "hex_grid" | "flurstueck";
  readonly pilotRegion: string;
  readonly areaHa: number;
}

/** The units that exist among `ids`, in the order given. */
export async function listUnitBasics(ids: readonly string[]): Promise<UnitBasics[]> {
  const rows = await query<{ id: string; kind: UnitBasics["kind"]; pilot_region: string; area_ha: number }>(
    `SELECT id, kind, pilot_region, ST_Area(geom) / 10000.0 AS area_ha FROM spatial_unit WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ id: r.id, kind: r.kind, pilotRegion: r.pilot_region, areaHa: Number(r.area_ha) }] : [];
  });
}

export async function listVerdictsForUnits(ids: readonly string[], methodVersion: string): Promise<SuitabilityVerdict[]> {
  const rows = await query<{
    spatial_unit_id: string;
    technology: SuitabilityVerdict["technology"];
    verdict: SuitabilityVerdict["verdict"];
    score: string | null;
    limiting_criterion_id: string | null;
    excluded_by_criterion_id: string | null;
    method_version: string;
    protection_flag_count: number | null;
  }>(
    `SELECT spatial_unit_id, technology, verdict, score, limiting_criterion_id, excluded_by_criterion_id, method_version,
            protection_flag_count
     FROM suitability_verdict WHERE spatial_unit_id = ANY($1::uuid[]) AND method_version = $2`,
    [ids, methodVersion],
  );
  return rows.map((r) => ({
    spatialUnitId: r.spatial_unit_id,
    technology: r.technology,
    verdict: r.verdict,
    score: r.score === null ? null : Number(r.score),
    limitingCriterionId: r.limiting_criterion_id,
    excludedByCriterionId: r.excluded_by_criterion_id,
    methodVersion: r.method_version,
    protectionFlagCount: r.protection_flag_count,
  }));
}

export async function listCriterionValuesForUnits(ids: readonly string[]): Promise<CriterionValue[]> {
  const rows = await query<{
    id: string;
    criterion_id: string;
    spatial_unit_id: string;
    value: string;
    unit: string | null;
    confidence: CriterionValue["confidence"];
    source_id: string;
    method_version: string;
  }>(
    `SELECT id, criterion_id, spatial_unit_id, value, unit, confidence, source_id, method_version
     FROM criterion_value WHERE spatial_unit_id = ANY($1::uuid[])`,
    [ids],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    criterionId: r.criterion_id,
    spatialUnitId: r.spatial_unit_id,
    value: Number(r.value),
    unit: r.unit,
    confidence: r.confidence,
    sourceId: r.source_id,
    methodVersion: r.method_version,
  }));
}

export async function listProtectionOverlapsForUnits(ids: readonly string[]): Promise<ProtectionOverlap[]> {
  const rows = await query<{
    spatial_unit_id: string;
    category: ProtectionCategory;
    area_code: string;
    name: string;
    share: number;
    source_id: string;
  }>(
    `SELECT spatial_unit_id, category, area_code, name, share, source_id
     FROM protection_overlap WHERE spatial_unit_id = ANY($1::uuid[])
     ORDER BY category, share DESC, name`,
    [ids],
  );
  return rows.map((r) => ({
    spatialUnitId: r.spatial_unit_id,
    category: r.category,
    areaCode: r.area_code,
    name: r.name,
    share: Number(r.share),
    sourceId: r.source_id,
  }));
}

export async function listOutcomesForUnits(ids: readonly string[], methodVersions: readonly string[]): Promise<OutcomeRow[]> {
  const rows = await query<{
    spatial_unit_id: string;
    scenario: OutcomeRow["scenario"];
    dimension: OutcomeRow["dimension"];
    metric: string;
    value: string | null;
    value_low: string | null;
    value_high: string | null;
    unit: string | null;
    confidence: OutcomeRow["confidence"];
    status: OutcomeRow["status"];
    method_version: string;
  }>(
    `SELECT spatial_unit_id, scenario, dimension, metric, value, value_low, value_high, unit, confidence, status,
            method_version
     FROM outcome WHERE spatial_unit_id = ANY($1::uuid[]) AND method_version = ANY($2::text[])`,
    [ids, methodVersions],
  );
  return rows.map((r) => ({
    spatialUnitId: r.spatial_unit_id,
    scenario: r.scenario,
    dimension: r.dimension,
    metric: r.metric,
    value: r.value === null ? null : Number(r.value),
    valueLow: r.value_low === null ? null : Number(r.value_low),
    valueHigh: r.value_high === null ? null : Number(r.value_high),
    unit: r.unit,
    confidence: r.confidence,
    status: r.status,
    methodVersion: r.method_version,
  }));
}
